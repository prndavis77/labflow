const { createAttachmentStorage } = require("./createAttachmentStorage");

let attachmentStorageInstance = null;

const getAttachmentStorage = () => {
  if (!attachmentStorageInstance) {
    attachmentStorageInstance = createAttachmentStorage();
  }

  return attachmentStorageInstance;
};

const setAttachmentStorageForTests = (storage) => {
  attachmentStorageInstance = storage;
};

const resetAttachmentStorageForTests = () => {
  attachmentStorageInstance = null;
};

module.exports = {
  getAttachmentStorage,
  resetAttachmentStorageForTests,
  setAttachmentStorageForTests,
};
