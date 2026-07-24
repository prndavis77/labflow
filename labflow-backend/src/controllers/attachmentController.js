const crypto = require("crypto");

const { Attachment, User, sequelize } = require("../models");

const attachmentConfig = require("../config/attachmentConfig");

const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");

const {
  validateAttachmentId,
  validateAttachmentUploadMetadata,
} = require("../utils/attachmentValidation");

const { createAttachmentStorageKey } = require("../storage/utils/storageKey");

const { getAttachmentStorage } = require("../storage/attachmentStorage");

const { formatAttachmentResponse } = require("../utils/attachmentResponse");

// Replace with your actual audit helper import.
// const { createAuditLog } = require("../utils/auditLog");

const attachmentInclude = [
  {
    model: User,
    as: "uploadedBy",
    attributes: ["id", "name", "email", "role"],
  },
];

const createUploadExpiration = () => {
  return new Date(
    Date.now() + attachmentConfig.pendingUploadTtlMinutes * 60 * 1000,
  );
};

const normalizeStorageMimeType = (value) => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.split(";")[0].trim();
};

const parseStorageContentLength = (value) => {
  const normalizedValue = Number(value);

  if (!Number.isSafeInteger(normalizedValue) || normalizedValue <= 0) {
    return null;
  }

  return normalizedValue;
};

const initiateAttachmentUpload = async (req, res) => {
  let transaction;

  try {
    const validation = validateAttachmentUploadMetadata({
      originalFileName: req.body.originalFileName,
      mimeType: req.body.mimeType,
      fileSize: req.body.fileSize,
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      category: req.body.category,
      description: req.body.description,
    });

    if (!validation.valid) {
      return res.status(400).json({
        status: "error",
        message: validation.error,
      });
    }

    const metadata = validation.value;

    const access = await authorizeAttachmentTarget({
      user: req.user,
      entityType: metadata.entityType,
      entityId: metadata.entityId,
      action: "upload",
    });

    if (!access.allowed) {
      const statusCode = access.reason === "not_found" ? 404 : 403;

      return res.status(statusCode).json({
        status: "error",
        message:
          access.reason === "not_found"
            ? "Attachment target not found."
            : "You do not have permission to upload files to this record.",
      });
    }

    const attachmentId = crypto.randomUUID();

    const storageKey = createAttachmentStorageKey({
      organizationId: req.user.organizationId,
      entityType: metadata.entityType,
      entityId: metadata.entityId,
      attachmentId,
      fileName: metadata.fileName,
    });

    const uploadExpiresAt = createUploadExpiration();

    transaction = await sequelize.transaction();

    const attachment = await Attachment.create(
      {
        id: attachmentId,
        organizationId: req.user.organizationId,
        uploadedById: req.user.id,

        originalFileName: metadata.originalFileName,
        fileName: metadata.fileName,
        fileExtension: metadata.fileExtension,
        mimeType: metadata.mimeType,
        fileSize: metadata.fileSize,
        verifiedFileSize: null,

        storageProvider: attachmentConfig.storageProvider,
        storageKey,
        checksum: null,
        etag: null,

        entityType: metadata.entityType,
        entityId: metadata.entityId,

        category: metadata.category,
        description: metadata.description,

        uploadStatus: "pending",
        uploadExpiresAt,

        isArchived: false,
        archivedAt: null,
        archivedById: null,
      },
      {
        transaction,
      },
    );

    const attachmentStorage = getAttachmentStorage();

    let upload;

    try {
      upload = await attachmentStorage.createUploadUrl({
        storageKey,
        mimeType: metadata.mimeType,
        expiresInSeconds: attachmentConfig.uploadUrlTtlSeconds,
      });
    } catch (storageError) {
      await transaction.rollback();
      transaction = null;

      console.error("Error creating attachment upload URL", storageError);

      return res.status(503).json({
        status: "error",
        message: "File storage is temporarily unavailable.",
      });
    }

    await transaction.commit();
    transaction = null;

    const createdAttachment = await Attachment.findOne({
      where: {
        id: attachment.id,
        organizationId: req.user.organizationId,
      },
      include: attachmentInclude,
    });

    if (!createdAttachment) {
      return res.status(500).json({
        status: "error",
        message:
          "Attachment upload was initiated but the attachment record could not be loaded.",
      });
    }

    // Add your audit event here using the
    // existing LabFlow audit helper.

    return res.status(201).json({
      status: "success",
      data: {
        attachment: formatAttachmentResponse(createdAttachment),
        upload,
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("Error initiating attachment upload", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to initiate attachment upload.",
    });
  }
};

const completeAttachmentUpload = async (req, res) => {
  let transaction;

  try {
    const attachmentIdValidation = validateAttachmentId(req.params.id);

    if (!attachmentIdValidation.valid) {
      return res.status(400).json({
        status: "error",
        message: attachmentIdValidation.error,
      });
    }

    const attachmentId = attachmentIdValidation.value;

    transaction = await sequelize.transaction();

    const attachment = await Attachment.findOne({
      where: {
        id: attachmentId,
        organizationId: req.user.organizationId,
        isArchived: false,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!attachment) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        status: "error",
        message: "Attachment not found.",
      });
    }

    if (
      Number(attachment.uploadedById) !== Number(req.user.id) &&
      req.user.role !== "admin"
    ) {
      await transaction.rollback();
      transaction = null;

      return res.status(403).json({
        status: "error",
        message: "You cannot complete this attachment upload.",
      });
    }

    if (attachment.uploadStatus === "available") {
      await transaction.rollback();
      transaction = null;

      const availableAttachment = await Attachment.findOne({
        where: {
          id: attachment.id,
          organizationId: req.user.organizationId,
        },
        include: attachmentInclude,
      });

      if (!availableAttachment) {
        return res.status(500).json({
          status: "error",
          message: "The completed attachment record could not be loaded.",
        });
      }

      return res.status(200).json({
        status: "success",
        data: {
          attachment: formatAttachmentResponse(availableAttachment),
        },
      });
    }

    if (attachment.uploadStatus !== "pending") {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        status: "error",
        message: "This attachment upload cannot be completed.",
      });
    }

    if (
      !attachment.uploadExpiresAt ||
      new Date(attachment.uploadExpiresAt) < new Date()
    ) {
      attachment.uploadStatus = "failed";
      attachment.uploadExpiresAt = null;

      await attachment.save({
        transaction,
      });

      await transaction.commit();
      transaction = null;

      return res.status(410).json({
        status: "error",
        message: "The attachment upload has expired.",
      });
    }

    const access = await authorizeAttachmentTarget({
      user: req.user,
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      action: "upload",
      transaction,
    });

    if (!access.allowed) {
      await transaction.rollback();
      transaction = null;

      const statusCode = access.reason === "not_found" ? 404 : 403;

      return res.status(statusCode).json({
        status: "error",
        message:
          access.reason === "not_found"
            ? "Attachment target not found."
            : "You no longer have permission to upload files to this record.",
      });
    }

    const attachmentStorage = getAttachmentStorage();

    let objectMetadata;

    try {
      objectMetadata = await attachmentStorage.getObjectMetadata({
        storageKey: attachment.storageKey,
      });
    } catch (storageError) {
      await transaction.rollback();
      transaction = null;

      const isStorageObjectMissing =
        storageError?.name === "NotFound" ||
        storageError?.name === "NoSuchKey" ||
        storageError?.$metadata?.httpStatusCode === 404;

      const statusCode = isStorageObjectMissing ? 409 : 503;

      console.error("Error verifying attachment object", storageError);

      return res.status(statusCode).json({
        status: "error",
        message:
          statusCode === 409
            ? "The uploaded file could not be found in storage."
            : "File storage is temporarily unavailable.",
      });
    }

    const verifiedFileSize = parseStorageContentLength(
      objectMetadata.contentLength,
    );

    if (!verifiedFileSize || verifiedFileSize !== Number(attachment.fileSize)) {
      attachment.uploadStatus = "failed";
      attachment.uploadExpiresAt = null;

      await attachment.save({
        transaction,
      });

      await transaction.commit();
      transaction = null;

      return res.status(422).json({
        status: "error",
        message: "The uploaded file size does not match the expected size.",
      });
    }

    const storedMimeType = normalizeStorageMimeType(objectMetadata.contentType);

    const expectedMimeType = normalizeStorageMimeType(attachment.mimeType);

    if (!storedMimeType || storedMimeType !== expectedMimeType) {
      attachment.uploadStatus = "failed";
      attachment.uploadExpiresAt = null;

      await attachment.save({
        transaction,
      });

      await transaction.commit();
      transaction = null;

      return res.status(422).json({
        status: "error",
        message:
          "The uploaded file type does not match the expected MIME type.",
      });
    }

    attachment.verifiedFileSize = verifiedFileSize;
    attachment.mimeType = storedMimeType;
    attachment.etag = objectMetadata.etag || null;
    attachment.checksum = objectMetadata.checksumSha256 || null;
    attachment.uploadStatus = "available";
    attachment.uploadExpiresAt = null;

    await attachment.save({
      transaction,
    });

    await transaction.commit();
    transaction = null;

    const completedAttachment = await Attachment.findOne({
      where: {
        id: attachment.id,
        organizationId: req.user.organizationId,
      },
      include: attachmentInclude,
    });

    if (!completedAttachment) {
      return res.status(500).json({
        status: "error",
        message:
          "Attachment upload was completed but the attachment record could not be loaded.",
      });
    }

    // Add attachment.upload_completed
    // audit event here.

    return res.status(200).json({
      status: "success",
      data: {
        attachment: formatAttachmentResponse(completedAttachment),
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("Error completing attachment upload", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to complete attachment upload.",
    });
  }
};

module.exports = {
  completeAttachmentUpload,
  initiateAttachmentUpload,
};
