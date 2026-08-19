const {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const {
  createAttachmentStorage,
} = require("../storage/createAttachmentStorage");
const {
  createAttachmentStagingStorageKey,
  createAttachmentFinalStorageKey,
  validateStorageKey,
} = require("../storage/utils/storageKey");
const {
  createDownloadContentDisposition,
} = require("../storage/utils/contentDisposition");

describe("attachment storage", () => {
  const config = {
    accountId: "test-account",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    bucketName: "labflow-test-attachments",
    endpoint: "https://test-account.r2.cloudflarestorage.com",
    region: "auto",
  };

  const createMockClient = () => ({
    send: jest.fn(),
  });

  describe("storage keys", () => {
    test("creates a staging attachment storage key", () => {
      const key = createAttachmentStagingStorageKey({
        organizationId: 8,
        entityType: "experiment",
        entityId: 42,
        attachmentId: "550e8400-e29b-41d4-a716-446655440000",
        fileName: "results.csv",
      });

      expect(key).toBe(
        "organizations/8/experiment/42/staging/" +
          "550e8400-e29b-41d4-a716-446655440000/results.csv",
      );
    });

    test("creates a final attachment storage key", () => {
      const key = createAttachmentFinalStorageKey({
        organizationId: 8,
        entityType: "experiment",
        entityId: 42,
        attachmentId: "550e8400-e29b-41d4-a716-446655440000",
        fileName: "results.csv",
      });

      expect(key).toBe(
        "organizations/8/experiment/42/attachments/" +
          "550e8400-e29b-41d4-a716-446655440000/results.csv",
      );
    });

    test("rejects invalid storage-key segments", () => {
      expect(() =>
        validateStorageKey("organizations/8/../secret/file.pdf"),
      ).toThrow("invalid path segment");

      expect(() => validateStorageKey("/organizations/8/file.pdf")).toThrow(
        "format is invalid",
      );
    });

    test("rejects unsanitized storage filenames", () => {
      expect(() =>
        createAttachmentStagingStorageKey({
          organizationId: 8,
          entityType: "experiment",
          entityId: 42,
          attachmentId: "7dcf9559-0f93-4fb2-8193-5fda32180592",
          fileName: "GC MS Results.pdf",
        }),
      ).toThrow("must already be sanitized");
    });
  });

  describe("download content disposition", () => {
    test("creates a safe attachment header", () => {
      const disposition = createDownloadContentDisposition(
        "Résultats étude.pdf",
      );

      expect(disposition).toContain(
        'attachment; filename="Resultats etude.pdf"',
      );

      expect(disposition).toContain("filename*=UTF-8''");
    });

    test("removes header-breaking characters", () => {
      const disposition = createDownloadContentDisposition(
        'results"\r\nInjected.pdf',
      );

      expect(disposition).not.toContain("\r");
      expect(disposition).not.toContain("\n");
    });
  });

  describe("R2 provider", () => {
    test("creates a presigned upload URL", async () => {
      const client = createMockClient();
      const signUrl = jest
        .fn()
        .mockResolvedValue("https://upload.example.test");

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          signUrl,
          config,
        },
      });

      const result = await storage.createUploadUrl({
        storageKey: "organizations/8/experiment/42/id/results.csv",
        mimeType: "text/csv",
        contentLength: 1024,
        expiresInSeconds: 300,
      });

      expect(result).toEqual({
        url: "https://upload.example.test",
        method: "PUT",
        headers: {
          "Content-Type": "text/csv",
        },
        expiresIn: 300,
      });

      expect(signUrl).toHaveBeenCalledTimes(1);

      const [, command, options] = signUrl.mock.calls[0];

      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: "labflow-test-attachments",
        Key: "organizations/8/experiment/42/id/results.csv",
        ContentType: "text/csv",
        ContentLength: 1024,
      });

      expect(options).toEqual({
        expiresIn: 300,
        signableHeaders: new Set(["content-type", "content-length"]),
      });
    });

    test("rejects an invalid upload content length", async () => {
      const client = createMockClient();

      const signUrl = jest
        .fn()
        .mockResolvedValue("https://upload.example.test");

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          signUrl,
          config,
        },
      });

      await expect(
        storage.createUploadUrl({
          storageKey: "organizations/8/experiment/42/id/results.csv",
          mimeType: "text/csv",
          contentLength: 0,
          expiresInSeconds: 300,
        }),
      ).rejects.toThrow("Upload content length must be a positive integer.");

      await expect(
        storage.createUploadUrl({
          storageKey: "organizations/8/experiment/42/id/results.csv",
          mimeType: "text/csv",
          contentLength: -1,
          expiresInSeconds: 300,
        }),
      ).rejects.toThrow("Upload content length must be a positive integer.");

      expect(signUrl).not.toHaveBeenCalled();
    });

    test("creates a presigned download URL", async () => {
      const client = createMockClient();
      const signUrl = jest
        .fn()
        .mockResolvedValue("https://download.example.test");

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          signUrl,
          config,
        },
      });

      const result = await storage.createDownloadUrl({
        storageKey: "organizations/8/experiment/42/id/report.pdf",
        originalFileName: "Final Report.pdf",
        mimeType: "application/pdf",
        expiresInSeconds: 60,
      });

      expect(result).toEqual({
        url: "https://download.example.test",
        method: "GET",
        expiresIn: 60,
      });

      const [, command, options] = signUrl.mock.calls[0];

      expect(command).toBeInstanceOf(GetObjectCommand);

      expect(command.input.Bucket).toBe("labflow-test-attachments");

      expect(command.input.Key).toBe(
        "organizations/8/experiment/42/id/report.pdf",
      );

      expect(command.input.ResponseContentType).toBe("application/pdf");

      expect(command.input.ResponseContentDisposition).toContain("attachment;");

      expect(options).toEqual({
        expiresIn: 60,
      });
    });

    test("returns normalized object metadata", async () => {
      const client = createMockClient();

      client.send.mockResolvedValue({
        ContentLength: 1024,
        ContentType: "text/csv",
        ETag: '"abc123"',
        ChecksumSHA256: "checksum-value",
        LastModified: new Date("2026-07-24T10:00:00.000Z"),
        Metadata: {
          source: "labflow",
        },
      });

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      const result = await storage.getObjectMetadata({
        storageKey: "organizations/8/experiment/42/id/results.csv",
      });

      expect(client.send).toHaveBeenCalledTimes(1);

      const [command] = client.send.mock.calls[0];

      expect(command).toBeInstanceOf(HeadObjectCommand);

      expect(result).toEqual({
        contentLength: 1024,
        contentType: "text/csv",
        etag: "abc123",
        checksumSha256: "checksum-value",
        lastModified: new Date("2026-07-24T10:00:00.000Z"),
        metadata: {
          source: "labflow",
        },
      });
    });

    test("finalizes an attachment by copying the verified staging object", async () => {
      const client = {
        send: jest.fn().mockResolvedValue({
          CopyObjectResult: {
            ETag: '"final-etag"',
            LastModified: new Date("2026-08-19T10:00:00.000Z"),
          },
        }),
      };

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      const result = await storage.finalizeObject({
        sourceStorageKey:
          "organizations/8/experiment/42/staging/upload-id/results.csv",

        destinationStorageKey:
          "organizations/8/experiment/42/final/attachment-id/results.csv",

        expectedEtag: '"source-etag"',
        contentType: "text/csv",
      });

      expect(client.send).toHaveBeenCalledTimes(1);

      const [command] = client.send.mock.calls[0];

      expect(command).toBeInstanceOf(CopyObjectCommand);

      expect(command.input).toEqual({
        Bucket: config.bucketName,

        Key: "organizations/8/experiment/42/final/attachment-id/results.csv",

        CopySource:
          `${config.bucketName}/` +
          "organizations/8/experiment/42/staging/upload-id/results.csv",

        CopySourceIfMatch: "source-etag",

        MetadataDirective: "REPLACE",

        ContentType: "text/csv",
      });

      expect(result).toEqual({
        storageKey:
          "organizations/8/experiment/42/final/attachment-id/results.csv",

        etag: "final-etag",

        lastModified: new Date("2026-08-19T10:00:00.000Z"),
      });
    });

    test("rejects finalization without the verified source ETag", async () => {
      const client = {
        send: jest.fn(),
      };

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      await expect(
        storage.finalizeObject({
          sourceStorageKey:
            "organizations/8/experiment/42/staging/upload-id/results.csv",

          destinationStorageKey:
            "organizations/8/experiment/42/final/attachment-id/results.csv",

          contentType: "text/csv",
        }),
      ).rejects.toThrow("Expected source ETag is required.");

      expect(client.send).not.toHaveBeenCalled();
    });

    test("deletes an object", async () => {
      const client = createMockClient();

      client.send.mockResolvedValue({});

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      const result = await storage.deleteObject({
        storageKey: "organizations/8/experiment/42/id/results.csv",
      });

      const [command] = client.send.mock.calls[0];

      expect(command).toBeInstanceOf(DeleteObjectCommand);

      expect(result).toEqual({
        deleted: true,
        storageKey: "organizations/8/experiment/42/id/results.csv",
      });
    });

    test("reads a byte range from an attachment object", async () => {
      const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

      const client = {
        send: jest.fn().mockResolvedValue({
          Body: {
            transformToByteArray: jest.fn().mockResolvedValue(bytes),
          },
        }),
      };

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      const result = await storage.getObjectRange({
        storageKey: "organizations/8/experiment/42/id/results.pdf",
        start: 0,
        end: 4,
      });

      expect(client.send).toHaveBeenCalledTimes(1);

      const [command] = client.send.mock.calls[0];

      expect(command).toBeInstanceOf(GetObjectCommand);

      expect(command.input).toEqual({
        Bucket: config.bucketName,
        Key: "organizations/8/experiment/42/id/results.pdf",
        Range: "bytes=0-4",
      });

      expect(Buffer.isBuffer(result)).toBe(true);

      expect(result).toEqual(Buffer.from(bytes));
    });

    test("rejects an invalid attachment object byte range", async () => {
      const client = {
        send: jest.fn(),
      };

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      await expect(
        storage.getObjectRange({
          storageKey: "organizations/8/experiment/42/id/results.pdf",
          start: -1,
          end: 4,
        }),
      ).rejects.toThrow("Object range start must be a non-negative integer.");

      await expect(
        storage.getObjectRange({
          storageKey: "organizations/8/experiment/42/id/results.pdf",
          start: 5,
          end: 4,
        }),
      ).rejects.toThrow(
        "Object range end must be greater than or equal to the start.",
      );

      expect(client.send).not.toHaveBeenCalled();
    });

    test("rejects an attachment object range response without a body", async () => {
      const client = {
        send: jest.fn().mockResolvedValue({}),
      };

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      await expect(
        storage.getObjectRange({
          storageKey: "organizations/8/experiment/42/id/results.pdf",
          start: 0,
          end: 4,
        }),
      ).rejects.toThrow("Storage object response did not contain a body.");

      expect(client.send).toHaveBeenCalledTimes(1);

      const [command] = client.send.mock.calls[0];

      expect(command).toBeInstanceOf(GetObjectCommand);
    });

    test("requires an end value when reading an attachment object range", async () => {
      const client = {
        send: jest.fn(),
      };

      const storage = createAttachmentStorage({
        provider: "r2",
        providerOptions: {
          client,
          config,
        },
      });

      await expect(
        storage.getObjectRange({
          storageKey: "organizations/8/experiment/42/id/results.pdf",
          start: 0,
        }),
      ).rejects.toThrow("Object range end must be a non-negative integer.");

      expect(client.send).not.toHaveBeenCalled();
    });

    test("rejects an unsupported provider", () => {
      expect(() =>
        createAttachmentStorage({
          provider: "local-disk",
        }),
      ).toThrow("Unsupported attachment storage provider");
    });
  });
});
