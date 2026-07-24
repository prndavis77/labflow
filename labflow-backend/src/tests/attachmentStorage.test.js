const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const {
  createAttachmentStorage,
} = require("../storage/createAttachmentStorage");

const {
  createAttachmentStorageKey,
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
    test("creates an organization-scoped attachment key", () => {
      const key = createAttachmentStorageKey({
        organizationId: 8,
        entityType: "experiment",
        entityId: 42,
        attachmentId: "7dcf9559-0f93-4fb2-8193-5fda32180592",
        fileName: "gc-ms-run-04.csv",
      });

      expect(key).toBe(
        "organizations/8/experiment/42/" +
          "7dcf9559-0f93-4fb2-8193-5fda32180592/" +
          "gc-ms-run-04.csv",
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
        createAttachmentStorageKey({
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
      });

      expect(options).toEqual({
        expiresIn: 300,
      });
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

    test("rejects an unsupported provider", () => {
      expect(() =>
        createAttachmentStorage({
          provider: "local-disk",
        }),
      ).toThrow("Unsupported attachment storage provider");
    });
  });
});
