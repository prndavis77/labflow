const {
  validateAttachmentContent,
} = require("../utils/attachmentContentValidation");

describe("attachment content validation", () => {
  describe("binary file signatures", () => {
    test("accepts a valid PDF signature", () => {
      const buffer = Buffer.from("%PDF-1.7\n", "ascii");

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".pdf",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects an invalid PDF signature", () => {
      const buffer = Buffer.from("This is not a PDF", "utf8");

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".pdf",
        }),
      ).toEqual({
        valid: false,
        error:
          "The uploaded file content does not match the expected file type.",
      });
    });

    test("accepts a valid PNG signature", () => {
      const buffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".png",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects an invalid PNG signature", () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x00]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".png",
        }),
      ).toEqual({
        valid: false,
        error:
          "The uploaded file content does not match the expected file type.",
      });
    });

    test("accepts a valid JPEG signature for .jpg", () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".jpg",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts a valid JPEG signature for .jpeg", () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".jpeg",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects an invalid JPEG signature", () => {
      const buffer = Buffer.from([0xff, 0xd8, 0x00, 0x00]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".jpg",
        }),
      ).toEqual({
        valid: false,
        error:
          "The uploaded file content does not match the expected file type.",
      });
    });

    test("accepts a little-endian TIFF signature", () => {
      const buffer = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x00]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".tif",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts a big-endian TIFF signature", () => {
      const buffer = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".tiff",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects an invalid TIFF signature", () => {
      const buffer = Buffer.from([0x49, 0x49, 0x00, 0x00]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".tif",
        }),
      ).toEqual({
        valid: false,
        error:
          "The uploaded file content does not match the expected file type.",
      });
    });
  });

  describe("Office container signatures", () => {
    const oleSignature = Buffer.from([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00,
    ]);

    const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);

    test("accepts an OLE compound file for .doc", () => {
      expect(
        validateAttachmentContent({
          buffer: oleSignature,
          fileExtension: ".doc",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts an OLE compound file for .xls", () => {
      expect(
        validateAttachmentContent({
          buffer: oleSignature,
          fileExtension: ".xls",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts an OLE compound file for .ppt", () => {
      expect(
        validateAttachmentContent({
          buffer: oleSignature,
          fileExtension: ".ppt",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects a non-OLE file for .doc", () => {
      expect(
        validateAttachmentContent({
          buffer: Buffer.from("not a Word document"),
          fileExtension: ".doc",
        }),
      ).toEqual({
        valid: false,
        error:
          "The uploaded file content does not match the expected file type.",
      });
    });

    test("accepts a ZIP container for .docx", () => {
      expect(
        validateAttachmentContent({
          buffer: zipSignature,
          fileExtension: ".docx",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts a ZIP container for .pptx", () => {
      expect(
        validateAttachmentContent({
          buffer: zipSignature,
          fileExtension: ".pptx",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts a ZIP container for .xlsx", () => {
      expect(
        validateAttachmentContent({
          buffer: zipSignature,
          fileExtension: ".xlsx",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects a non-ZIP file for .xlsx", () => {
      expect(
        validateAttachmentContent({
          buffer: Buffer.from("not a spreadsheet"),
          fileExtension: ".xlsx",
        }),
      ).toEqual({
        valid: false,
        error:
          "The uploaded file content does not match the expected file type.",
      });
    });
  });

  describe("text files", () => {
    test("accepts plain text content", () => {
      const buffer = Buffer.from(
        "Experiment completed successfully.\nSample 42.",
        "utf8",
      );

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".txt",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts CSV text content", () => {
      const buffer = Buffer.from(
        "sample,retention_time,area\nA,1.23,400\nB,2.34,500\n",
        "utf8",
      );

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".csv",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("accepts CSV content without commas", () => {
      const buffer = Buffer.from(
        "sample;retention_time;area\nA;1.23;400\n",
        "utf8",
      );

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".csv",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects an empty text file", () => {
      expect(
        validateAttachmentContent({
          buffer: Buffer.alloc(0),
          fileExtension: ".txt",
        }),
      ).toEqual({
        valid: false,
        error: "The uploaded text file is empty.",
      });
    });

    test("rejects text content containing a null byte", () => {
      const buffer = Buffer.from([
        0x74, 0x65, 0x78, 0x74, 0x00, 0x64, 0x61, 0x74, 0x61,
      ]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".txt",
        }),
      ).toEqual({
        valid: false,
        error: "The uploaded text file contains binary content.",
      });
    });

    test("rejects a PDF disguised as a text file", () => {
      const buffer = Buffer.from("%PDF-1.7\n", "ascii");

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".txt",
        }),
      ).toEqual({
        valid: false,
        error: "The uploaded text file contains binary content.",
      });
    });

    test("rejects a PNG disguised as a CSV file", () => {
      const buffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: ".csv",
        }),
      ).toEqual({
        valid: false,
        error: "The uploaded text file contains binary content.",
      });
    });
  });

  describe("input validation", () => {
    test("rejects content that is not a Buffer", () => {
      expect(
        validateAttachmentContent({
          buffer: "not-a-buffer",
          fileExtension: ".pdf",
        }),
      ).toEqual({
        valid: false,
        error: "Attachment content must be provided as a buffer.",
      });
    });

    test("rejects a missing file extension", () => {
      expect(
        validateAttachmentContent({
          buffer: Buffer.from("content"),
        }),
      ).toEqual({
        valid: false,
        error: "Attachment file extension is required.",
      });
    });

    test("normalizes file extension case and whitespace", () => {
      const buffer = Buffer.from("%PDF-1.7\n", "ascii");

      expect(
        validateAttachmentContent({
          buffer,
          fileExtension: "  .PDF  ",
        }),
      ).toEqual({
        valid: true,
      });
    });

    test("rejects an unsupported file extension", () => {
      expect(
        validateAttachmentContent({
          buffer: Buffer.from("content"),
          fileExtension: ".exe",
        }),
      ).toEqual({
        valid: false,
        error: "Unsupported attachment file type.",
      });
    });

    test("rejects a buffer shorter than the required signature", () => {
      expect(
        validateAttachmentContent({
          buffer: Buffer.from([0x25, 0x50]),
          fileExtension: ".pdf",
        }),
      ).toEqual({
        valid: false,
        error:
          "The uploaded file content does not match the expected file type.",
      });
    });
  });
});
