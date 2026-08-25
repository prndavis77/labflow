"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");

const { Attachment } = require("../models");
const { getAttachmentStorage } = require("../storage/attachmentStorage");
const {
  createOrganizationStoragePrefix,
} = require("../storage/utils/storageKey");

class OrganizationAttachmentExportError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OrganizationAttachmentExportError";
    this.code = code;
  }
}

const normalizeOrganizationId = (organizationId) => {
  const normalizedOrganizationId = Number(organizationId);

  if (
    !Number.isSafeInteger(normalizedOrganizationId) ||
    normalizedOrganizationId <= 0
  ) {
    throw new OrganizationAttachmentExportError(
      "organizationId must be a positive integer.",
      "INVALID_ORGANIZATION_ID",
    );
  }

  return normalizedOrganizationId;
};

const normalizeAttachmentId = (attachmentId) => {
  const normalizedAttachmentId = String(attachmentId || "").trim();

  if (!normalizedAttachmentId) {
    throw new OrganizationAttachmentExportError(
      "Attachment ID is required.",
      "INVALID_ATTACHMENT_ID",
    );
  }

  return normalizedAttachmentId;
};

const assertStorageSupportsExport = (storage) => {
  if (!storage || typeof storage.getObjectMetadata !== "function") {
    throw new OrganizationAttachmentExportError(
      "Attachment storage does not support object metadata reads.",
      "STORAGE_METADATA_READ_UNSUPPORTED",
    );
  }

  if (typeof storage.getObjectRange !== "function") {
    throw new OrganizationAttachmentExportError(
      "Attachment storage does not support object reads.",
      "STORAGE_OBJECT_READ_UNSUPPORTED",
    );
  }
};

const sanitizeExportFileName = (fileName) => {
  const original = String(fileName || "").trim();

  const leafName = original.split(/[\\/]/).pop() || "attachment";

  const sanitized = leafName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 180);

  return sanitized || "attachment";
};

const buildAttachmentExportPath = ({ attachmentId, originalFileName }) => {
  const normalizedAttachmentId = normalizeAttachmentId(attachmentId);

  const safeFileName = sanitizeExportFileName(originalFileName);

  return `attachments/files/${normalizedAttachmentId}/${safeFileName}`;
};

const normalizeExpectedSize = (attachment) => {
  const preferredSize =
    attachment.verifiedFileSize !== undefined &&
    attachment.verifiedFileSize !== null
      ? Number(attachment.verifiedFileSize)
      : Number(attachment.fileSize);

  if (!Number.isSafeInteger(preferredSize) || preferredSize <= 0) {
    return null;
  }

  return preferredSize;
};

const calculateSha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const normalizeChecksum = (checksum) => {
  const normalizedChecksum = String(checksum || "")
    .trim()
    .toLowerCase();

  if (!normalizedChecksum) {
    return null;
  }

  /*
   * Only compare a checksum when LabFlow's stored value is an ordinary
   * hexadecimal SHA-256 digest.
   *
   * Other checksum representations may be supported later through an
   * explicitly versioned checksum policy.
   */
  if (!/^[a-f0-9]{64}$/.test(normalizedChecksum)) {
    return null;
  }

  return normalizedChecksum;
};

const buildBaseManifestEntry = ({
  attachment,
  internalAttachment,
  exportPath,
}) => ({
  attachmentId: attachment.id,
  originalFileName: attachment.originalFileName,
  exportPath,
  mimeType: attachment.mimeType,
  expectedFileSize: normalizeExpectedSize(attachment),
  storageFileSize: null,
  exportedFileSize: null,
  sha256: null,
  storedChecksum: attachment.checksum || null,
  status: "pending",
  reason: null,
  entityType: attachment.entityType,
  entityId: attachment.entityId,
  category: attachment.category,
  isArchived: attachment.isArchived === true,
  uploadStatus: attachment.uploadStatus,
  storageObjectPresent: Boolean(internalAttachment),
});

const getInternalAttachmentRows = async ({
  organizationId,
  attachmentIds,
  transaction,
}) => {
  if (attachmentIds.length === 0) {
    return [];
  }

  return Attachment.findAll({
    attributes: [
      "id",
      "organizationId",
      "storageKey",
      "uploadStatus",
      "fileSize",
      "verifiedFileSize",
      "checksum",
    ],
    where: {
      organizationId,
      id: {
        [Op.in]: attachmentIds,
      },
    },
    transaction,
    raw: true,
  });
};

const exportSingleAttachment = async ({
  attachment,
  internalAttachment,
  organizationPrefix,
  storage,
}) => {
  const exportPath = buildAttachmentExportPath({
    attachmentId: attachment.id,
    originalFileName: attachment.originalFileName,
  });

  const manifestEntry = buildBaseManifestEntry({
    attachment,
    internalAttachment,
    exportPath,
  });

  if (!internalAttachment) {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "DATABASE_ATTACHMENT_NOT_FOUND",
      },
      file: null,
    };
  }

  if (attachment.uploadStatus !== "available") {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "ATTACHMENT_NOT_AVAILABLE",
      },
      file: null,
    };
  }

  const storageKey = String(internalAttachment.storageKey || "");

  if (!storageKey.startsWith(organizationPrefix)) {
    throw new OrganizationAttachmentExportError(
      "Attachment storage key is outside the requested organization namespace.",
      "ORGANIZATION_STORAGE_PREFIX_MISMATCH",
    );
  }

  let metadata;

  try {
    metadata = await storage.getObjectMetadata({
      storageKey,
    });
  } catch {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "STORAGE_OBJECT_UNAVAILABLE",
        storageObjectPresent: false,
      },
      file: null,
    };
  }

  const storageFileSize = Number(metadata.contentLength);

  if (!Number.isSafeInteger(storageFileSize) || storageFileSize <= 0) {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "INVALID_STORAGE_OBJECT_SIZE",
        storageFileSize: Number.isFinite(storageFileSize)
          ? storageFileSize
          : null,
      },
      file: null,
    };
  }

  const expectedFileSize = normalizeExpectedSize(attachment);

  if (expectedFileSize !== null && storageFileSize !== expectedFileSize) {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "FILE_SIZE_MISMATCH",
        storageFileSize,
      },
      file: null,
    };
  }

  let content;

  try {
    content = await storage.getObjectRange({
      storageKey,
      start: 0,
      end: storageFileSize - 1,
    });
  } catch {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "STORAGE_OBJECT_READ_FAILED",
        storageFileSize,
      },
      file: null,
    };
  }

  if (!Buffer.isBuffer(content)) {
    content = Buffer.from(content);
  }

  if (content.length !== storageFileSize) {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "EXPORTED_FILE_SIZE_MISMATCH",
        storageFileSize,
        exportedFileSize: content.length,
      },
      file: null,
    };
  }

  const sha256 = calculateSha256(content);
  const storedChecksum = normalizeChecksum(attachment.checksum);

  if (storedChecksum && storedChecksum !== sha256) {
    return {
      manifestEntry: {
        ...manifestEntry,
        status: "not_exported",
        reason: "CHECKSUM_MISMATCH",
        storageFileSize,
        exportedFileSize: content.length,
        sha256,
      },
      file: null,
    };
  }

  return {
    manifestEntry: {
      ...manifestEntry,
      status: "exported",
      reason: null,
      storageObjectPresent: true,
      storageFileSize,
      exportedFileSize: content.length,
      sha256,
    },

    file: {
      attachmentId: attachment.id,
      exportPath,
      content,
    },
  };
};

const exportOrganizationAttachmentBinaries = async ({
  organizationId,
  attachments,
  storage = getAttachmentStorage(),
  transaction,
} = {}) => {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);

  if (!Array.isArray(attachments)) {
    throw new OrganizationAttachmentExportError(
      "attachments must be an array.",
      "INVALID_ATTACHMENTS",
    );
  }

  assertStorageSupportsExport(storage);

  const organizationPrefix = createOrganizationStoragePrefix({
    organizationId: normalizedOrganizationId,
  });

  /*
   * The attachment list is supplied by the organization-scoped PostgreSQL
   * export. Do not independently enumerate the R2 namespace and treat every
   * object found there as customer-exportable.
   */
  const normalizedAttachments = attachments.map((attachment) => {
    if (!attachment || typeof attachment !== "object") {
      throw new OrganizationAttachmentExportError(
        "Every attachment export record must be an object.",
        "INVALID_ATTACHMENT_RECORD",
      );
    }

    const attachmentId = normalizeAttachmentId(attachment.id);
    const attachmentOrganizationId = Number(attachment.organizationId);

    if (attachmentOrganizationId !== normalizedOrganizationId) {
      throw new OrganizationAttachmentExportError(
        "Attachment record does not belong to the requested organization.",
        "ATTACHMENT_ORGANIZATION_MISMATCH",
      );
    }

    return {
      ...attachment,
      id: attachmentId,
    };
  });

  const attachmentIds = normalizedAttachments.map(
    (attachment) => attachment.id,
  );

  if (new Set(attachmentIds).size !== attachmentIds.length) {
    throw new OrganizationAttachmentExportError(
      "Duplicate attachment IDs were supplied for export.",
      "DUPLICATE_ATTACHMENT_ID",
    );
  }

  const internalRows = await getInternalAttachmentRows({
    organizationId: normalizedOrganizationId,
    attachmentIds,
    transaction,
  });

  const internalRowsById = new Map(
    internalRows.map((attachment) => [String(attachment.id), attachment]),
  );

  const manifestEntries = [];
  const files = [];

  /*
   * Export sequentially for the pilot implementation.
   *
   * This avoids creating a large burst of simultaneous R2 reads and keeps
   * memory/network behavior predictable. Attachment files are already bounded
   * by LabFlow's upload-size policy.
   */
  for (const attachment of normalizedAttachments) {
    const result = await exportSingleAttachment({
      attachment,
      internalAttachment: internalRowsById.get(attachment.id),
      organizationPrefix,
      storage,
    });

    manifestEntries.push(result.manifestEntry);

    if (result.file) {
      files.push(result.file);
    }
  }

  const exportedCount = manifestEntries.filter(
    (entry) => entry.status === "exported",
  ).length;

  const notExportedCount = manifestEntries.length - exportedCount;

  return {
    manifest: {
      manifestVersion: 1,
      organizationId: normalizedOrganizationId,
      generatedAt: new Date().toISOString(),
      attachmentCount: manifestEntries.length,
      exportedCount,
      notExportedCount,
      totalExportedBytes: files.reduce(
        (total, file) => total + file.content.length,
        0,
      ),
      entries: manifestEntries,
    },

    files,
  };
};

module.exports = {
  OrganizationAttachmentExportError,
  buildAttachmentExportPath,
  exportOrganizationAttachmentBinaries,
  sanitizeExportFileName,
};
