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

const { writeAuditLog } = require("../utils/auditLogger");

const DEFAULT_ATTACHMENT_PAGE = 1;
const DEFAULT_ATTACHMENT_LIMIT = 20;
const MAX_ATTACHMENT_LIMIT = 100;

const parsePositiveIntegerQuery = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const normalizeAttachmentCategory = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim().toLowerCase();
};

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

    await writeAuditLog({
      req,
      action: "attachment.upload_initiated",
      entityType: "attachment",
      entityId: createdAttachment.id,
      summary: `Attachment upload initiated for ${createdAttachment.originalFileName}.`,
      metadata: {
        attachmentId: createdAttachment.id,
        targetEntityType: createdAttachment.entityType,
        targetEntityId: createdAttachment.entityId,
        originalFileName: createdAttachment.originalFileName,
        mimeType: createdAttachment.mimeType,
        fileSize: Number(createdAttachment.fileSize),
        category: createdAttachment.category,
      },
    });

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

    await writeAuditLog({
      req,
      action: "attachment.upload_completed",
      entityType: "attachment",
      entityId: completedAttachment.id,
      summary: `Attachment upload completed for ${completedAttachment.originalFileName}.`,
      metadata: {
        attachmentId: completedAttachment.id,
        targetEntityType: completedAttachment.entityType,
        targetEntityId: completedAttachment.entityId,
        originalFileName: completedAttachment.originalFileName,
        mimeType: completedAttachment.mimeType,
        fileSize: Number(completedAttachment.fileSize),
        verifiedFileSize: Number(completedAttachment.verifiedFileSize),
        category: completedAttachment.category,
      },
    });

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

const listAttachments = async (req, res) => {
  try {
    const entityType = String(req.query.entityType || "")
      .trim()
      .toLowerCase();

    const entityId = Number(req.query.entityId);

    if (!entityType) {
      return res.status(400).json({
        status: "error",
        message: "entityType is required.",
      });
    }

    if (!Number.isSafeInteger(entityId) || entityId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "entityId must be a positive integer.",
      });
    }

    const page = parsePositiveIntegerQuery(
      req.query.page,
      DEFAULT_ATTACHMENT_PAGE,
    );

    if (!page) {
      return res.status(400).json({
        status: "error",
        message: "page must be a positive integer.",
      });
    }

    const requestedLimit = parsePositiveIntegerQuery(
      req.query.limit,
      DEFAULT_ATTACHMENT_LIMIT,
    );

    if (!requestedLimit) {
      return res.status(400).json({
        status: "error",
        message: "limit must be a positive integer.",
      });
    }

    const limit = Math.min(requestedLimit, MAX_ATTACHMENT_LIMIT);

    const offset = (page - 1) * limit;

    const category = normalizeAttachmentCategory(req.query.category);

    const access = await authorizeAttachmentTarget({
      user: req.user,
      entityType,
      entityId,
      action: "view",
    });

    if (!access.allowed) {
      const statusCode = access.reason === "not_found" ? 404 : 403;

      return res.status(statusCode).json({
        status: "error",
        message:
          access.reason === "not_found"
            ? "Attachment target not found."
            : "You do not have permission to view attachments for this record.",
      });
    }

    const where = {
      organizationId: req.user.organizationId,
      entityType,
      entityId,
      uploadStatus: "available",
      isArchived: false,
    };

    if (category) {
      where.category = category;
    }

    const result = await Attachment.findAndCountAll({
      where,

      include: attachmentInclude,

      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],

      limit,
      offset,

      distinct: true,
    });

    const totalItems = Number(result.count) || 0;

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return res.status(200).json({
      status: "success",

      data: {
        attachments: result.rows.map(formatAttachmentResponse),

        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Error listing attachments", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to load attachments.",
    });
  }
};

const getAttachmentById = async (req, res) => {
  try {
    const attachmentIdValidation = validateAttachmentId(req.params.id);

    if (!attachmentIdValidation.valid) {
      return res.status(400).json({
        status: "error",
        message: attachmentIdValidation.error,
      });
    }

    const attachmentId = attachmentIdValidation.value;

    const attachment = await Attachment.findOne({
      where: {
        id: attachmentId,

        organizationId: req.user.organizationId,

        uploadStatus: "available",
        isArchived: false,
      },

      include: attachmentInclude,
    });

    if (!attachment) {
      return res.status(404).json({
        status: "error",
        message: "Attachment not found.",
      });
    }

    const access = await authorizeAttachmentTarget({
      user: req.user,

      entityType: attachment.entityType,

      entityId: attachment.entityId,

      action: "view",
    });

    if (!access.allowed) {
      const statusCode = access.reason === "not_found" ? 404 : 403;

      return res.status(statusCode).json({
        status: "error",

        message:
          access.reason === "not_found"
            ? "Attachment target not found."
            : "You do not have permission to view this attachment.",
      });
    }

    return res.status(200).json({
      status: "success",

      data: {
        attachment: formatAttachmentResponse(attachment),
      },
    });
  } catch (error) {
    console.error("Error loading attachment", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to load attachment.",
    });
  }
};

module.exports = {
  completeAttachmentUpload,
  initiateAttachmentUpload,
  listAttachments,
  getAttachmentById,
};
