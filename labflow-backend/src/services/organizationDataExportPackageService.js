"use strict";

const archiver = require("archiver");
const crypto = require("crypto");
const { PassThrough } = require("stream");

const {
  exportOrganizationDatabaseData,
} = require("./organizationDataExportService");

const {
  exportOrganizationAttachmentBinaries,
} = require("./organizationAttachmentExportService");

class OrganizationDataExportPackageError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OrganizationDataExportPackageError";
    this.code = code;
  }
}

const DATASET_FILES = Object.freeze({
  users: "users.json",
  projects: "projects.json",
  projectMembers: "project-members.json",
  tasks: "tasks.json",
  experiments: "experiments.json",
  protocols: "protocols.json",
  equipment: "equipment.json",
  equipmentBookings: "equipment-bookings.json",
  notebookEntries: "notebook-entries.json",
  reviewEvents: "review-events.json",
  invitations: "invitations.json",
  auditLogs: "audit-logs.json",
});

const createJsonBuffer = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const calculateSha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const sanitizeFileNamePart = (value, fallback = "organization") => {
  const sanitized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized || fallback;
};

const createExportFileName = ({ organization, exportedAt }) => {
  const organizationPart = sanitizeFileNamePart(
    organization.slug || organization.name,
  );

  const timestampPart = String(exportedAt)
    .replace(/[:.]/g, "-")
    .replace(/[^\dTZ-]/g, "");

  return `labflow-export-${organizationPart}-${timestampPart}.zip`;
};

const buildPortableFiles = ({ databaseExport, attachmentExport }) => {
  const files = [];

  const addJsonFile = (path, value) => {
    const content = createJsonBuffer(value);

    files.push({
      path,
      content,
      size: content.length,
      sha256: calculateSha256(content),
    });
  };

  addJsonFile("organization.json", databaseExport.organization);

  for (const [datasetKey, fileName] of Object.entries(DATASET_FILES)) {
    addJsonFile(fileName, databaseExport.data[datasetKey] || []);
  }

  addJsonFile(
    "attachments/metadata.json",
    databaseExport.data.attachments || [],
  );

  addJsonFile("attachments/manifest.json", attachmentExport.manifest);

  for (const attachmentFile of attachmentExport.files) {
    const content = Buffer.isBuffer(attachmentFile.content)
      ? attachmentFile.content
      : Buffer.from(attachmentFile.content);

    files.push({
      path: attachmentFile.exportPath,
      content,
      size: content.length,
      sha256: calculateSha256(content),
    });
  }

  return files;
};

const buildTopLevelManifest = ({
  databaseExport,
  attachmentExport,
  portableFiles,
}) => {
  const hasAttachmentOmissions = attachmentExport.manifest.notExportedCount > 0;

  return {
    manifestVersion: 1,
    exportVersion: databaseExport.exportVersion,

    status: hasAttachmentOmissions
      ? "completed_with_attachment_omissions"
      : "complete",

    exportedAt: databaseExport.exportedAt,

    organization: {
      id: databaseExport.organization.id,
      name: databaseExport.organization.name,
      slug: databaseExport.organization.slug,
      type: databaseExport.organization.type,
    },

    recordCounts: databaseExport.recordCounts,

    attachments: {
      attachmentCount: attachmentExport.manifest.attachmentCount,
      exportedCount: attachmentExport.manifest.exportedCount,
      notExportedCount: attachmentExport.manifest.notExportedCount,
      totalExportedBytes: attachmentExport.manifest.totalExportedBytes,
    },

    files: portableFiles.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
    })),
  };
};

const createZipBuffer = async (files) => {
  const archive = archiver("zip", {
    zlib: {
      level: 9,
    },
  });

  const output = new PassThrough();
  const chunks = [];

  const outputPromise = new Promise((resolve, reject) => {
    output.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    output.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    output.on("error", reject);
  });

  archive.on("warning", (error) => {
    if (error.code === "ENOENT") {
      return;
    }

    output.destroy(error);
  });

  archive.on("error", (error) => {
    output.destroy(error);
  });

  archive.pipe(output);

  for (const file of files) {
    archive.append(file.content, {
      name: file.path,
    });
  }

  await archive.finalize();

  return outputPromise;
};

const buildOrganizationDataExportPackage = async ({
  organizationId,
  storage,
} = {}) => {
  const databaseExport = await exportOrganizationDatabaseData({
    organizationId,
  });

  /*
   * The attachment service receives only sanitized attachment metadata from
   * the organization-scoped PostgreSQL export.
   *
   * storageKey and other R2 internals are deliberately absent here.
   */
  const attachmentExport = await exportOrganizationAttachmentBinaries({
    organizationId: databaseExport.organizationId,
    attachments: databaseExport.data.attachments,
    storage,
  });

  const portableFiles = buildPortableFiles({
    databaseExport,
    attachmentExport,
  });

  const manifest = buildTopLevelManifest({
    databaseExport,
    attachmentExport,
    portableFiles,
  });

  const manifestContent = createJsonBuffer(manifest);

  const finalFiles = [
    {
      path: "manifest.json",
      content: manifestContent,
      size: manifestContent.length,
      sha256: calculateSha256(manifestContent),
    },
    ...portableFiles,
  ];

  const zipBuffer = await createZipBuffer(finalFiles);

  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new OrganizationDataExportPackageError(
      "Customer data export package could not be generated.",
      "EXPORT_PACKAGE_CREATION_FAILED",
    );
  }

  return {
    fileName: createExportFileName({
      organization: databaseExport.organization,
      exportedAt: databaseExport.exportedAt,
    }),

    mimeType: "application/zip",
    size: zipBuffer.length,
    sha256: calculateSha256(zipBuffer),

    status: manifest.status,
    manifest,

    content: zipBuffer,
  };
};

module.exports = {
  DATASET_FILES,
  OrganizationDataExportPackageError,
  buildOrganizationDataExportPackage,
  buildPortableFiles,
  buildTopLevelManifest,
  createExportFileName,
  createJsonBuffer,
};
