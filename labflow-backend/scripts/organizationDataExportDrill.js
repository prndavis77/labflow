"use strict";

require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const yauzl = require("yauzl");

const REQUIRED_NODE_ENV = "test";
const REQUIRED_DATABASE_NAME = "labflow_test";
const REQUIRED_R2_BUCKET = "labflow-test-attachments";
const PRODUCTION_R2_BUCKET = "labflow-attachments";

const fail = (message) => {
  const error = new Error(message);
  error.isExportDrillFailure = true;
  throw error;
};

const requireValue = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    fail(`${name} is required for the organization export drill.`);
  }

  return value;
};

const parseTestDatabaseUrl = () => {
  const databaseUrl = requireValue("TEST_DATABASE_URL");

  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    fail("TEST_DATABASE_URL must use PostgreSQL.");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

  if (!allowedHosts.has(parsed.hostname)) {
    fail(
      `Export drill refused: TEST_DATABASE_URL host "${parsed.hostname}" is not local.`,
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (databaseName !== REQUIRED_DATABASE_NAME) {
    fail(
      `Export drill refused: database must be "${REQUIRED_DATABASE_NAME}", ` +
        `received "${databaseName}".`,
    );
  }

  return {
    host: parsed.hostname,
    databaseName,
  };
};

const getDrillR2Config = () => {
  const accountId = requireValue("LABFLOW_DRILL_R2_ACCOUNT_ID");

  const accessKeyId = requireValue("LABFLOW_DRILL_R2_ACCESS_KEY_ID");

  const secretAccessKey = requireValue("LABFLOW_DRILL_R2_SECRET_ACCESS_KEY");

  const bucketName = requireValue("LABFLOW_DRILL_R2_BUCKET_NAME");

  if (bucketName !== REQUIRED_R2_BUCKET) {
    fail(
      `Export drill refused: R2 bucket must be "${REQUIRED_R2_BUCKET}", ` +
        `received "${bucketName}".`,
    );
  }

  if (bucketName === PRODUCTION_R2_BUCKET) {
    fail("Export drill refused: production R2 bucket selected.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
};

const establishSafetyBoundary = () => {
  if (process.env.NODE_ENV !== REQUIRED_NODE_ENV) {
    fail(`Export drill refused: NODE_ENV must be "${REQUIRED_NODE_ENV}".`);
  }

  const database = parseTestDatabaseUrl();
  const r2 = getDrillR2Config();

  /*
   * Force all LabFlow storage modules loaded below to use the dedicated
   * test bucket and its dedicated credentials.
   */
  process.env.R2_ACCOUNT_ID = r2.accountId;
  process.env.R2_ACCESS_KEY_ID = r2.accessKeyId;
  process.env.R2_SECRET_ACCESS_KEY = r2.secretAccessKey;
  process.env.R2_BUCKET_NAME = r2.bucketName;
  process.env.R2_ENDPOINT = r2.endpoint;

  return {
    database,
    r2,
  };
};

const safety = establishSafetyBoundary();

/*
 * Load LabFlow modules only after the storage safety boundary is installed.
 */
const { Attachment, Organization, Project, User } = require("../src/models");

const { sequelize } = require("../src/config/database");

const {
  createR2AttachmentStorage,
} = require("../src/storage/providers/r2AttachmentStorage");

const {
  buildOrganizationDataExportPackage,
} = require("../src/services/organizationDataExportPackageService");

const createDirectR2Client = () =>
  new S3Client({
    region: safety.r2.region,
    endpoint: safety.r2.endpoint,
    credentials: {
      accessKeyId: safety.r2.accessKeyId,
      secretAccessKey: safety.r2.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

const createStorage = () =>
  createR2AttachmentStorage({
    config: {
      accountId: safety.r2.accountId,
      accessKeyId: safety.r2.accessKeyId,
      secretAccessKey: safety.r2.secretAccessKey,
      bucketName: safety.r2.bucketName,
      endpoint: safety.r2.endpoint,
      region: safety.r2.region,
    },
  });

const sha256 = (content) =>
  crypto.createHash("sha256").update(content).digest("hex");

const assertRuntimeDatabaseSafety = () => {
  const databaseName = String(sequelize.config.database || "").trim();

  const databaseHost = String(sequelize.config.host || "").trim();

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!allowedHosts.has(databaseHost)) {
    fail(`Runtime database safety check failed: host is "${databaseHost}".`);
  }

  if (databaseName !== REQUIRED_DATABASE_NAME) {
    fail(
      `Runtime database safety check failed: database is "${databaseName}".`,
    );
  }
};

const readZipEntries = (zipBuffer) =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      zipBuffer,
      {
        lazyEntries: true,
      },
      (openError, zipFile) => {
        if (openError) {
          reject(openError);
          return;
        }

        const entries = {};

        zipFile.on("error", reject);

        zipFile.on("entry", (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipFile.readEntry();
            return;
          }

          zipFile.openReadStream(entry, (streamError, readStream) => {
            if (streamError) {
              reject(streamError);
              return;
            }

            const chunks = [];

            readStream.on("data", (chunk) => {
              chunks.push(Buffer.from(chunk));
            });

            readStream.on("error", reject);

            readStream.on("end", () => {
              entries[entry.fileName] = Buffer.concat(chunks);

              zipFile.readEntry();
            });
          });
        });

        zipFile.on("end", () => {
          resolve(entries);
        });

        zipFile.readEntry();
      },
    );
  });

const verifyManifestHashes = ({ manifest, entries }) => {
  if (!Array.isArray(manifest.files)) {
    fail("Top-level export manifest does not contain files[].");
  }

  for (const expectedFile of manifest.files) {
    const content = entries[expectedFile.path];

    if (!content) {
      fail(`Manifest file is missing from ZIP: ${expectedFile.path}`);
    }

    if (content.length !== expectedFile.size) {
      fail(`Size verification failed for ${expectedFile.path}.`);
    }

    const actualSha256 = sha256(content);

    if (actualSha256 !== expectedFile.sha256) {
      fail(`SHA-256 verification failed for ${expectedFile.path}.`);
    }
  }
};

const createOrganizationFixture = async ({ label, suffix }) => {
  const organization = await Organization.create({
    name: `${label} ${suffix}`,
    slug: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${suffix}`,
    type: "demo",
    isActive: true,
  });

  const passwordHash = await require("bcrypt").hash(
    "LabFlowExportDrillPassword123!",
    4,
  );

  const user = await User.create({
    name: `${label} Admin`,
    email:
      `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` +
      `-${suffix}@example.com`,
    passwordHash,
    role: "admin",
    department: "Export Drill",
    organizationId: organization.id,
    emailVerifiedAt: new Date(),
  });

  const project = await Project.create({
    title: `${label} Project ${suffix}`,
    description: `${label} project export fixture`,
    status: "active",
    supervisorId: user.id,
    organizationId: organization.id,
  });

  return {
    organization,
    user,
    project,
  };
};

const putAttachmentFixture = async ({ client, fixture, label, content }) => {
  const attachmentId = crypto.randomUUID();

  const fileName = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;

  const storageKey =
    `organizations/${fixture.organization.id}` +
    `/project/${fixture.project.id}` +
    `/attachments/${attachmentId}/${fileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: safety.r2.bucketName,
      Key: storageKey,
      Body: content,
      ContentType: "text/plain",
    }),
  );

  const attachment = await Attachment.create({
    id: attachmentId,
    organizationId: fixture.organization.id,
    uploadedById: fixture.user.id,
    originalFileName: fileName,
    fileName,
    fileExtension: ".txt",
    mimeType: "text/plain",
    fileSize: content.length,
    verifiedFileSize: content.length,
    storageProvider: "r2",
    storageKey,
    checksum: sha256(content),
    entityType: "project",
    entityId: fixture.project.id,
    category: "other",
    description: `${label} attachment export fixture`,
    uploadStatus: "available",
    isArchived: false,
  });

  return {
    attachment,
    storageKey,
    content,
  };
};

const deleteR2ObjectBestEffort = async ({ client, storageKey }) => {
  if (!storageKey) {
    return;
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: safety.r2.bucketName,
        Key: storageKey,
      }),
    );
  } catch {
    // Preserve the original drill result.
  }
};

const deleteDatabaseFixtureBestEffort = async (fixture) => {
  if (!fixture?.organization?.id) {
    return;
  }

  const organizationId = fixture.organization.id;

  try {
    await Attachment.destroy({
      where: {
        organizationId,
      },
    });

    await Project.destroy({
      where: {
        organizationId,
      },
    });

    await User.destroy({
      where: {
        organizationId,
      },
    });

    await Organization.destroy({
      where: {
        id: organizationId,
      },
    });
  } catch {
    // Preserve the original drill result.
  }
};

const run = async () => {
  console.log("");
  console.log("LABFLOW CUSTOMER EXPORT DRILL");
  console.log("=============================");
  console.log("");
  console.log("SAFETY BOUNDARY");
  console.log("-----------------------------");
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`Database host: ${safety.database.host}`);
  console.log(`Database name: ${safety.database.databaseName}`);
  console.log(`R2 bucket: ${safety.r2.bucketName}`);
  console.log("");

  await sequelize.authenticate();

  assertRuntimeDatabaseSafety();

  const r2Client = createDirectR2Client();
  const storage = createStorage();

  const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "labflow-customer-export-drill-"),
  );

  let outputPath = null;
  let targetFixture = null;
  let neighborFixture = null;
  let targetAttachment = null;
  let neighborAttachment = null;

  try {
    targetFixture = await createOrganizationFixture({
      label: "Export Drill Target",
      suffix,
    });

    neighborFixture = await createOrganizationFixture({
      label: "Export Drill Neighbor",
      suffix,
    });

    const targetContent = Buffer.from(
      `TARGET-ONLY-CONTENT-${crypto.randomUUID()}`,
      "utf8",
    );

    const neighborContent = Buffer.from(
      `NEIGHBOR-ONLY-CONTENT-${crypto.randomUUID()}`,
      "utf8",
    );

    targetAttachment = await putAttachmentFixture({
      client: r2Client,
      fixture: targetFixture,
      label: "target-export",
      content: targetContent,
    });

    neighborAttachment = await putAttachmentFixture({
      client: r2Client,
      fixture: neighborFixture,
      label: "neighbor-export",
      content: neighborContent,
    });

    const exportPackage = await buildOrganizationDataExportPackage({
      organizationId: targetFixture.organization.id,
      storage,
    });

    if (exportPackage.status !== "complete") {
      fail(`Expected complete export, received "${exportPackage.status}".`);
    }

    outputPath = path.join(tempDirectory, exportPackage.fileName);

    await fs.writeFile(outputPath, exportPackage.content, {
      flag: "wx",
      mode: 0o600,
    });

    const onDiskBuffer = await fs.readFile(outputPath);

    if (sha256(onDiskBuffer) !== exportPackage.sha256) {
      fail("On-disk ZIP SHA-256 differs from the generated package SHA-256.");
    }

    const entries = await readZipEntries(onDiskBuffer);

    const requiredEntries = [
      "manifest.json",
      "organization.json",
      "users.json",
      "projects.json",
      "attachments/metadata.json",
      "attachments/manifest.json",
      targetAttachment.attachment
        ? `attachments/files/${targetAttachment.attachment.id}` +
          "/target-export.txt"
        : null,
    ].filter(Boolean);

    for (const entryName of requiredEntries) {
      if (!entries[entryName]) {
        fail(`Required ZIP entry is missing: ${entryName}`);
      }
    }

    const manifest = JSON.parse(entries["manifest.json"].toString("utf8"));

    if (manifest.organization.id !== targetFixture.organization.id) {
      fail("Top-level manifest organization ID does not match the target.");
    }

    if (manifest.status !== "complete") {
      fail(`Manifest status is "${manifest.status}" instead of "complete".`);
    }

    verifyManifestHashes({
      manifest,
      entries,
    });

    const attachmentManifest = JSON.parse(
      entries["attachments/manifest.json"].toString("utf8"),
    );

    if (
      attachmentManifest.exportedCount !== 1 ||
      attachmentManifest.notExportedCount !== 0
    ) {
      fail("Attachment manifest did not report exactly one successful export.");
    }

    const targetBinaryPath =
      `attachments/files/` +
      `${targetAttachment.attachment.id}/` +
      "target-export.txt";

    const exportedTargetBinary = entries[targetBinaryPath];

    if (!exportedTargetBinary.equals(targetAttachment.content)) {
      fail("Exported target attachment bytes do not match the R2 fixture.");
    }

    /*
     * Scan JSON payloads and binary payloads for known neighbor-only markers.
     */
    const allZipContent = Buffer.concat(Object.values(entries));

    if (allZipContent.includes(neighborAttachment.content)) {
      fail("Neighbor attachment content was found in the target export.");
    }

    const jsonText = Object.entries(entries)
      .filter(([entryName]) => entryName.endsWith(".json"))
      .map(([, content]) => content.toString("utf8"))
      .join("\n");

    if (jsonText.includes(neighborFixture.user.email)) {
      fail("Neighbor user data was found in the target export.");
    }

    if (jsonText.includes(neighborFixture.project.title)) {
      fail("Neighbor project data was found in the target export.");
    }

    if (jsonText.includes(neighborAttachment.attachment.id)) {
      fail("Neighbor attachment metadata was found in the target export.");
    }

    const forbiddenFieldNames = [
      "passwordHash",
      "tokenVersion",
      "tokenHash",
      "storageKey",
      "storageProvider",
      "emailProviderMessageId",
      "ipAddress",
      "userAgent",
    ];

    for (const forbiddenField of forbiddenFieldNames) {
      if (jsonText.includes(`"${forbiddenField}"`)) {
        fail(`Forbidden field "${forbiddenField}" was found in the export.`);
      }
    }

    console.log("DRILL RESULT");
    console.log("-----------------------------");
    console.log("Package generated: PASS");
    console.log("ZIP written to disk: PASS");
    console.log("ZIP reopened independently: PASS");
    console.log("ZIP SHA-256 verified: PASS");
    console.log("Manifest parsed: PASS");
    console.log("Manifest file hashes verified: PASS");
    console.log("Attachment binary verified: PASS");
    console.log("Neighbor database isolation: PASS");
    console.log("Neighbor R2 isolation: PASS");
    console.log("Sensitive-field exclusion: PASS");
    console.log("");
    console.log(`Target organization ID: ${targetFixture.organization.id}`);
    console.log(`Neighbor organization ID: ${neighborFixture.organization.id}`);
    console.log(`Export package bytes: ${exportPackage.size}`);
    console.log(`Export package SHA-256: ${exportPackage.sha256}`);
    console.log("");
    console.log("OVERALL RESULT: PASS");
    console.log("");
  } finally {
    /*
     * Remove drill R2 fixtures first.
     */
    await deleteR2ObjectBestEffort({
      client: r2Client,
      storageKey: targetAttachment?.storageKey,
    });

    await deleteR2ObjectBestEffort({
      client: r2Client,
      storageKey: neighborAttachment?.storageKey,
    });

    /*
     * Remove synthetic database fixtures.
     */
    await deleteDatabaseFixtureBestEffort(targetFixture);

    await deleteDatabaseFixtureBestEffort(neighborFixture);

    /*
     * Remove the generated customer-export ZIP and its temporary directory.
     *
     * This is application-level deletion. It must not be described as a
     * guaranteed forensic overwrite or physical-media secure erase.
     */
    try {
      await fs.rm(tempDirectory, {
        recursive: true,
        force: true,
      });
    } catch {
      // The explicit existence check below will catch cleanup failure.
    }

    let tempDirectoryStillExists = false;

    try {
      await fs.access(tempDirectory);
      tempDirectoryStillExists = true;
    } catch {
      tempDirectoryStillExists = false;
    }

    if (tempDirectoryStillExists) {
      fail(
        `Temporary export directory still exists after cleanup: ${tempDirectory}`,
      );
    } else {
      console.log("Temporary export artifact cleanup: PASS");
    }

    r2Client.destroy();
  }
};

run()
  .catch((error) => {
    console.error("");
    console.error("OVERALL RESULT: FAIL");
    console.error(`${error.code || error.name || "ERROR"}: ${error.message}`);

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch {
      // Preserve the drill result.
    }
  });
