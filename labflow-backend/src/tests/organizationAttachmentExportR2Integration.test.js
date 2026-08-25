"use strict";

const crypto = require("crypto");

const {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const { Attachment, Organization, Project } = require("../models");

const {
  createR2AttachmentStorage,
} = require("../storage/providers/r2AttachmentStorage");

const {
  exportOrganizationAttachmentBinaries,
} = require("../services/organizationAttachmentExportService");

const { resetTestDatabase } = require("./helpers/dbHelpers");

const { createTestProject, createTestUser } = require("./helpers/testHelpers");

const REQUIRED_NODE_ENV = "test";
const REQUIRED_DATABASE_NAME = "labflow_test";
const REQUIRED_R2_BUCKET = "labflow-test-attachments";
const PRODUCTION_R2_BUCKET = "labflow-attachments";

const requireEnvironmentValue = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `${name} is required for the attachment export R2 integration test.`,
    );
  }

  return value;
};

const assertSafeTestDatabase = () => {
  if (process.env.NODE_ENV !== REQUIRED_NODE_ENV) {
    throw new Error(
      `R2 integration test refused: NODE_ENV must be "${REQUIRED_NODE_ENV}".`,
    );
  }

  const databaseUrl = requireEnvironmentValue("TEST_DATABASE_URL");

  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      "R2 integration test refused: TEST_DATABASE_URL must be a valid URL.",
    );
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `R2 integration test refused: database host "${parsed.hostname}" is not local.`,
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (databaseName !== REQUIRED_DATABASE_NAME) {
    throw new Error(
      `R2 integration test refused: database must be "${REQUIRED_DATABASE_NAME}", received "${databaseName}".`,
    );
  }
};

const getSafeR2Config = () => {
  const accountId = requireEnvironmentValue("LABFLOW_DRILL_R2_ACCOUNT_ID");

  const accessKeyId = requireEnvironmentValue("LABFLOW_DRILL_R2_ACCESS_KEY_ID");

  const secretAccessKey = requireEnvironmentValue(
    "LABFLOW_DRILL_R2_SECRET_ACCESS_KEY",
  );

  const bucketName = requireEnvironmentValue("LABFLOW_DRILL_R2_BUCKET_NAME");

  if (bucketName !== REQUIRED_R2_BUCKET) {
    throw new Error(
      `R2 integration test refused: bucket must be "${REQUIRED_R2_BUCKET}", received "${bucketName}".`,
    );
  }

  if (bucketName === PRODUCTION_R2_BUCKET) {
    throw new Error(
      "R2 integration test refused: production attachment bucket selected.",
    );
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

const createDirectR2Client = (config) =>
  new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

const createStorage = (config) =>
  createR2AttachmentStorage({
    config: {
      accountId: config.accountId,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucketName: config.bucketName,
      endpoint: config.endpoint,
      region: config.region,
    },
  });

const sha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

describe("organization attachment export R2 integration", () => {
  let r2Config;
  let r2Client;
  let storage;

  let organizationA;
  let organizationB;

  let adminA;
  let adminB;

  let projectA;
  let projectB;

  const createdStorageKeys = [];

  beforeAll(async () => {
    assertSafeTestDatabase();

    r2Config = getSafeR2Config();
    r2Client = createDirectR2Client(r2Config);
    storage = createStorage(r2Config);

    await Organization.sequelize.authenticate();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await Organization.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });

    createdStorageKeys.length = 0;

    organizationA = await Organization.create({
      name: "Attachment Export Lab A",
      slug: `attachment-export-lab-a-${crypto.randomUUID()}`,
      type: "lab",
      isActive: true,
    });

    organizationB = await Organization.create({
      name: "Attachment Export Lab B",
      slug: `attachment-export-lab-b-${crypto.randomUUID()}`,
      type: "lab",
      isActive: true,
    });

    adminA = await createTestUser({
      name: "Attachment Export Admin A",
      email: `attachment-export-a-${crypto.randomUUID()}@test.com`,
      role: "admin",
      organizationId: organizationA.id,
    });

    adminB = await createTestUser({
      name: "Attachment Export Admin B",
      email: `attachment-export-b-${crypto.randomUUID()}@test.com`,
      role: "admin",
      organizationId: organizationB.id,
    });

    projectA = await createTestProject({
      title: "Attachment Export Project A",
      supervisorId: adminA.id,
      organizationId: organizationA.id,
    });

    projectB = await createTestProject({
      title: "Attachment Export Project B",
      supervisorId: adminB.id,
      organizationId: organizationB.id,
    });
  });

  afterEach(async () => {
    for (const storageKey of createdStorageKeys) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: r2Config.bucketName,
            Key: storageKey,
          }),
        );
      } catch {
        // Cleanup is best-effort so the original test failure is preserved.
      }
    }

    createdStorageKeys.length = 0;
  });

  afterAll(async () => {
    if (r2Client) {
      r2Client.destroy();
    }

    await Organization.sequelize.close();
  });

  it("exports only the requested organization's attachment binary", async () => {
    const contentA = Buffer.from(
      "LabFlow organization A attachment export integration test",
      "utf8",
    );

    const contentB = Buffer.from(
      "LabFlow organization B attachment that must not be exported",
      "utf8",
    );

    const attachmentIdA = crypto.randomUUID();
    const attachmentIdB = crypto.randomUUID();

    const storageKeyA =
      `organizations/${organizationA.id}/project/${projectA.id}` +
      `/attachments/${attachmentIdA}/organization-a.txt`;

    const storageKeyB =
      `organizations/${organizationB.id}/project/${projectB.id}` +
      `/attachments/${attachmentIdB}/organization-b.txt`;

    createdStorageKeys.push(storageKeyA, storageKeyB);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: storageKeyA,
        Body: contentA,
        ContentType: "text/plain",
      }),
    );

    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: storageKeyB,
        Body: contentB,
        ContentType: "text/plain",
      }),
    );

    const attachmentA = await Attachment.create({
      id: attachmentIdA,
      organizationId: organizationA.id,
      uploadedById: adminA.id,
      originalFileName: "organization-a.txt",
      fileName: "organization-a.txt",
      fileExtension: ".txt",
      mimeType: "text/plain",
      fileSize: contentA.length,
      verifiedFileSize: contentA.length,
      storageProvider: "r2",
      storageKey: storageKeyA,
      checksum: sha256(contentA),
      entityType: "project",
      entityId: projectA.id,
      category: "other",
      description: "Organization A export fixture.",
      uploadStatus: "available",
      uploadExpiresAt: null,
      isArchived: false,
      archivedAt: null,
      archivedById: null,
    });

    await Attachment.create({
      id: attachmentIdB,
      organizationId: organizationB.id,
      uploadedById: adminB.id,
      originalFileName: "organization-b.txt",
      fileName: "organization-b.txt",
      fileExtension: ".txt",
      mimeType: "text/plain",
      fileSize: contentB.length,
      verifiedFileSize: contentB.length,
      storageProvider: "r2",
      storageKey: storageKeyB,
      checksum: sha256(contentB),
      entityType: "project",
      entityId: projectB.id,
      category: "other",
      description: "Organization B export fixture.",
      uploadStatus: "available",
      uploadExpiresAt: null,
      isArchived: false,
      archivedAt: null,
      archivedById: null,
    });

    /*
     * This is the sanitized attachment representation produced by the
     * PostgreSQL customer-data export layer. Notice that storageKey is
     * deliberately absent.
     */
    const exportedAttachmentMetadata = [
      {
        id: attachmentA.id,
        organizationId: organizationA.id,
        uploadedById: adminA.id,
        originalFileName: attachmentA.originalFileName,
        fileExtension: attachmentA.fileExtension,
        mimeType: attachmentA.mimeType,
        fileSize: Number(attachmentA.fileSize),
        verifiedFileSize: Number(attachmentA.verifiedFileSize),
        checksum: attachmentA.checksum,
        entityType: attachmentA.entityType,
        entityId: attachmentA.entityId,
        category: attachmentA.category,
        description: attachmentA.description,
        uploadStatus: attachmentA.uploadStatus,
        isArchived: attachmentA.isArchived,
        archivedAt: attachmentA.archivedAt,
        archivedById: attachmentA.archivedById,
        createdAt: attachmentA.createdAt,
        updatedAt: attachmentA.updatedAt,
      },
    ];

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: organizationA.id,
      attachments: exportedAttachmentMetadata,
      storage,
    });

    expect(result.files).toHaveLength(1);

    expect(result.files[0]).toMatchObject({
      attachmentId: attachmentIdA,
      exportPath: `attachments/files/${attachmentIdA}/organization-a.txt`,
    });

    expect(result.files[0].content.equals(contentA)).toBe(true);

    expect(result.manifest).toMatchObject({
      manifestVersion: 1,
      organizationId: organizationA.id,
      attachmentCount: 1,
      exportedCount: 1,
      notExportedCount: 0,
      totalExportedBytes: contentA.length,
    });

    expect(result.manifest.entries).toHaveLength(1);

    expect(result.manifest.entries[0]).toMatchObject({
      attachmentId: attachmentIdA,
      originalFileName: "organization-a.txt",
      status: "exported",
      exportedFileSize: contentA.length,
      sha256: sha256(contentA),
    });

    /*
     * Prove the neighboring tenant's object exists in the same test bucket,
     * but was not included in the result.
     */
    const serializedManifest = JSON.stringify(result.manifest);

    expect(serializedManifest).not.toContain(attachmentIdB);
    expect(serializedManifest).not.toContain("organization-b.txt");

    expect(
      result.files.some((file) => file.attachmentId === attachmentIdB),
    ).toBe(false);

    expect(result.files.some((file) => file.content.equals(contentB))).toBe(
      false,
    );
  });

  it("fails closed if the database storage key points into another organization namespace", async () => {
    const content = Buffer.from(
      "Cross-organization storage boundary fixture",
      "utf8",
    );

    const attachmentId = crypto.randomUUID();

    const foreignStorageKey =
      `organizations/${organizationB.id}/project/${projectB.id}` +
      `/attachments/${attachmentId}/foreign.txt`;

    createdStorageKeys.push(foreignStorageKey);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: foreignStorageKey,
        Body: content,
        ContentType: "text/plain",
      }),
    );

    /*
     * Deliberately create a corrupt/inconsistent database row:
     * organization A owns the row, but its storage key points into B's
     * namespace.
     *
     * Sequelize itself permits this because storageKey is not a relational FK.
     * The export service must detect and refuse it.
     */
    const attachment = await Attachment.create({
      id: attachmentId,
      organizationId: organizationA.id,
      uploadedById: adminA.id,
      originalFileName: "foreign.txt",
      fileName: "foreign.txt",
      fileExtension: ".txt",
      mimeType: "text/plain",
      fileSize: content.length,
      verifiedFileSize: content.length,
      storageProvider: "r2",
      storageKey: foreignStorageKey,
      checksum: sha256(content),
      entityType: "project",
      entityId: projectA.id,
      category: "other",
      description: "Intentional cross-tenant corruption fixture.",
      uploadStatus: "available",
      isArchived: false,
    });

    const sanitizedMetadata = [
      {
        id: attachment.id,
        organizationId: organizationA.id,
        uploadedById: adminA.id,
        originalFileName: attachment.originalFileName,
        fileExtension: attachment.fileExtension,
        mimeType: attachment.mimeType,
        fileSize: Number(attachment.fileSize),
        verifiedFileSize: Number(attachment.verifiedFileSize),
        checksum: attachment.checksum,
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        category: attachment.category,
        description: attachment.description,
        uploadStatus: attachment.uploadStatus,
        isArchived: attachment.isArchived,
        archivedAt: attachment.archivedAt,
        archivedById: attachment.archivedById,
        createdAt: attachment.createdAt,
        updatedAt: attachment.updatedAt,
      },
    ];

    await expect(
      exportOrganizationAttachmentBinaries({
        organizationId: organizationA.id,
        attachments: sanitizedMetadata,
        storage,
      }),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_STORAGE_PREFIX_MISMATCH",
    });
  });
});
