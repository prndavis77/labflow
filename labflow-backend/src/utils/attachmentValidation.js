const path = require("path");
const attachmentConfig = require("../config/attachmentConfig");

const {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_MAX_DESCRIPTION_LENGTH,
  ATTACHMENT_MAX_ORIGINAL_FILE_NAME_LENGTH,
  ATTACHMENT_MAX_SAFE_FILE_NAME_LENGTH,
  BLOCKED_ATTACHMENT_EXTENSIONS,
  MIME_TYPES_BY_EXTENSION,
} = require("../constants/attachments");

const normalizeString = (value) => String(value ?? "").trim();

const normalizeMimeType = (value) => {
  return normalizeString(value).toLowerCase();
};

const getNormalizedFileExtension = (fileName) => {
  const normalizedFileName = normalizeString(fileName);

  if (!normalizedFileName) {
    return "";
  }

  return path.extname(normalizedFileName).toLowerCase();
};

const sanitizeAttachmentFileName = (fileName) => {
  const normalizedFileName = normalizeString(fileName);

  if (!normalizedFileName) {
    return "";
  }

  const extension = getNormalizedFileExtension(normalizedFileName);

  const baseName = extension
    ? normalizedFileName.slice(0, -extension.length)
    : normalizedFileName;

  const sanitizedBaseName = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  const fallbackBaseName = sanitizedBaseName || "attachment";

  const maxBaseLength = Math.max(
    1,
    ATTACHMENT_MAX_SAFE_FILE_NAME_LENGTH - extension.length,
  );

  const truncatedBaseName = fallbackBaseName
    .slice(0, maxBaseLength)
    .replace(/[-_]+$/g, "");

  return `${truncatedBaseName || "attachment"}${extension}`;
};

const validateOriginalFileName = (fileName) => {
  if (typeof fileName !== "string") {
    return {
      valid: false,
      error: "File name must be a string.",
    };
  }

  const normalizedFileName = normalizeString(fileName);

  if (!normalizedFileName) {
    return {
      valid: false,
      error: "File name is required.",
    };
  }

  if (normalizedFileName.length > ATTACHMENT_MAX_ORIGINAL_FILE_NAME_LENGTH) {
    return {
      valid: false,
      error: `File name cannot exceed ${ATTACHMENT_MAX_ORIGINAL_FILE_NAME_LENGTH} characters.`,
    };
  }

  if (normalizedFileName.includes("/") || normalizedFileName.includes("\\")) {
    return {
      valid: false,
      error: "File name cannot contain directory paths.",
    };
  }

  if (normalizedFileName === "." || normalizedFileName === "..") {
    return {
      valid: false,
      error: "Invalid file name.",
    };
  }

  if (/[\u0000-\u001f\u007f]/.test(normalizedFileName)) {
    return {
      valid: false,
      error: "File name contains unsupported control characters.",
    };
  }

  return {
    valid: true,
    value: normalizedFileName,
  };
};

const validateFileExtension = (fileName) => {
  const extension = getNormalizedFileExtension(fileName);

  if (!extension) {
    return {
      valid: false,
      error: "The file must have an extension.",
    };
  }

  if (BLOCKED_ATTACHMENT_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Files with the ${extension} extension are not allowed.`,
    };
  }

  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Files with the ${extension} extension are not supported.`,
    };
  }

  return {
    valid: true,
    value: extension,
  };
};

const validateMimeType = (mimeType) => {
  if (typeof mimeType !== "string") {
    return {
      valid: false,
      error: "MIME type must be a string.",
    };
  }

  const normalizedMimeType = normalizeMimeType(mimeType);

  if (!normalizedMimeType) {
    return {
      valid: false,
      error: "MIME type is required.",
    };
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(normalizedMimeType)) {
    return {
      valid: false,
      error: `Files with MIME type ${normalizedMimeType} are not supported.`,
    };
  }

  return {
    valid: true,
    value: normalizedMimeType,
  };
};

const validateExtensionMimeTypePair = ({ fileName, mimeType }) => {
  const extension = getNormalizedFileExtension(fileName);
  const normalizedMimeType = normalizeMimeType(mimeType);

  const allowedMimeTypes = MIME_TYPES_BY_EXTENSION[extension];

  if (!allowedMimeTypes) {
    return {
      valid: false,
      error: `No MIME type rules exist for ${extension || "this file type"}.`,
    };
  }

  if (!allowedMimeTypes.includes(normalizedMimeType)) {
    return {
      valid: false,
      error: `The MIME type ${normalizedMimeType} does not match the ${extension} extension.`,
    };
  }

  return {
    valid: true,
  };
};

const validateFileSize = (fileSize) => {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return {
      valid: false,
      error: "File size must be a positive integer.",
    };
  }

  const normalizedFileSize = fileSize;

  const maximumSizeMb = attachmentConfig.maxFileSizeBytes / 1024 / 1024;

  if (normalizedFileSize > attachmentConfig.maxFileSizeBytes) {
    return {
      valid: false,
      error: `File size cannot exceed ${maximumSizeMb} MB.`,
    };
  }

  return {
    valid: true,
    value: normalizedFileSize,
  };
};

const validateAttachmentEntityType = (entityType) => {
  if (typeof entityType !== "string") {
    return {
      valid: false,
      error: "Attachment entity type must be a string.",
    };
  }

  const normalizedEntityType = normalizeString(entityType).toLowerCase();

  if (!ATTACHMENT_ENTITY_TYPES.includes(normalizedEntityType)) {
    return {
      valid: false,
      error: "Invalid attachment entity type.",
    };
  }

  return {
    valid: true,
    value: normalizedEntityType,
  };
};

const validateAttachmentEntityId = (entityId) => {
  if (!Number.isSafeInteger(entityId) || entityId <= 0) {
    return {
      valid: false,
      error: "Attachment entity ID must be a positive integer.",
    };
  }

  const normalizedEntityId = entityId;

  return {
    valid: true,
    value: normalizedEntityId,
  };
};

const validateAttachmentCategory = (category) => {
  if (
    category !== undefined &&
    category !== null &&
    typeof category !== "string"
  ) {
    return {
      valid: false,
      error: "Attachment category must be a string.",
    };
  }

  const normalizedCategory = normalizeString(category || "other").toLowerCase();

  if (!ATTACHMENT_CATEGORIES.includes(normalizedCategory)) {
    return {
      valid: false,
      error: "Invalid attachment category.",
    };
  }

  return {
    valid: true,
    value: normalizedCategory,
  };
};

const validateAttachmentDescription = (description) => {
  if (description === undefined || description === null) {
    return {
      valid: true,
      value: null,
    };
  }

  if (typeof description !== "string") {
    return {
      valid: false,
      error: "Attachment description must be a string or null.",
    };
  }

  const normalizedDescription = description.trim();

  if (!normalizedDescription) {
    return {
      valid: true,
      value: null,
    };
  }

  if (normalizedDescription.length > ATTACHMENT_MAX_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      error: `Description cannot exceed ${ATTACHMENT_MAX_DESCRIPTION_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    value: normalizedDescription,
  };
};

const validateAttachmentUploadMetadata = ({
  originalFileName,
  mimeType,
  fileSize,
  entityType,
  entityId,
  category,
  description,
}) => {
  const validations = {
    originalFileName: validateOriginalFileName(originalFileName),
    extension: validateFileExtension(originalFileName),
    mimeType: validateMimeType(mimeType),
    fileSize: validateFileSize(fileSize),
    entityType: validateAttachmentEntityType(entityType),
    entityId: validateAttachmentEntityId(entityId),
    category: validateAttachmentCategory(category),
    description: validateAttachmentDescription(description),
  };

  const firstError = Object.values(validations).find((result) => !result.valid);

  if (firstError) {
    return firstError;
  }

  const extensionMimeTypeValidation = validateExtensionMimeTypePair({
    fileName: originalFileName,
    mimeType,
  });

  if (!extensionMimeTypeValidation.valid) {
    return extensionMimeTypeValidation;
  }

  const safeFileName = sanitizeAttachmentFileName(
    validations.originalFileName.value,
  );

  if (!safeFileName) {
    return {
      valid: false,
      error: "A safe storage file name could not be generated.",
    };
  }

  return {
    valid: true,
    value: {
      originalFileName: validations.originalFileName.value,
      fileName: safeFileName,
      fileExtension: validations.extension.value,
      mimeType: validations.mimeType.value,
      fileSize: validations.fileSize.value,
      entityType: validations.entityType.value,
      entityId: validations.entityId.value,
      category: validations.category.value,
      description: validations.description.value,
    },
  };
};

const ATTACHMENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateAttachmentId = (attachmentId) => {
  const normalizedAttachmentId = String(attachmentId || "")
    .trim()
    .toLowerCase();

  if (!ATTACHMENT_UUID_PATTERN.test(normalizedAttachmentId)) {
    return {
      valid: false,
      error: "Attachment ID must be a valid UUID.",
    };
  }

  return {
    valid: true,
    value: normalizedAttachmentId,
  };
};

const validateAttachmentMetadataUpdate = ({ category, description }) => {
  const hasCategory = category !== undefined;

  const hasDescription = description !== undefined;

  if (!hasCategory && !hasDescription) {
    return {
      valid: false,
      error: "At least one metadata field must be provided.",
    };
  }

  const value = {};

  if (hasCategory) {
    if (typeof category !== "string") {
      return {
        valid: false,
        error: "Attachment category must be a string.",
      };
    }

    const normalizedCategory = category.trim().toLowerCase();

    if (!ATTACHMENT_CATEGORIES.includes(normalizedCategory)) {
      return {
        valid: false,
        error: "Attachment category is invalid.",
      };
    }

    value.category = normalizedCategory;
  }

  if (hasDescription) {
    if (description !== null && typeof description !== "string") {
      return {
        valid: false,
        error: "Attachment description must be a string or null.",
      };
    }

    if (description === null || description.trim() === "") {
      value.description = null;
    } else {
      const normalizedDescription = description.trim();

      if (normalizedDescription.length > ATTACHMENT_MAX_DESCRIPTION_LENGTH) {
        return {
          valid: false,
          error: `Attachment description cannot exceed ${ATTACHMENT_MAX_DESCRIPTION_LENGTH} characters.`,
        };
      }

      value.description = normalizedDescription;
    }
  }

  return {
    valid: true,
    value,
  };
};

module.exports = {
  getNormalizedFileExtension,
  normalizeMimeType,
  sanitizeAttachmentFileName,
  validateAttachmentCategory,
  validateAttachmentDescription,
  validateAttachmentEntityId,
  validateAttachmentEntityType,
  validateAttachmentUploadMetadata,
  validateExtensionMimeTypePair,
  validateFileExtension,
  validateFileSize,
  validateMimeType,
  validateOriginalFileName,
  validateAttachmentId,
  validateAttachmentMetadataUpdate,
};
