const { once } = require("events");

const {
  AttachmentRandomAccessReader,
  validateOoxmlAttachment,
} = require("../utils/attachmentOoxmlValidation");

const STORAGE_KEY = "organizations/10/experiment/42/attachment-id/results.docx";

/*
 * Minimal ZIP builder for tests.
 *
 * These fixtures use uncompressed entries unless a test explicitly overrides
 * the compression method or declared sizes. The validator only needs ZIP
 * structure and central-directory metadata, not extracted file contents.
 */

const createLocalFileHeader = ({
  fileName,
  data,
  flags = 0,
  compressionMethod = 0,
  compressedSize = data.length,
  uncompressedSize = data.length,
}) => {
  const fileNameBuffer = Buffer.from(fileName, "utf8");

  const header = Buffer.alloc(30);

  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(flags, 6);
  header.writeUInt16LE(compressionMethod, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(compressedSize, 18);
  header.writeUInt32LE(uncompressedSize, 22);
  header.writeUInt16LE(fileNameBuffer.length, 26);
  header.writeUInt16LE(0, 28);

  return Buffer.concat([header, fileNameBuffer, data]);
};

const createCentralDirectoryEntry = ({
  fileName,
  data,
  localHeaderOffset,
  flags = 0,
  compressionMethod = 0,
  compressedSize = data.length,
  uncompressedSize = data.length,
}) => {
  const fileNameBuffer = Buffer.from(fileName, "utf8");

  const header = Buffer.alloc(46);

  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(flags, 8);
  header.writeUInt16LE(compressionMethod, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(compressedSize, 20);
  header.writeUInt32LE(uncompressedSize, 24);
  header.writeUInt16LE(fileNameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localHeaderOffset, 42);

  return Buffer.concat([header, fileNameBuffer]);
};

const createEndOfCentralDirectory = ({
  entryCount,
  centralDirectorySize,
  centralDirectoryOffset,
}) => {
  const record = Buffer.alloc(22);

  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralDirectorySize, 12);
  record.writeUInt32LE(centralDirectoryOffset, 16);
  record.writeUInt16LE(0, 20);

  return record;
};

const createZipBuffer = (entries) => {
  const localParts = [];
  const centralParts = [];

  let localOffset = 0;

  for (const entry of entries) {
    const normalizedEntry = {
      data: Buffer.alloc(0),
      flags: 0,
      compressionMethod: 0,
      ...entry,
    };

    const compressedSize =
      normalizedEntry.compressedSize ?? normalizedEntry.data.length;

    const uncompressedSize =
      normalizedEntry.uncompressedSize ?? normalizedEntry.data.length;

    const localPart = createLocalFileHeader({
      ...normalizedEntry,
      compressedSize,
      uncompressedSize,
    });

    localParts.push(localPart);

    const centralPart = createCentralDirectoryEntry({
      ...normalizedEntry,
      compressedSize,
      uncompressedSize,
      localHeaderOffset: localOffset,
    });

    centralParts.push(centralPart);

    localOffset += localPart.length;
  }

  const localData = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);

  const endRecord = createEndOfCentralDirectory({
    entryCount: entries.length,
    centralDirectorySize: centralDirectory.length,
    centralDirectoryOffset: localData.length,
  });

  return Buffer.concat([localData, centralDirectory, endRecord]);
};

const createStorageForBuffer = (buffer) => ({
  getObjectRange: jest.fn(async ({ start, end }) =>
    buffer.subarray(start, end + 1),
  ),
});

const createDocxBuffer = () =>
  createZipBuffer([
    {
      fileName: "[Content_Types].xml",
      data: Buffer.from("<Types />"),
    },
    {
      fileName: "_rels/.rels",
      data: Buffer.from("<Relationships />"),
    },
    {
      fileName: "word/document.xml",
      data: Buffer.from("<document />"),
    },
  ]);

const createXlsxBuffer = () =>
  createZipBuffer([
    {
      fileName: "[Content_Types].xml",
      data: Buffer.from("<Types />"),
    },
    {
      fileName: "_rels/.rels",
      data: Buffer.from("<Relationships />"),
    },
    {
      fileName: "xl/workbook.xml",
      data: Buffer.from("<workbook />"),
    },
  ]);

const createPptxBuffer = () =>
  createZipBuffer([
    {
      fileName: "[Content_Types].xml",
      data: Buffer.from("<Types />"),
    },
    {
      fileName: "_rels/.rels",
      data: Buffer.from("<Relationships />"),
    },
    {
      fileName: "ppt/presentation.xml",
      data: Buffer.from("<presentation />"),
    },
  ]);

describe("attachment OOXML validation", () => {
  describe("valid OOXML document types", () => {
    test("accepts a structurally valid DOCX file", async () => {
      const buffer = createDocxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".docx",
      });

      expect(result).toEqual({
        valid: true,
      });

      expect(storage.getObjectRange).toHaveBeenCalled();
    });

    test("accepts a structurally valid XLSX file", async () => {
      const buffer = createXlsxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".xlsx",
      });

      expect(result).toEqual({
        valid: true,
      });
    });

    test("accepts a structurally valid PPTX file", async () => {
      const buffer = createPptxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".pptx",
      });

      expect(result).toEqual({
        valid: true,
      });
    });
  });

  describe("wrong Office subtype", () => {
    test("rejects a DOCX file presented as XLSX", async () => {
      const buffer = createDocxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".xlsx",
      });

      expect(result).toEqual({
        valid: false,
        error:
          "The uploaded Office document does not match the expected file type.",
      });
    });

    test("rejects an XLSX file presented as PPTX", async () => {
      const buffer = createXlsxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".pptx",
      });

      expect(result).toEqual({
        valid: false,
        error:
          "The uploaded Office document does not match the expected file type.",
      });
    });

    test("rejects a PPTX file presented as DOCX", async () => {
      const buffer = createPptxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".docx",
      });

      expect(result).toEqual({
        valid: false,
        error:
          "The uploaded Office document does not match the expected file type.",
      });
    });
  });

  describe("malformed and incomplete ZIP files", () => {
    test("rejects data that is not a valid ZIP file", async () => {
      const buffer = Buffer.from(
        "This is definitely not an OOXML ZIP file.",
        "utf8",
      );

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".docx",
      });

      expect(result).toEqual({
        valid: false,
        error: "The uploaded Office document is not a valid OOXML file.",
      });
    });

    test("rejects an OOXML ZIP missing required entries", async () => {
      const buffer = createZipBuffer([
        {
          fileName: "[Content_Types].xml",
          data: Buffer.from("<Types />"),
        },
        {
          fileName: "_rels/.rels",
          data: Buffer.from("<Relationships />"),
        },
      ]);

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".docx",
      });

      expect(result).toEqual({
        valid: false,
        error:
          "The uploaded Office document does not match the expected file type.",
      });
    });
  });

  describe("encrypted Office documents", () => {
    test("rejects an OOXML archive containing an encrypted ZIP entry", async () => {
      const buffer = createZipBuffer([
        {
          fileName: "[Content_Types].xml",
          data: Buffer.from("<Types />"),
        },
        {
          fileName: "_rels/.rels",
          data: Buffer.from("<Relationships />"),
        },
        {
          fileName: "word/document.xml",
          data: Buffer.from("<document />"),

          /*
           * General-purpose bit 0 indicates ZIP encryption.
           */
          flags: 0x0001,
        },
      ]);

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".docx",
      });

      expect(result).toEqual({
        valid: false,
        error: "The uploaded Office document is not a valid OOXML file.",
      });
    });
  });

  describe("ZIP expansion limits", () => {
    test("rejects an Office archive with excessive declared uncompressed size", async () => {
      const excessiveUncompressedSize = 100 * 1024 * 1024 + 1;

      /*
       * Compression method 8 avoids the stored-entry equality check between
       * compressed and uncompressed sizes during central-directory parsing.
       *
       * We never extract this entry. The test exercises our declared-size
       * defense only.
       */
      const buffer = createZipBuffer([
        {
          fileName: "[Content_Types].xml",
          data: Buffer.from([0x03, 0x00]),
          compressionMethod: 8,
          compressedSize: 2,
          uncompressedSize: excessiveUncompressedSize,
        },
        {
          fileName: "_rels/.rels",
          data: Buffer.from("<Relationships />"),
        },
        {
          fileName: "word/document.xml",
          data: Buffer.from("<document />"),
        },
      ]);

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".docx",
      });

      expect(result).toEqual({
        valid: false,
        error: "The Office document expands beyond the allowed size limit.",
      });
    });
  });

  describe("range translation", () => {
    test("translates yauzl exclusive end offsets to inclusive R2 ranges", async () => {
      const storage = {
        getObjectRange: jest
          .fn()
          .mockResolvedValue(Buffer.from("0123456789", "ascii")),
      };

      const reader = new AttachmentRandomAccessReader({
        storage,
        storageKey: STORAGE_KEY,
      });

      const stream = reader._readStreamForRange(10, 20);

      const chunks = [];

      stream.on("data", (chunk) => {
        chunks.push(chunk);
      });

      await once(stream, "end");

      expect(storage.getObjectRange).toHaveBeenCalledWith({
        storageKey: STORAGE_KEY,
        start: 10,
        end: 19,
      });

      expect(Buffer.concat(chunks)).toEqual(Buffer.from("0123456789", "ascii"));
    });

    test("propagates storage range-read errors through the stream", async () => {
      const storageError = new Error("R2 range read failed");

      const storage = {
        getObjectRange: jest.fn().mockRejectedValue(storageError),
      };

      const reader = new AttachmentRandomAccessReader({
        storage,
        storageKey: STORAGE_KEY,
      });

      const stream = reader._readStreamForRange(0, 10);

      const [error] = await once(stream, "error");

      expect(error).toBe(storageError);

      expect(error.code).toBe("ATTACHMENT_STORAGE_RANGE_READ_FAILED");

      expect(storage.getObjectRange).toHaveBeenCalledWith({
        storageKey: STORAGE_KEY,
        start: 0,
        end: 9,
      });
    });
  });

  describe("input validation", () => {
    test("rejects unsupported OOXML extensions", async () => {
      const buffer = createDocxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: buffer.length,
        fileExtension: ".zip",
      });

      expect(result).toEqual({
        valid: false,
        error: "Unsupported OOXML attachment file type.",
      });

      expect(storage.getObjectRange).not.toHaveBeenCalled();
    });

    test("rejects an invalid OOXML file size", async () => {
      const buffer = createDocxBuffer();

      const storage = createStorageForBuffer(buffer);

      const result = await validateOoxmlAttachment({
        storage,
        storageKey: STORAGE_KEY,
        fileSize: 0,
        fileExtension: ".docx",
      });

      expect(result).toEqual({
        valid: false,
        error: "Invalid OOXML attachment file size.",
      });

      expect(storage.getObjectRange).not.toHaveBeenCalled();
    });
  });

  describe("storage failures", () => {
    test("propagates storage range-read failures instead of treating them as invalid OOXML", async () => {
      const buffer = createDocxBuffer();

      const storageError = new Error("R2 unavailable");

      const storage = {
        getObjectRange: jest.fn().mockRejectedValue(storageError),
      };

      await expect(
        validateOoxmlAttachment({
          storage,
          storageKey: STORAGE_KEY,
          fileSize: buffer.length,
          fileExtension: ".docx",
        }),
      ).rejects.toMatchObject({
        message: "R2 unavailable",
        code: "ATTACHMENT_STORAGE_RANGE_READ_FAILED",
      });
    });
  });
});
