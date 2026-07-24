const {
  ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  ATTACHMENT_PENDING_TTL_MINUTES,
  ATTACHMENT_STORAGE_PROVIDERS,
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

const storageProvider = String(process.env.ATTACHMENT_STORAGE_PROVIDER || "r2")
  .trim()
  .toLowerCase();

if (!ATTACHMENT_STORAGE_PROVIDERS.includes(storageProvider)) {
  throw new Error(
    `Unsupported attachment storage provider: ${storageProvider}`,
  );
}

const attachmentConfig = {
  storageProvider,

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

const requireEnvironmentValue = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is required when attachment storage uses R2.`);
  }

  return value;
};

const getR2Config = () => {
  const accountId = requireEnvironmentValue("R2_ACCOUNT_ID");
  const accessKeyId = requireEnvironmentValue("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnvironmentValue("R2_SECRET_ACCESS_KEY");
  const bucketName = requireEnvironmentValue("R2_BUCKET_NAME");

  const configuredEndpoint = String(process.env.R2_ENDPOINT || "").trim();

  const endpoint =
    configuredEndpoint || `https://${accountId}.r2.cloudflarestorage.com`;

  let parsedEndpoint;

  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new Error("R2_ENDPOINT must be a valid URL.");
  }

  if (parsedEndpoint.protocol !== "https:") {
    throw new Error("R2_ENDPOINT must use HTTPS.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: parsedEndpoint.toString().replace(/\/$/, ""),
    region: "auto",
  };
};

module.exports = {
  ...attachmentConfig,
  getR2Config,
};
