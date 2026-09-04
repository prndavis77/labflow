const attachmentConfig = require("../config/attachmentConfig");

const {
  createR2AttachmentStorage,
} = require("./providers/r2AttachmentStorage");

const {
  createS3AttachmentStorage,
} = require("./providers/s3AttachmentStorage");

const createAttachmentStorage = ({
  provider = attachmentConfig.storageProvider,
  providerOptions,
} = {}) => {
  const normalizedProvider = String(provider || "")
    .trim()
    .toLowerCase();

  if (normalizedProvider === "r2") {
    return createR2AttachmentStorage(providerOptions);
  }

  if (normalizedProvider === "s3") {
    return createS3AttachmentStorage(providerOptions);
  }

  throw new Error(`Unsupported attachment storage provider: ${provider}`);
};

module.exports = {
  createAttachmentStorage,
};
