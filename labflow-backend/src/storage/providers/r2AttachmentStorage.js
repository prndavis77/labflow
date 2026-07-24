const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const attachmentConfig = require("../../config/attachmentConfig");

const {
  createDownloadContentDisposition,
} = require("../utils/contentDisposition");

const { validateStorageKey } = require("../utils/storageKey");

const normalizePositiveInteger = (value, fallback, fieldName) => {
  const candidate =
    value === undefined || value === null ? fallback : Number(value);

  if (!Number.isSafeInteger(candidate) || candidate <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return candidate;
};

const normalizeMimeType = (mimeType) => {
  const normalizedMimeType = String(mimeType || "")
    .trim()
    .toLowerCase();

  if (!normalizedMimeType) {
    throw new Error("MIME type is required.");
  }

  return normalizedMimeType;
};

const normalizeEtag = (etag) => {
  if (!etag) {
    return null;
  }

  return String(etag).replace(/^"|"$/g, "");
};

const createR2AttachmentStorage = ({
  client,
  signUrl = getSignedUrl,
  config,
} = {}) => {
  const r2Config = config || attachmentConfig.getR2Config();

  const s3Client =
    client ||
    new S3Client({
      region: r2Config.region || "auto",
      endpoint: r2Config.endpoint,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });

  const bucketName = String(r2Config.bucketName || "").trim();

  if (!bucketName) {
    throw new Error("R2 bucket name is required.");
  }

  const createUploadUrl = async ({
    storageKey,
    mimeType,
    expiresInSeconds,
  }) => {
    const normalizedStorageKey = validateStorageKey(storageKey);

    const normalizedMimeType = normalizeMimeType(mimeType);

    const normalizedExpiresIn = normalizePositiveInteger(
      expiresInSeconds,
      attachmentConfig.uploadUrlTtlSeconds,
      "Upload URL expiration",
    );

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: normalizedStorageKey,
      ContentType: normalizedMimeType,
    });

    const url = await signUrl(s3Client, command, {
      expiresIn: normalizedExpiresIn,
    });

    return {
      url,
      method: "PUT",
      headers: {
        "Content-Type": normalizedMimeType,
      },
      expiresIn: normalizedExpiresIn,
    };
  };

  const createDownloadUrl = async ({
    storageKey,
    originalFileName,
    mimeType,
    expiresInSeconds,
  }) => {
    const normalizedStorageKey = validateStorageKey(storageKey);

    const normalizedMimeType = normalizeMimeType(mimeType);

    const normalizedExpiresIn = normalizePositiveInteger(
      expiresInSeconds,
      attachmentConfig.downloadUrlTtlSeconds,
      "Download URL expiration",
    );

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: normalizedStorageKey,
      ResponseContentType: normalizedMimeType,
      ResponseContentDisposition:
        createDownloadContentDisposition(originalFileName),
    });

    const url = await signUrl(s3Client, command, {
      expiresIn: normalizedExpiresIn,
    });

    return {
      url,
      method: "GET",
      expiresIn: normalizedExpiresIn,
    };
  };

  const getObjectMetadata = async ({ storageKey }) => {
    const normalizedStorageKey = validateStorageKey(storageKey);

    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: normalizedStorageKey,
      }),
    );

    const contentLength =
      response.ContentLength === undefined || response.ContentLength === null
        ? null
        : Number(response.ContentLength);

    return {
      contentLength,
      contentType: response.ContentType || null,
      etag: normalizeEtag(response.ETag),
      checksumSha256: response.ChecksumSHA256 || null,
      lastModified: response.LastModified || null,
      metadata: response.Metadata || {},
    };
  };

  const deleteObject = async ({ storageKey }) => {
    const normalizedStorageKey = validateStorageKey(storageKey);

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: normalizedStorageKey,
      }),
    );

    return {
      deleted: true,
      storageKey: normalizedStorageKey,
    };
  };

  return {
    provider: "r2",
    bucketName,
    createUploadUrl,
    createDownloadUrl,
    getObjectMetadata,
    deleteObject,
  };
};

module.exports = {
  createR2AttachmentStorage,
};
