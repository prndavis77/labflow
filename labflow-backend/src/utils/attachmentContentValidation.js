const BINARY_SIGNATURES = {
  ".pdf": [Buffer.from("%PDF-", "ascii")],

  ".png": [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],

  ".jpg": [Buffer.from([0xff, 0xd8, 0xff])],

  ".jpeg": [Buffer.from([0xff, 0xd8, 0xff])],

  ".tif": [
    Buffer.from([0x49, 0x49, 0x2a, 0x00]),
    Buffer.from([0x4d, 0x4d, 0x00, 0x2a]),
  ],

  ".tiff": [
    Buffer.from([0x49, 0x49, 0x2a, 0x00]),
    Buffer.from([0x4d, 0x4d, 0x00, 0x2a]),
  ],

  ".doc": [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],

  ".xls": [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],

  ".ppt": [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],

  ".docx": [Buffer.from([0x50, 0x4b])],

  ".xlsx": [Buffer.from([0x50, 0x4b])],

  ".pptx": [Buffer.from([0x50, 0x4b])],
};

const TEXT_EXTENSIONS = new Set([".txt", ".csv"]);

const startsWithSignature = (buffer, signature) => {
  if (buffer.length < signature.length) {
    return false;
  }

  return buffer.subarray(0, signature.length).equals(signature);
};

const containsNullByte = (buffer) => {
  return buffer.includes(0x00);
};

const hasKnownBinarySignature = (buffer) => {
  return Object.values(BINARY_SIGNATURES)
    .flat()
    .some((signature) => startsWithSignature(buffer, signature));
};

const validateTextContent = (buffer) => {
  if (buffer.length === 0) {
    return {
      valid: false,
      error: "The uploaded text file is empty.",
    };
  }

  if (containsNullByte(buffer)) {
    return {
      valid: false,
      error: "The uploaded text file contains binary content.",
    };
  }

  if (hasKnownBinarySignature(buffer)) {
    return {
      valid: false,
      error: "The uploaded text file contains binary content.",
    };
  }

  return {
    valid: true,
  };
};

const validateBinarySignature = ({ buffer, fileExtension }) => {
  const signatures = BINARY_SIGNATURES[fileExtension];

  if (!signatures) {
    return {
      valid: false,
      error: "Unsupported attachment file type.",
    };
  }

  const matches = signatures.some((signature) =>
    startsWithSignature(buffer, signature),
  );

  if (!matches) {
    return {
      valid: false,
      error: "The uploaded file content does not match the expected file type.",
    };
  }

  return {
    valid: true,
  };
};

const validateAttachmentContent = ({ buffer, fileExtension }) => {
  if (!Buffer.isBuffer(buffer)) {
    return {
      valid: false,
      error: "Attachment content must be provided as a buffer.",
    };
  }

  const normalizedExtension = String(fileExtension || "")
    .trim()
    .toLowerCase();

  if (!normalizedExtension) {
    return {
      valid: false,
      error: "Attachment file extension is required.",
    };
  }

  if (TEXT_EXTENSIONS.has(normalizedExtension)) {
    return validateTextContent(buffer);
  }

  return validateBinarySignature({
    buffer,
    fileExtension: normalizedExtension,
  });
};

module.exports = {
  validateAttachmentContent,
};
