const { PassThrough } = require("stream");
const yauzl = require("yauzl");

const MAX_OOXML_ENTRIES = 5000;
const MAX_OOXML_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

const REQUIRED_ENTRIES_BY_EXTENSION = {
  ".docx": ["[Content_Types].xml", "_rels/.rels", "word/document.xml"],

  ".xlsx": ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"],

  ".pptx": ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"],
};

class AttachmentRandomAccessReader extends yauzl.RandomAccessReader {
  constructor({ storage, storageKey }) {
    super();

    this.storage = storage;
    this.storageKey = storageKey;
  }

  _readStreamForRange(start, end) {
    const stream = new PassThrough();

    /*
     * yauzl uses an exclusive end offset.
     * R2's HTTP byte Range uses an inclusive end offset.
     */
    this.storage
      .getObjectRange({
        storageKey: this.storageKey,
        start,
        end: end - 1,
      })
      .then((buffer) => {
        stream.end(buffer);
      })
      .catch((error) => {
        error.code = "ATTACHMENT_STORAGE_RANGE_READ_FAILED";
        stream.destroy(error);
      });

    return stream;
  }
}

const validateOoxmlAttachment = async ({
  storage,
  storageKey,
  fileSize,
  fileExtension,
}) => {
  const normalizedExtension = String(fileExtension || "")
    .trim()
    .toLowerCase();

  const requiredEntries = REQUIRED_ENTRIES_BY_EXTENSION[normalizedExtension];

  if (!requiredEntries) {
    return {
      valid: false,
      error: "Unsupported OOXML attachment file type.",
    };
  }

  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return {
      valid: false,
      error: "Invalid OOXML attachment file size.",
    };
  }

  const reader = new AttachmentRandomAccessReader({
    storage,
    storageKey,
  });

  let zipFile;

  try {
    zipFile = await yauzl.fromRandomAccessReaderPromise(reader, fileSize, {
      validateEntrySizes: true,
      strictFileNames: true,
    });

    const foundEntries = new Set();

    let entryCount = 0;
    let totalUncompressedSize = 0;

    for await (const entry of zipFile.eachEntry()) {
      entryCount += 1;

      if (entryCount > MAX_OOXML_ENTRIES) {
        return {
          valid: false,
          error: "The Office document contains too many ZIP entries.",
        };
      }

      if (entry.isEncrypted()) {
        return {
          valid: false,
          error: "Encrypted Office attachments are not supported.",
        };
      }

      const uncompressedSize = Number(entry.uncompressedSize);

      if (!Number.isSafeInteger(uncompressedSize) || uncompressedSize < 0) {
        return {
          valid: false,
          error: "The Office document contains an invalid ZIP entry.",
        };
      }

      totalUncompressedSize += uncompressedSize;

      if (totalUncompressedSize > MAX_OOXML_UNCOMPRESSED_BYTES) {
        return {
          valid: false,
          error: "The Office document expands beyond the allowed size limit.",
        };
      }

      if (requiredEntries.includes(entry.fileName)) {
        foundEntries.add(entry.fileName);
      }
    }

    const hasAllRequiredEntries = requiredEntries.every((entryName) =>
      foundEntries.has(entryName),
    );

    if (!hasAllRequiredEntries) {
      return {
        valid: false,
        error:
          "The uploaded Office document does not match the expected file type.",
      };
    }

    return {
      valid: true,
    };
  } catch (error) {
    if (error?.code === "ATTACHMENT_STORAGE_RANGE_READ_FAILED") {
      throw error;
    }

    return {
      valid: false,
      error: "The uploaded Office document is not a valid OOXML file.",
    };
  }
};

module.exports = {
  AttachmentRandomAccessReader,
  validateOoxmlAttachment,
};
