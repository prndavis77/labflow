const crypto = require("crypto");
const { Attachment, User } = require("../models");
const attachmentConfig = require("../config/attachmentConfig");
const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");
const { logError } = require("../utils/errorLogger");
const {
  validateAttachmentCategory,
  validateAttachmentEntityType,
  validateAttachmentId,
  validateAttachmentMetadataUpdate,
  validateAttachmentUploadMetadata,
} = require("../utils/attachmentValidation");
const {
  createAttachmentStagingStorageKey,
  createAttachmentFinalStorageKey,
} = require("../storage/utils/storageKey");
const { getAttachmentStorage } = require("../storage/attachmentStorage");
const { formatAttachmentResponse } = require("../utils/attachmentResponse");
const { writeAuditLog } = require("../utils/auditLogger");
const {
  validateAttachmentContent,
} = require("../utils/attachmentContentValidation");
const {
  validateOoxmlAttachment,
} = require("../utils/attachmentOoxmlValidation");

const sequelize = Attachment.sequelize;

const DEFAULT_ATTACHMENT_PAGE = 1;
const DEFAULT_ATTACHMENT_LIMIT = 20;
const MAX_ATTACHMENT_LIMIT = 100;

const OOXML_ATTACHMENT_EXTENSIONS = new Set([".docx", ".xlsx", ".pptx"]);

const parsePositiveIntegerQuery = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
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

const rejectPendingAttachmentUpload = async ({
  attachment,
  attachmentStorage,
  transaction,
  req,
  event,
  message,
}) => {
  try {
    await attachmentStorage.deleteObject({
      storageKey: attachment.storageKey,
    });

    attachment.uploadStatus = "failed";
    attachment.uploadExpiresAt = null;
  } catch (cleanupError) {
    /*
     * Keep the attachment pending but immediately expired so the scheduled
     * pending-upload cleanup service can retry deleting the storage object.
     */
    attachment.uploadStatus = "pending";
    attachment.uploadExpiresAt = new Date();

    logError(cleanupError, {
      req,
      event,
      message,
      context: {
        attachmentId: attachment.id,
      },
    });
  }

  await attachment.save({
    transaction,
  });
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

    const storageKey = createAttachmentStagingStorageKey({
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
        contentLength: metadata.fileSize,
        expiresInSeconds: attachmentConfig.uploadUrlTtlSeconds,
      });
    } catch (storageError) {
      await transaction.rollback();
      transaction = null;

      logError(storageError, {
        req,
        event: "attachment_upload_url_creation_failed",
        message: "Attachment upload URL creation failed",
        context: {
          attachmentId,
        },
      });

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
      entityId: null,
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

    logError(error, {
      req,
      event: "attachment_upload_init_failed",
      message: "Attachment upload initiation failed",
    });

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

    const attachmentStorage = getAttachmentStorage();

    if (
      !attachment.uploadExpiresAt ||
      new Date(attachment.uploadExpiresAt) < new Date()
    ) {
      await rejectPendingAttachmentUpload({
        attachment,
        attachmentStorage,
        transaction,
        req,
        event: "attachment_expired_upload_cleanup_failed",
        message:
          "Failed to delete storage object for expired attachment upload",
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

      logError(storageError, {
        req,
        event: "attachment_storage_verification_failed",
        message: "Attachment storage verification failed",
        context: {
          attachmentId,
        },
      });

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
      await rejectPendingAttachmentUpload({
        attachment,
        attachmentStorage,
        transaction,
        req,
        event: "attachment_size_mismatch_cleanup_failed",
        message:
          "Failed to delete attachment after file size verification failed",
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
      await rejectPendingAttachmentUpload({
        attachment,
        attachmentStorage,
        transaction,
        req,
        event: "attachment_mime_mismatch_cleanup_failed",
        message:
          "Failed to delete attachment after MIME type verification failed",
      });

      await transaction.commit();
      transaction = null;

      return res.status(422).json({
        status: "error",
        message:
          "The uploaded file type does not match the expected MIME type.",
      });
    }

    let contentValidation;

    try {
      if (OOXML_ATTACHMENT_EXTENSIONS.has(attachment.fileExtension)) {
        contentValidation = await validateOoxmlAttachment({
          storage: attachmentStorage,
          storageKey: attachment.storageKey,
          fileSize: verifiedFileSize,
          fileExtension: attachment.fileExtension,
        });
      } else {
        const inspectionEnd = Math.min(verifiedFileSize - 1, 4095);

        const contentBuffer = await attachmentStorage.getObjectRange({
          storageKey: attachment.storageKey,
          start: 0,
          end: inspectionEnd,
        });

        contentValidation = validateAttachmentContent({
          buffer: contentBuffer,
          fileExtension: attachment.fileExtension,
        });
      }
    } catch (storageError) {
      await transaction.rollback();
      transaction = null;

      logError(storageError, {
        req,
        event: "attachment_content_read_failed",
        message: "Attachment content inspection failed",
        context: {
          attachmentId,
        },
      });

      return res.status(503).json({
        status: "error",
        message: "File storage is temporarily unavailable.",
      });
    }

    if (!contentValidation.valid) {
      await rejectPendingAttachmentUpload({
        attachment,
        attachmentStorage,
        transaction,
        req,
        event: "attachment_content_mismatch_cleanup_failed",
        message:
          "Failed to delete attachment after content verification failed",
      });

      await transaction.commit();
      transaction = null;

      return res.status(422).json({
        status: "error",
        message: contentValidation.error,
      });
    }

    const stagingStorageKey = attachment.storageKey;

    const verifiedStagingEtag = objectMetadata.etag || null;

    if (!verifiedStagingEtag) {
      await transaction.rollback();
      transaction = null;

      return res.status(503).json({
        status: "error",
        message:
          "The uploaded file could not be safely finalized because storage verification was incomplete.",
      });
    }

    const finalStorageKey = createAttachmentFinalStorageKey({
      organizationId: req.user.organizationId,
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      attachmentId: attachment.id,
      fileName: attachment.fileName,
    });

    let finalizationResult;

    try {
      finalizationResult = await attachmentStorage.finalizeObject({
        sourceStorageKey: stagingStorageKey,
        destinationStorageKey: finalStorageKey,
        expectedEtag: verifiedStagingEtag,
        contentType: storedMimeType,
      });
    } catch (storageError) {
      await transaction.rollback();
      transaction = null;

      const isPreconditionFailure =
        storageError?.name === "PreconditionFailed" ||
        storageError?.$metadata?.httpStatusCode === 412;

      logError(storageError, {
        req,
        event: "attachment_finalization_failed",
        message: "Attachment storage finalization failed",
        context: {
          attachmentId,
        },
      });

      return res.status(isPreconditionFailure ? 409 : 503).json({
        status: "error",
        message: isPreconditionFailure
          ? "The uploaded file changed during verification. Please retry the upload."
          : "File storage is temporarily unavailable.",
      });
    }

    let finalObjectMetadata;

    try {
      finalObjectMetadata = await attachmentStorage.getObjectMetadata({
        storageKey: finalStorageKey,
      });
    } catch (storageError) {
      /*
       * The copy succeeded, but we could not verify the final object.
       * Best-effort cleanup prevents an unreferenced permanent object.
       */
      try {
        await attachmentStorage.deleteObject({
          storageKey: finalStorageKey,
        });
      } catch (cleanupError) {
        logError(cleanupError, {
          req,
          event: "attachment_final_object_cleanup_failed",
          message: "Failed to delete unverified finalized attachment object",
          context: {
            attachmentId,
          },
        });
      }

      await transaction.rollback();
      transaction = null;

      logError(storageError, {
        req,
        event: "attachment_final_object_verification_failed",
        message: "Finalized attachment verification failed",
        context: {
          attachmentId,
        },
      });

      return res.status(503).json({
        status: "error",
        message: "File storage is temporarily unavailable.",
      });
    }

    const finalVerifiedFileSize = parseStorageContentLength(
      finalObjectMetadata.contentLength,
    );

    const finalStoredMimeType = normalizeStorageMimeType(
      finalObjectMetadata.contentType,
    );

    if (
      !finalVerifiedFileSize ||
      finalVerifiedFileSize !== verifiedFileSize ||
      !finalStoredMimeType ||
      finalStoredMimeType !== storedMimeType
    ) {
      try {
        await attachmentStorage.deleteObject({
          storageKey: finalStorageKey,
        });
      } catch (cleanupError) {
        logError(cleanupError, {
          req,
          event: "attachment_invalid_final_object_cleanup_failed",
          message:
            "Failed to delete attachment after final object verification failed",
          context: {
            attachmentId,
          },
        });
      }

      await transaction.rollback();
      transaction = null;

      return res.status(503).json({
        status: "error",
        message: "The finalized file could not be safely verified.",
      });
    }

    try {
      await attachmentStorage.deleteObject({
        storageKey: stagingStorageKey,
      });
    } catch (storageError) {
      /*
       * Do not expose the finalized object through LabFlow until the staging
       * object has been removed. Otherwise the still-valid presigned PUT URL
       * could continue writing to an abandoned staging object.
       */
      try {
        await attachmentStorage.deleteObject({
          storageKey: finalStorageKey,
        });
      } catch (cleanupError) {
        logError(cleanupError, {
          req,
          event: "attachment_final_object_cleanup_failed",
          message:
            "Failed to delete finalized attachment after staging cleanup failed",
          context: {
            attachmentId,
          },
        });
      }

      await transaction.rollback();
      transaction = null;

      logError(storageError, {
        req,
        event: "attachment_staging_cleanup_failed",
        message:
          "Failed to delete attachment staging object after finalization",
        context: {
          attachmentId,
        },
      });

      return res.status(503).json({
        status: "error",
        message: "File storage is temporarily unavailable.",
      });
    }

    attachment.storageKey = finalStorageKey;
    attachment.verifiedFileSize = finalVerifiedFileSize;
    attachment.mimeType = finalStoredMimeType;
    attachment.etag =
      finalObjectMetadata.etag || finalizationResult?.etag || null;
    attachment.checksum = finalObjectMetadata.checksumSha256 || null;
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
      entityId: null,
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

    logError(error, {
      req,
      event: "attachment_upload_completion_failed",
      message: "Attachment upload completion failed",
      context: {
        attachmentId: req.params.id,
      },
    });

    return res.status(500).json({
      status: "error",
      message: "Unable to complete attachment upload.",
    });
  }
};

const canManageAttachmentRecord = ({ user, attachment }) => {
  if (user.role === "admin") {
    return true;
  }

  if (user.role === "supervisor") {
    return true;
  }

  return (
    user.role === "researcher" &&
    Number(attachment.uploadedById) === Number(user.id)
  );
};

const listAttachments = async (req, res) => {
  try {
    if (req.query.entityType === undefined || req.query.entityType === "") {
      return res.status(400).json({
        status: "error",
        message: "entityType is required.",
      });
    }

    const entityTypeValidation = validateAttachmentEntityType(
      req.query.entityType,
    );

    if (!entityTypeValidation.valid) {
      return res.status(400).json({
        status: "error",
        message: entityTypeValidation.error,
      });
    }

    const entityType = entityTypeValidation.value;

    const entityId = parsePositiveIntegerQuery(req.query.entityId, null);

    if (entityId === null) {
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

    let category = null;

    if (
      req.query.category !== undefined &&
      req.query.category !== null &&
      req.query.category !== ""
    ) {
      const categoryValidation = validateAttachmentCategory(req.query.category);

      if (!categoryValidation.valid) {
        return res.status(400).json({
          status: "error",
          message: categoryValidation.error,
        });
      }

      category = categoryValidation.value;
    }

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
    logError(error, {
      req,
      event: "attachment_list_failed",
      message: "Attachment list failed",
    });

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
    logError(error, {
      req,
      event: "attachment_load_failed",
      message: "Attachment load failed",
      context: {
        attachmentId: req.params.id,
      },
    });

    return res.status(500).json({
      status: "error",
      message: "Unable to load attachment.",
    });
  }
};

const createAttachmentDownloadUrl = async (req, res) => {
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
            : "You do not have permission to download this attachment.",
      });
    }

    const attachmentStorage = getAttachmentStorage();

    try {
      await attachmentStorage.getObjectMetadata({
        storageKey: attachment.storageKey,
      });
    } catch (storageError) {
      const isStorageObjectMissing =
        storageError?.name === "NotFound" ||
        storageError?.name === "NoSuchKey" ||
        storageError?.$metadata?.httpStatusCode === 404;

      logError(storageError, {
        req,
        event: "attachment_download_storage_verification_failed",
        message: "Attachment storage verification before download failed",
        context: {
          attachmentId,
        },
      });

      return res.status(isStorageObjectMissing ? 404 : 503).json({
        status: "error",
        message: isStorageObjectMissing
          ? "The attachment file could not be found in storage."
          : "File storage is temporarily unavailable.",
      });
    }

    let download;

    try {
      download = await attachmentStorage.createDownloadUrl({
        storageKey: attachment.storageKey,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        expiresInSeconds: attachmentConfig.downloadUrlTtlSeconds,
      });
    } catch (storageError) {
      logError(storageError, {
        req,
        event: "attachment_download_url_storage_failed",
        message: "Attachment download URL creation failed",
        context: {
          attachmentId,
        },
      });

      return res.status(503).json({
        status: "error",
        message: "File storage is temporarily unavailable.",
      });
    }

    await writeAuditLog({
      req,
      action: "attachment.download_url_created",
      entityType: "attachment",
      entityId: null,
      summary: `Download URL created for ${attachment.originalFileName}.`,
      metadata: {
        attachmentId: attachment.id,
        targetEntityType: attachment.entityType,
        targetEntityId: attachment.entityId,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        fileSize: Number(attachment.fileSize),
        category: attachment.category,
      },
    });

    return res.status(200).json({
      status: "success",
      data: {
        attachment: formatAttachmentResponse(attachment),
        download,
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "attachment_download_url_failed",
      message: "Attachment download URL request failed",
      context: {
        attachmentId: req.params.id,
      },
    });

    return res.status(500).json({
      status: "error",
      message: "Unable to create attachment download URL.",
    });
  }
};

const updateAttachmentMetadata = async (req, res) => {
  let transaction;

  try {
    const attachmentIdValidation = validateAttachmentId(req.params.id);

    if (!attachmentIdValidation.valid) {
      return res.status(400).json({
        status: "error",
        message: attachmentIdValidation.error,
      });
    }

    const metadataValidation = validateAttachmentMetadataUpdate({
      category: req.body.category,
      description: req.body.description,
    });

    if (!metadataValidation.valid) {
      return res.status(400).json({
        status: "error",
        message: metadataValidation.error,
      });
    }

    const attachmentId = attachmentIdValidation.value;

    transaction = await sequelize.transaction();

    const attachment = await Attachment.findOne({
      where: {
        id: attachmentId,
        organizationId: req.user.organizationId,
        uploadStatus: "available",
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

    const access = await authorizeAttachmentTarget({
      user: req.user,
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      action: "update",
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
            : "You do not have permission to update this attachment.",
      });
    }

    if (
      !canManageAttachmentRecord({
        user: req.user,
        attachment,
      })
    ) {
      await transaction.rollback();
      transaction = null;

      return res.status(403).json({
        status: "error",
        message: "You can only update attachments that you uploaded.",
      });
    }

    const previousMetadata = {
      category: attachment.category,
      description: attachment.description,
    };

    Object.assign(attachment, metadataValidation.value);

    await attachment.save({
      transaction,
    });

    await transaction.commit();
    transaction = null;

    const updatedAttachment = await Attachment.findOne({
      where: {
        id: attachment.id,
        organizationId: req.user.organizationId,
        uploadStatus: "available",
        isArchived: false,
      },
      include: attachmentInclude,
    });

    if (!updatedAttachment) {
      return res.status(500).json({
        status: "error",
        message: "The attachment was updated but could not be reloaded.",
      });
    }

    await writeAuditLog({
      req,
      action: "attachment.metadata_updated",
      entityType: "attachment",
      entityId: null,
      summary: `Attachment metadata updated for ${updatedAttachment.originalFileName}.`,
      metadata: {
        attachmentId: updatedAttachment.id,
        targetEntityType: updatedAttachment.entityType,
        targetEntityId: updatedAttachment.entityId,
        originalFileName: updatedAttachment.originalFileName,
        previousMetadata,
        updatedMetadata: {
          category: updatedAttachment.category,
          description: updatedAttachment.description,
        },
      },
    });

    return res.status(200).json({
      status: "success",
      data: {
        attachment: formatAttachmentResponse(updatedAttachment),
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    logError(error, {
      req,
      event: "attachment_metadata_update_failed",
      message: "Attachment metadata update failed",
      context: {
        attachmentId: req.params.id,
      },
    });

    return res.status(500).json({
      status: "error",
      message: "Unable to update attachment metadata.",
    });
  }
};

const archiveAttachment = async (req, res) => {
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

    const access = await authorizeAttachmentTarget({
      user: req.user,
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      action: "archive",
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
            : "You do not have permission to archive this attachment.",
      });
    }

    if (
      !canManageAttachmentRecord({
        user: req.user,
        attachment,
      })
    ) {
      await transaction.rollback();
      transaction = null;

      return res.status(403).json({
        status: "error",
        message: "You can only archive attachments that you uploaded.",
      });
    }

    if (attachment.isArchived) {
      await transaction.rollback();
      transaction = null;

      return res.status(200).json({
        status: "success",
        data: {
          attachment: formatAttachmentResponse(attachment),
        },
      });
    }

    if (attachment.uploadStatus !== "available") {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        status: "error",
        message: "Only available attachments can be archived.",
      });
    }

    attachment.isArchived = true;
    attachment.archivedAt = new Date();
    attachment.archivedById = req.user.id;

    await attachment.save({
      transaction,
    });

    await transaction.commit();
    transaction = null;

    const archivedAttachment = await Attachment.findOne({
      where: {
        id: attachment.id,
        organizationId: req.user.organizationId,
      },
      include: attachmentInclude,
    });

    if (!archivedAttachment) {
      return res.status(500).json({
        status: "error",
        message: "The attachment was archived but could not be reloaded.",
      });
    }

    await writeAuditLog({
      req,
      action: "attachment.archived",
      entityType: "attachment",
      entityId: null,
      summary: `Attachment archived: ${archivedAttachment.originalFileName}.`,
      metadata: {
        attachmentId: archivedAttachment.id,
        targetEntityType: archivedAttachment.entityType,
        targetEntityId: archivedAttachment.entityId,
        originalFileName: archivedAttachment.originalFileName,
        archivedById: req.user.id,
      },
    });

    return res.status(200).json({
      status: "success",
      data: {
        attachment: formatAttachmentResponse(archivedAttachment),
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    logError(error, {
      req,
      event: "attachment_archive_failed",
      message: "Attachment archive failed",
      context: {
        attachmentId: req.params.id,
      },
    });

    return res.status(500).json({
      status: "error",
      message: "Unable to archive attachment.",
    });
  }
};

module.exports = {
  archiveAttachment,
  completeAttachmentUpload,
  createAttachmentDownloadUrl,
  getAttachmentById,
  initiateAttachmentUpload,
  listAttachments,
  updateAttachmentMetadata,
};
