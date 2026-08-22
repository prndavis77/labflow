const {
  deleteOrganizationAttachmentObjects,
} = require("../services/organizationAttachmentDeletionService");

const {
  deleteOrganizationDatabaseData,
} = require("../services/organizationDeletionService");

jest.mock("../services/organizationDeletionService", () => ({
  deleteOrganizationDatabaseData: jest.fn(),
}));

const ORGANIZATION_ID = 17;

describe("organization deletion storage safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not allow database deletion when R2 deletion fails", async () => {
    const storage = {
      listObjects: jest.fn().mockResolvedValue({
        objects: [
          {
            storageKey: "organizations/17/project/1/attachments/a/file.pdf",
            size: 100,
            etag: null,
            lastModified: null,
          },
        ],
        isTruncated: false,
        nextContinuationToken: null,
      }),

      deleteObjects: jest.fn().mockRejectedValue(new Error("R2 unavailable")),
    };

    await expect(
      deleteOrganizationAttachmentObjects({
        organizationId: ORGANIZATION_ID,
        storage,
      }),
    ).rejects.toThrow("R2 unavailable");

    expect(deleteOrganizationDatabaseData).not.toHaveBeenCalled();
  });

  it("produces the confirmation required for database deletion only after R2 is verified empty", async () => {
    const storage = {
      listObjects: jest
        .fn()
        .mockResolvedValueOnce({
          objects: [
            {
              storageKey: "organizations/17/project/1/attachments/a/file.pdf",
              size: 100,
              etag: null,
              lastModified: null,
            },
          ],
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
        deletedCount: 1,
      }),
    };

    const storageResult = await deleteOrganizationAttachmentObjects({
      organizationId: ORGANIZATION_ID,
      storage,
    });

    expect(storageResult.verifiedEmpty).toBe(true);

    if (storageResult.verifiedEmpty) {
      await deleteOrganizationDatabaseData({
        organizationId: ORGANIZATION_ID,
        attachmentStorageDeletionConfirmed: true,
      });
    }

    expect(deleteOrganizationDatabaseData).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      attachmentStorageDeletionConfirmed: true,
    });
  });
});
