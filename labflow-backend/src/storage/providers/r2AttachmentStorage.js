const {
  CopyObjectCommand,
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

const normalizeNonNegativeInteger = (value, fieldName) => {
  const normalizedValue = Number(value);

  if (!Number.isSafeInteger(normalizedValue) || normalizedValue < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return normalizedValue;
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
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

  const bucketName = String(r2Config.bucketName || "").trim();

  if (!bucketName) {
    throw new Error("R2 bucket name is required.");
  }

  const createUploadUrl = async ({
    storageKey,
    mimeType,
    contentLength,
    expiresInSeconds,
  }) => {
    const normalizedStorageKey = validateStorageKey(storageKey);

    const normalizedMimeType = normalizeMimeType(mimeType);

    const normalizedContentLength = normalizePositiveInteger(
      contentLength,
      undefined,
      "Upload content length",
    );

    const normalizedExpiresIn = normalizePositiveInteger(
      expiresInSeconds,
      attachmentConfig.uploadUrlTtlSeconds,
      "Upload URL expiration",
    );

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: normalizedStorageKey,
      ContentType: normalizedMimeType,
      ContentLength: normalizedContentLength,
    });

    const url = await signUrl(s3Client, command, {
      expiresIn: normalizedExpiresIn,
      signableHeaders: new Set(["content-type", "content-length"]),
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

  const getObjectRange = async ({ storageKey, start = 0, end }) => {
    const normalizedStorageKey = validateStorageKey(storageKey);

    const normalizedStart = normalizeNonNegativeInteger(
      start,
      "Object range start",
    );

    const normalizedEnd = normalizeNonNegativeInteger(end, "Object range end");

    if (normalizedEnd < normalizedStart) {
      throw new Error(
        "Object range end must be greater than or equal to the start.",
      );
    }

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: normalizedStorageKey,
        Range: `bytes=${normalizedStart}-${normalizedEnd}`,
      }),
    );

    if (!response.Body) {
      throw new Error("Storage object response did not contain a body.");
    }

    const bytes = await response.Body.transformToByteArray();

    return Buffer.from(bytes);
  };

  const finalizeObject = async ({
    sourceStorageKey,
    destinationStorageKey,
    expectedEtag,
    contentType,
  }) => {
    const normalizedSourceStorageKey = validateStorageKey(sourceStorageKey);

    const normalizedDestinationStorageKey = validateStorageKey(
      destinationStorageKey,
    );

    const normalizedContentType = normalizeMimeType(contentType);

    const normalizedExpectedEtag = normalizeEtag(expectedEtag);

    if (!normalizedExpectedEtag) {
      throw new Error("Expected source ETag is required.");
    }

    /*
     * CopySource must be URL-encoded for S3-compatible CopyObject requests.
     * Preserve "/" separators in the object key while encoding individual
     * path segments.
     */
    const encodedSourceKey = normalizedSourceStorageKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const response = await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucketName,
        Key: normalizedDestinationStorageKey,

        CopySource: `${bucketName}/${encodedSourceKey}`,

        /*
         * Only copy the exact staging object whose ETag was verified.
         * If the client overwrites the staging object after validation,
         * this condition causes the copy to fail.
         */
        CopySourceIfMatch: normalizedExpectedEtag,

        /*
         * Do not trust metadata that came from the client upload.
         * Write authoritative server-controlled metadata instead.
         */
        MetadataDirective: "REPLACE",
        ContentType: normalizedContentType,
      }),
    );

    return {
      storageKey: normalizedDestinationStorageKey,
      etag: normalizeEtag(response.CopyObjectResult?.ETag),
      lastModified: response.CopyObjectResult?.LastModified || null,
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
    getObjectRange,
    deleteObject,
    finalizeObject,
  };
};

module.exports = {
  createR2AttachmentStorage,
};
