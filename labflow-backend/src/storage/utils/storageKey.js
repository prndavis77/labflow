const { ATTACHMENT_ENTITY_TYPES } = require("../../constants/attachments");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

const validatePositiveInteger = (value, fieldName) => {
  const normalizedValue = Number(value);

  if (!Number.isSafeInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const validateStorageKey = (storageKey) => {
  const normalizedStorageKey = String(storageKey || "").trim();

  if (!normalizedStorageKey) {
    throw new Error("Storage key is required.");
  }

  if (normalizedStorageKey.length > 1024) {
    throw new Error("Storage key cannot exceed 1024 characters.");
  }

  if (
    normalizedStorageKey.startsWith("/") ||
    normalizedStorageKey.endsWith("/") ||
    normalizedStorageKey.includes("\\") ||
    normalizedStorageKey.includes("//")
  ) {
    throw new Error("Storage key format is invalid.");
  }

  const segments = normalizedStorageKey.split("/");

  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Storage key contains an invalid path segment.");
  }

  return normalizedStorageKey;
};

const normalizeAttachmentStorageKeyParts = ({
  organizationId,
  entityType,
  entityId,
  attachmentId,
  fileName,
}) => {
  const normalizedOrganizationId = validatePositiveInteger(
    organizationId,
    "Organization ID",
  );

  const normalizedEntityId = validatePositiveInteger(entityId, "Entity ID");

  const normalizedEntityType = String(entityType || "")
    .trim()
    .toLowerCase();

  if (!ATTACHMENT_ENTITY_TYPES.includes(normalizedEntityType)) {
    throw new Error("Invalid attachment entity type.");
  }

  const normalizedAttachmentId = String(attachmentId || "")
    .trim()
    .toLowerCase();

  if (!UUID_PATTERN.test(normalizedAttachmentId)) {
    throw new Error("Attachment ID must be a valid UUID.");
  }

  const normalizedFileName = String(fileName || "")
    .trim()
    .toLowerCase();

  if (!SAFE_FILE_NAME_PATTERN.test(normalizedFileName)) {
    throw new Error("Attachment file name must already be sanitized.");
  }

  return {
    organizationId: normalizedOrganizationId,
    entityType: normalizedEntityType,
    entityId: normalizedEntityId,
    attachmentId: normalizedAttachmentId,
    fileName: normalizedFileName,
  };
};

const createAttachmentStagingStorageKey = (options) => {
  const { organizationId, entityType, entityId, attachmentId, fileName } =
    normalizeAttachmentStorageKeyParts(options);

  const storageKey = [
    "organizations",
    organizationId,
    entityType,
    entityId,
    "staging",
    attachmentId,
    fileName,
  ].join("/");

  return validateStorageKey(storageKey);
};

const createAttachmentFinalStorageKey = (options) => {
  const { organizationId, entityType, entityId, attachmentId, fileName } =
    normalizeAttachmentStorageKeyParts(options);

  const storageKey = [
    "organizations",
    organizationId,
    entityType,
    entityId,
    "attachments",
    attachmentId,
    fileName,
  ].join("/");

  return validateStorageKey(storageKey);
};

module.exports = {
  createAttachmentStagingStorageKey,
  createAttachmentFinalStorageKey,
  validateStorageKey,
};
