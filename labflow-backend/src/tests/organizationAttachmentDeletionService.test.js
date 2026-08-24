const {
  OrganizationAttachmentDeletionError,
  deleteOrganizationAttachmentObjects,
  getOrganizationAttachmentStorageInventory,
  verifyOrganizationAttachmentStorageEmpty,
} = require("../services/organizationAttachmentDeletionService");

const ORGANIZATION_ID = 17;
const PREFIX = "organizations/17/";

const createObject = (storageKey, size = 100) => ({
  storageKey,
  size,
  etag: null,
  lastModified: null,
});

describe("organizationAttachmentDeletionService", () => {
  describe("getOrganizationAttachmentStorageInventory", () => {
    it("collects every page beneath the organization prefix", async () => {
      const storage = {
        listObjects: jest
          .fn()
          .mockResolvedValueOnce({
            objects: [
              createObject(
                "organizations/17/project/1/attachments/a/file.pdf",
                100,
              ),
            ],
            isTruncated: true,
            nextContinuationToken: "page-2",
          })
          .mockResolvedValueOnce({
            objects: [
              createObject(
                "organizations/17/project/1/staging/b/file.csv",
                200,
              ),
            ],
            isTruncated: false,
            nextContinuationToken: null,
          }),

        deleteObjects: jest.fn(),
      };

      const result = await getOrganizationAttachmentStorageInventory({
        organizationId: ORGANIZATION_ID,
        storage,
      });

      expect(storage.listObjects).toHaveBeenNthCalledWith(1, {
        prefix: PREFIX,
        continuationToken: undefined,
        maxKeys: 1000,
      });

      expect(storage.listObjects).toHaveBeenNthCalledWith(2, {
        prefix: PREFIX,
        continuationToken: "page-2",
        maxKeys: 1000,
      });

      expect(result.objectCount).toBe(2);
      expect(result.totalBytes).toBe(300);
    });

    it("rejects invalid truncated pagination", async () => {
      const storage = {
        listObjects: jest.fn().mockResolvedValue({
          objects: [],
          isTruncated: true,
          nextContinuationToken: null,
        }),
        deleteObjects: jest.fn(),
      };

      await expect(
        getOrganizationAttachmentStorageInventory({
          organizationId: ORGANIZATION_ID,
          storage,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_STORAGE_PAGINATION",
      });
    });
  });

  describe("deleteOrganizationAttachmentObjects", () => {
    it("deletes staging, permanent, and orphaned objects until the prefix is empty", async () => {
      const firstBatch = [
        createObject("organizations/17/project/1/attachments/a/final.pdf"),
        createObject("organizations/17/project/1/staging/b/pending.csv"),
      ];

      const secondBatch = [
        createObject(
          "organizations/17/experiment/2/attachments/c/orphaned.docx",
        ),
      ];

      const storage = {
        listObjects: jest
          .fn()
          .mockResolvedValueOnce({
            objects: firstBatch,
            isTruncated: false,
            nextContinuationToken: null,
          })
          .mockResolvedValueOnce({
            objects: secondBatch,
            isTruncated: false,
            nextContinuationToken: null,
          })
          .mockResolvedValueOnce({
            objects: [],
            isTruncated: false,
            nextContinuationToken: null,
          })
          .mockResolvedValueOnce({
            objects: [],
            isTruncated: false,
            nextContinuationToken: null,
          }),

        deleteObjects: jest.fn().mockResolvedValue({
          deleted: true,
        }),
      };

      const result = await deleteOrganizationAttachmentObjects({
        organizationId: ORGANIZATION_ID,
        storage,
      });

      expect(storage.deleteObjects).toHaveBeenNthCalledWith(1, {
        storageKeys: firstBatch.map((object) => object.storageKey),
      });

      expect(storage.deleteObjects).toHaveBeenNthCalledWith(2, {
        storageKeys: secondBatch.map((object) => object.storageKey),
      });

      expect(result).toEqual({
        organizationId: ORGANIZATION_ID,
        prefix: PREFIX,
        deletedObjectCount: 3,
        deletionRounds: 2,
        verifiedEmpty: true,
      });
    });

    it("deletes only the exact organization prefix and preserves neighboring organization prefixes", async () => {
      const objects = new Set([
        "organizations/17/project/1/attachments/a/file.pdf",
        "organizations/17/project/1/staging/b/pending.csv",
        "organizations/170/project/1/attachments/c/neighbor.pdf",
        "organizations/171/project/1/attachments/d/neighbor.pdf",
        "organizations/99/project/1/attachments/e/neighbor.pdf",
      ]);

      const storage = {
        listObjects: jest.fn(async ({ prefix }) => {
          const matchingObjects = [...objects]
            .filter((storageKey) => storageKey.startsWith(prefix))
            .map((storageKey) => createObject(storageKey));

          return {
            objects: matchingObjects,
            isTruncated: false,
            nextContinuationToken: null,
          };
        }),

        deleteObjects: jest.fn(async ({ storageKeys }) => {
          for (const storageKey of storageKeys) {
            objects.delete(storageKey);
          }

          return {
            deleted: true,
          };
        }),
      };

      const result = await deleteOrganizationAttachmentObjects({
        organizationId: 17,
        storage,
      });

      expect(result).toEqual({
        organizationId: 17,
        prefix: "organizations/17/",
        deletedObjectCount: 2,
        deletionRounds: 1,
        verifiedEmpty: true,
      });

      expect([...objects].sort()).toEqual(
        [
          "organizations/170/project/1/attachments/c/neighbor.pdf",
          "organizations/171/project/1/attachments/d/neighbor.pdf",
          "organizations/99/project/1/attachments/e/neighbor.pdf",
        ].sort(),
      );

      expect(storage.deleteObjects).toHaveBeenCalledTimes(1);

      expect(storage.deleteObjects).toHaveBeenCalledWith({
        storageKeys: [
          "organizations/17/project/1/attachments/a/file.pdf",
          "organizations/17/project/1/staging/b/pending.csv",
        ],
      });
    });

    it("is safely idempotent when the organization prefix is already empty", async () => {
      const storage = {
        listObjects: jest.fn().mockResolvedValue({
          objects: [],
          isTruncated: false,
          nextContinuationToken: null,
        }),
        deleteObjects: jest.fn(),
      };

      const result = await deleteOrganizationAttachmentObjects({
        organizationId: ORGANIZATION_ID,
        storage,
      });

      expect(storage.deleteObjects).not.toHaveBeenCalled();

      expect(result).toEqual({
        organizationId: ORGANIZATION_ID,
        prefix: PREFIX,
        deletedObjectCount: 0,
        deletionRounds: 0,
        verifiedEmpty: true,
      });
    });

    it("does not claim success if bulk deletion fails", async () => {
      const storage = {
        listObjects: jest.fn().mockResolvedValue({
          objects: [
            createObject("organizations/17/project/1/attachments/a/file.pdf"),
          ],
          isTruncated: false,
          nextContinuationToken: null,
        }),

        deleteObjects: jest
          .fn()
          .mockRejectedValue(new Error("R2 deletion failed")),
      };

      await expect(
        deleteOrganizationAttachmentObjects({
          organizationId: ORGANIZATION_ID,
          storage,
        }),
      ).rejects.toThrow("R2 deletion failed");
    });

    it("rejects an object outside the organization namespace", async () => {
      const storage = {
        listObjects: jest.fn().mockResolvedValue({
          objects: [
            createObject("organizations/99/project/1/attachments/a/file.pdf"),
          ],
          isTruncated: false,
          nextContinuationToken: null,
        }),
        deleteObjects: jest.fn(),
      };

      await expect(
        deleteOrganizationAttachmentObjects({
          organizationId: ORGANIZATION_ID,
          storage,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_STORAGE_PREFIX_MISMATCH",
      });

      expect(storage.deleteObjects).not.toHaveBeenCalled();
    });
  });

  describe("verifyOrganizationAttachmentStorageEmpty", () => {
    it("returns empty true when no object remains", async () => {
      const storage = {
        listObjects: jest.fn().mockResolvedValue({
          objects: [],
          isTruncated: false,
          nextContinuationToken: null,
        }),
        deleteObjects: jest.fn(),
      };

      await expect(
        verifyOrganizationAttachmentStorageEmpty({
          organizationId: ORGANIZATION_ID,
          storage,
        }),
      ).resolves.toMatchObject({
        empty: true,
      });
    });

    it("returns empty false when an object remains", async () => {
      const storage = {
        listObjects: jest.fn().mockResolvedValue({
          objects: [
            createObject("organizations/17/project/1/attachments/a/file.pdf"),
          ],
          isTruncated: false,
          nextContinuationToken: null,
        }),
        deleteObjects: jest.fn(),
      };

      await expect(
        verifyOrganizationAttachmentStorageEmpty({
          organizationId: ORGANIZATION_ID,
          storage,
        }),
      ).resolves.toMatchObject({
        empty: false,
        remainingObjectCountAtLeast: 1,
      });
    });
  });

  it("rejects a storage provider without organization-deletion support", async () => {
    await expect(
      deleteOrganizationAttachmentObjects({
        organizationId: ORGANIZATION_ID,
        storage: {
          deleteObject: jest.fn(),
        },
      }),
    ).rejects.toBeInstanceOf(OrganizationAttachmentDeletionError);
  });
});
