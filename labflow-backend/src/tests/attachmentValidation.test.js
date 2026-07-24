const attachmentConfig = require("../config/attachmentConfig");

const {
  getNormalizedFileExtension,
  sanitizeAttachmentFileName,
  validateAttachmentUploadMetadata,
  validateExtensionMimeTypePair,
  validateFileSize,
  validateOriginalFileName,
} = require("../utils/attachmentValidation");

describe("attachment validation", () => {
  describe("getNormalizedFileExtension", () => {
    test("returns a lowercase extension", () => {
      expect(getNormalizedFileExtension("Research Results.PDF")).toBe(".pdf");
    });

    test("returns an empty string when no extension exists", () => {
      expect(getNormalizedFileExtension("research-results")).toBe("");
    });
  });

  describe("sanitizeAttachmentFileName", () => {
    test("creates a safe lowercase file name", () => {
      expect(sanitizeAttachmentFileName("GC-MS Run #04 (Final).CSV")).toBe(
        "gc-ms-run-04-final.csv",
      );
    });

    test("removes accented characters safely", () => {
      expect(sanitizeAttachmentFileName("Résultats Étude 01.pdf")).toBe(
        "resultats-etude-01.pdf",
      );
    });

    test("uses a fallback name when the base name is unusable", () => {
      expect(sanitizeAttachmentFileName("***.pdf")).toBe("attachment.pdf");
    });
  });

  describe("validateOriginalFileName", () => {
    test("accepts a normal file name", () => {
      expect(validateOriginalFileName("results.pdf").valid).toBe(true);
    });

    test("rejects directory paths", () => {
      expect(validateOriginalFileName("../results.pdf")).toEqual({
        valid: false,
        error: "File name cannot contain directory paths.",
      });

      expect(validateOriginalFileName("folder\\results.pdf").valid).toBe(false);
    });

    test("rejects an empty file name", () => {
      expect(validateOriginalFileName(" ").valid).toBe(false);
    });
  });

  describe("validateFileSize", () => {
    test("accepts the maximum allowed file size", () => {
      expect(validateFileSize(attachmentConfig.maxFileSizeBytes).valid).toBe(
        true,
      );
    });

    test("rejects files larger than 25 MB", () => {
      expect(
        validateFileSize(attachmentConfig.maxFileSizeBytes + 1).valid,
      ).toBe(false);
    });

    test("rejects zero and negative file sizes", () => {
      expect(validateFileSize(0).valid).toBe(false);
      expect(validateFileSize(-1).valid).toBe(false);
    });

    test("rejects non-integer file sizes", () => {
      expect(validateFileSize("not-a-number").valid).toBe(false);

      expect(validateFileSize(12.5).valid).toBe(false);
    });
  });

  describe("validateExtensionMimeTypePair", () => {
    test("accepts a valid PDF pair", () => {
      expect(
        validateExtensionMimeTypePair({
          fileName: "report.pdf",
          mimeType: "application/pdf",
        }).valid,
      ).toBe(true);
    });

    test("rejects mismatched extensions and MIME types", () => {
      expect(
        validateExtensionMimeTypePair({
          fileName: "report.pdf",
          mimeType: "image/png",
        }).valid,
      ).toBe(false);
    });

    test("accepts permitted CSV MIME variants", () => {
      expect(
        validateExtensionMimeTypePair({
          fileName: "results.csv",
          mimeType: "text/csv",
        }).valid,
      ).toBe(true);

      expect(
        validateExtensionMimeTypePair({
          fileName: "results.csv",
          mimeType: "application/vnd.ms-excel",
        }).valid,
      ).toBe(true);
    });
  });

  describe("validateAttachmentUploadMetadata", () => {
    const validMetadata = {
      originalFileName: "GC-MS Run 04.csv",
      mimeType: "text/csv",
      fileSize: 1024,
      entityType: "experiment",
      entityId: 42,
      category: "raw_data",
      description: "Raw instrument export.",
    };

    test("normalizes valid upload metadata", () => {
      const result = validateAttachmentUploadMetadata(validMetadata);

      expect(result.valid).toBe(true);

      expect(result.value).toEqual({
        originalFileName: "GC-MS Run 04.csv",
        fileName: "gc-ms-run-04.csv",
        fileExtension: ".csv",
        mimeType: "text/csv",
        fileSize: 1024,
        entityType: "experiment",
        entityId: 42,
        category: "raw_data",
        description: "Raw instrument export.",
      });
    });

    test("defaults a missing category to other", () => {
      const result = validateAttachmentUploadMetadata({
        ...validMetadata,
        category: undefined,
      });

      expect(result.valid).toBe(true);
      expect(result.value.category).toBe("other");
    });

    test("rejects a blocked executable extension", () => {
      const result = validateAttachmentUploadMetadata({
        ...validMetadata,
        originalFileName: "malware.exe",
        mimeType: "application/octet-stream",
      });

      expect(result.valid).toBe(false);
    });

    test("rejects a MIME type mismatch", () => {
      const result = validateAttachmentUploadMetadata({
        ...validMetadata,
        originalFileName: "results.pdf",
        mimeType: "image/png",
      });

      expect(result.valid).toBe(false);
    });

    test("rejects an unsupported entity type", () => {
      const result = validateAttachmentUploadMetadata({
        ...validMetadata,
        entityType: "user",
      });

      expect(result.valid).toBe(false);
    });

    test("rejects an invalid entity ID", () => {
      const result = validateAttachmentUploadMetadata({
        ...validMetadata,
        entityId: 0,
      });

      expect(result.valid).toBe(false);
    });

    test("rejects an unsupported category", () => {
      const result = validateAttachmentUploadMetadata({
        ...validMetadata,
        category: "secret_file",
      });

      expect(result.valid).toBe(false);
    });
  });

  test("rejects Windows and Unix-style paths", () => {
    expect(
      validateOriginalFileName("C:\\Users\\Researcher\\results.pdf").valid,
    ).toBe(false);

    expect(validateOriginalFileName("folder/results.pdf").valid).toBe(false);
  });
});
