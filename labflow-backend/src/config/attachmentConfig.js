const {
  ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  ATTACHMENT_PENDING_TTL_MINUTES,
  ATTACHMENT_UPLOAD_URL_TTL_SECONDS,
} = require("../constants/attachments");

const parsePositiveInteger = (value, fallback, variableName) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${variableName} must be a positive integer.`);
  }

  return parsedValue;
};

const attachmentConfig = {
  storageProvider: process.env.ATTACHMENT_STORAGE_PROVIDER || "r2",

  maxFileSizeBytes: parsePositiveInteger(
    process.env.ATTACHMENT_MAX_FILE_SIZE_BYTES,
    ATTACHMENT_MAX_FILE_SIZE_BYTES,
    "ATTACHMENT_MAX_FILE_SIZE_BYTES",
  ),

  uploadUrlTtlSeconds: parsePositiveInteger(
    process.env.ATTACHMENT_UPLOAD_URL_TTL_SECONDS,
    ATTACHMENT_UPLOAD_URL_TTL_SECONDS,
    "ATTACHMENT_UPLOAD_URL_TTL_SECONDS",
  ),

  downloadUrlTtlSeconds: parsePositiveInteger(
    process.env.ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS,
    ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS,
    "ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS",
  ),

  pendingUploadTtlMinutes: parsePositiveInteger(
    process.env.ATTACHMENT_PENDING_TTL_MINUTES,
    ATTACHMENT_PENDING_TTL_MINUTES,
    "ATTACHMENT_PENDING_TTL_MINUTES",
  ),
};

module.exports = attachmentConfig;
