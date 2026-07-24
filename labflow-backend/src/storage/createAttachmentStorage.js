const attachmentConfig = require("../config/attachmentConfig");

const {
  createR2AttachmentStorage,
} = require("./providers/r2AttachmentStorage");

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

  throw new Error(
    `Unsupported attachment storage provider: ${normalizedProvider}`,
  );
};

module.exports = {
  createAttachmentStorage,
};
