const {
  DeleteObjectsCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

const {
  createR2AttachmentStorage,
} = require("../storage/providers/r2AttachmentStorage");

const createStorage = (send) => {
  return createR2AttachmentStorage({
    client: {
      send,
    },

    config: {
      region: "auto",
      endpoint: "https://example.r2.cloudflarestorage.com",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucketName: "labflow-test-bucket",
    },
  });
};

describe("R2 organization deletion primitives", () => {
  describe("listObjects", () => {
    it("lists only objects beneath the requested organization prefix", async () => {
      const send = jest.fn().mockResolvedValue({
        Contents: [
          {
            Key: "organizations/17/project/10/attachments/a/file.pdf",
            Size: 123,
            ETag: '"etag-1"',
            LastModified: new Date("2026-08-22T10:00:00.000Z"),
          },
          {
            Key: "organizations/17/project/10/staging/b/file.csv",
            Size: 456,
            ETag: '"etag-2"',
          },
        ],
        IsTruncated: true,
        NextContinuationToken: "next-page",
      });

      const storage = createStorage(send);

      const result = await storage.listObjects({
        prefix: "organizations/17/",
        maxKeys: 1000,
      });

      expect(send).toHaveBeenCalledTimes(1);

      const command = send.mock.calls[0][0];

      expect(command).toBeInstanceOf(ListObjectsV2Command);

      expect(command.input).toEqual({
        Bucket: "labflow-test-bucket",
        Prefix: "organizations/17/",
        MaxKeys: 1000,
        ContinuationToken: undefined,
      });

      expect(result).toEqual({
        objects: [
          {
            storageKey: "organizations/17/project/10/attachments/a/file.pdf",
            size: 123,
            etag: "etag-1",
            lastModified: new Date("2026-08-22T10:00:00.000Z"),
          },
          {
            storageKey: "organizations/17/project/10/staging/b/file.csv",
            size: 456,
            etag: "etag-2",
            lastModified: null,
          },
        ],
        isTruncated: true,
        nextContinuationToken: "next-page",
      });
    });

    it("passes a continuation token to R2", async () => {
      const send = jest.fn().mockResolvedValue({
        Contents: [],
        IsTruncated: false,
      });

      const storage = createStorage(send);

      await storage.listObjects({
        prefix: "organizations/17/",
        continuationToken: "page-two",
        maxKeys: 500,
      });

      const command = send.mock.calls[0][0];

      expect(command.input).toEqual({
        Bucket: "labflow-test-bucket",
        Prefix: "organizations/17/",
        MaxKeys: 500,
        ContinuationToken: "page-two",
      });
    });

    it("rejects an unsafe prefix before contacting R2", async () => {
      const send = jest.fn();

      const storage = createStorage(send);

      await expect(
        storage.listObjects({
          prefix: "organizations/17",
        }),
      ).rejects.toThrow("Storage prefix format is invalid.");

      expect(send).not.toHaveBeenCalled();
    });

    it("rejects an object returned outside the requested prefix", async () => {
      const send = jest.fn().mockResolvedValue({
        Contents: [
          {
            Key: "organizations/99/project/1/attachments/a/file.pdf",
          },
        ],
      });

      const storage = createStorage(send);

      await expect(
        storage.listObjects({
          prefix: "organizations/17/",
        }),
      ).rejects.toThrow(
        "Storage provider returned an object outside the requested prefix.",
      );
    });
  });

  describe("deleteObjects", () => {
    it("bulk deletes the supplied storage keys", async () => {
      const send = jest.fn().mockResolvedValue({
        Errors: [],
      });

      const storage = createStorage(send);

      const result = await storage.deleteObjects({
        storageKeys: [
          "organizations/17/project/10/attachments/a/file.pdf",
          "organizations/17/project/10/staging/b/file.csv",
        ],
      });

      const command = send.mock.calls[0][0];

      expect(command).toBeInstanceOf(DeleteObjectsCommand);

      expect(command.input).toEqual({
        Bucket: "labflow-test-bucket",
        Delete: {
          Objects: [
            {
              Key: "organizations/17/project/10/attachments/a/file.pdf",
            },
            {
              Key: "organizations/17/project/10/staging/b/file.csv",
            },
          ],
          Quiet: true,
        },
      });

      expect(result).toEqual({
        deleted: true,
        deletedCount: 2,
      });
    });

    it("rejects more than 1000 objects", async () => {
      const send = jest.fn();

      const storage = createStorage(send);

      const storageKeys = Array.from(
        {
          length: 1001,
        },
        (_, index) =>
          `organizations/17/project/10/attachments/${index}/file.pdf`,
      );

      await expect(
        storage.deleteObjects({
          storageKeys,
        }),
      ).rejects.toThrow(
        "Bulk storage deletion cannot exceed 1000 objects per request.",
      );

      expect(send).not.toHaveBeenCalled();
    });

    it("fails when R2 reports a partial bulk-deletion error", async () => {
      const send = jest.fn().mockResolvedValue({
        Errors: [
          {
            Key: "organizations/17/project/10/attachments/a/file.pdf",
            Code: "InternalError",
          },
        ],
      });

      const storage = createStorage(send);

      await expect(
        storage.deleteObjects({
          storageKeys: ["organizations/17/project/10/attachments/a/file.pdf"],
        }),
      ).rejects.toMatchObject({
        code: "STORAGE_BULK_DELETE_PARTIAL_FAILURE",
        failedCount: 1,
      });
    });
  });
});
