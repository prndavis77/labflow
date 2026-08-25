const mockAttachmentFindAll = jest.fn();

jest.mock("../models", () => ({
  Attachment: {
    findAll: mockAttachmentFindAll,
  },
}));

const {
  OrganizationAttachmentExportError,
  buildAttachmentExportPath,
  exportOrganizationAttachmentBinaries,
  sanitizeExportFileName,
} = require("../services/organizationAttachmentExportService");

const ORGANIZATION_ID = 17;

const createAttachment = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: ORGANIZATION_ID,
  uploadedById: 3,
  originalFileName: "chromatogram.pdf",
  fileExtension: ".pdf",
  mimeType: "application/pdf",
  fileSize: 4,
  verifiedFileSize: 4,
  checksum: null,
  entityType: "experiment",
  entityId: 42,
  category: "result",
  description: "HPLC result",
  uploadStatus: "available",
  isArchived: false,
  archivedAt: null,
  archivedById: null,
  ...overrides,
});

const createInternalAttachment = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: ORGANIZATION_ID,
  storageKey:
    "organizations/17/attachments/11111111-1111-4111-8111-111111111111/chromatogram.pdf",
  uploadStatus: "available",
  fileSize: 4,
  verifiedFileSize: 4,
  checksum: null,
  ...overrides,
});

const createStorage = (overrides = {}) => ({
  getObjectMetadata: jest.fn().mockResolvedValue({
    contentLength: 4,
    contentType: "application/pdf",
    etag: "etag-1",
    checksumSha256: null,
    lastModified: null,
    metadata: {},
  }),

  getObjectRange: jest.fn().mockResolvedValue(Buffer.from("test")),

  ...overrides,
});

describe("organizationAttachmentExportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAttachmentFindAll.mockResolvedValue([createInternalAttachment()]);
  });

  describe("sanitizeExportFileName", () => {
    it("removes path traversal and unsafe path characters", () => {
      expect(sanitizeExportFileName("../../unsafe:file?.pdf")).toBe(
        "unsafe_file_.pdf",
      );
    });

    it("provides a safe fallback filename", () => {
      expect(sanitizeExportFileName("....")).toBe("attachment");
    });
  });

  describe("buildAttachmentExportPath", () => {
    it("uses the attachment id as a collision-resistant directory", () => {
      expect(
        buildAttachmentExportPath({
          attachmentId: "abc-123",
          originalFileName: "../results.pdf",
        }),
      ).toBe("attachments/files/abc-123/results.pdf");
    });
  });

  it("exports an available attachment and creates a manifest entry", async () => {
    const storage = createStorage();

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [createAttachment()],
      storage,
    });

    expect(result.files).toHaveLength(1);

    expect(result.files[0]).toMatchObject({
      attachmentId: createAttachment().id,
      exportPath:
        "attachments/files/11111111-1111-4111-8111-111111111111/chromatogram.pdf",
    });

    expect(result.files[0].content.equals(Buffer.from("test"))).toBe(true);

    expect(result.manifest).toMatchObject({
      manifestVersion: 1,
      organizationId: ORGANIZATION_ID,
      attachmentCount: 1,
      exportedCount: 1,
      notExportedCount: 0,
      totalExportedBytes: 4,
    });

    expect(result.manifest.entries[0]).toMatchObject({
      attachmentId: createAttachment().id,
      originalFileName: "chromatogram.pdf",
      status: "exported",
      reason: null,
      storageFileSize: 4,
      exportedFileSize: 4,
    });

    expect(result.manifest.entries[0].sha256).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );

    expect(storage.getObjectMetadata).toHaveBeenCalledTimes(1);
    expect(storage.getObjectRange).toHaveBeenCalledWith({
      storageKey: createInternalAttachment().storageKey,
      start: 0,
      end: 3,
    });
  });

  it("does not export an attachment that is not available", async () => {
    const storage = createStorage();

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [
        createAttachment({
          uploadStatus: "pending",
        }),
      ],
      storage,
    });

    expect(result.files).toEqual([]);

    expect(result.manifest.entries[0]).toMatchObject({
      status: "not_exported",
      reason: "ATTACHMENT_NOT_AVAILABLE",
    });

    expect(storage.getObjectMetadata).not.toHaveBeenCalled();
    expect(storage.getObjectRange).not.toHaveBeenCalled();
  });

  it("records a missing database attachment instead of exporting another object", async () => {
    mockAttachmentFindAll.mockResolvedValue([]);

    const storage = createStorage();

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [createAttachment()],
      storage,
    });

    expect(result.files).toEqual([]);

    expect(result.manifest.entries[0]).toMatchObject({
      status: "not_exported",
      reason: "DATABASE_ATTACHMENT_NOT_FOUND",
      storageObjectPresent: false,
    });

    expect(storage.getObjectMetadata).not.toHaveBeenCalled();
  });

  it("rejects a supplied attachment belonging to another organization", async () => {
    const storage = createStorage();

    await expect(
      exportOrganizationAttachmentBinaries({
        organizationId: ORGANIZATION_ID,
        attachments: [
          createAttachment({
            organizationId: 99,
          }),
        ],
        storage,
      }),
    ).rejects.toMatchObject({
      code: "ATTACHMENT_ORGANIZATION_MISMATCH",
    });

    expect(mockAttachmentFindAll).not.toHaveBeenCalled();
    expect(storage.getObjectMetadata).not.toHaveBeenCalled();
  });

  it("rejects an internal storage key outside the organization namespace", async () => {
    mockAttachmentFindAll.mockResolvedValue([
      createInternalAttachment({
        storageKey:
          "organizations/99/attachments/11111111-1111-4111-8111-111111111111/chromatogram.pdf",
      }),
    ]);

    const storage = createStorage();

    await expect(
      exportOrganizationAttachmentBinaries({
        organizationId: ORGANIZATION_ID,
        attachments: [createAttachment()],
        storage,
      }),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_STORAGE_PREFIX_MISMATCH",
    });

    expect(storage.getObjectRange).not.toHaveBeenCalled();
  });

  it("does not export when the R2 object size differs from the verified database size", async () => {
    const storage = createStorage({
      getObjectMetadata: jest.fn().mockResolvedValue({
        contentLength: 5,
      }),
    });

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [createAttachment()],
      storage,
    });

    expect(result.files).toEqual([]);

    expect(result.manifest.entries[0]).toMatchObject({
      status: "not_exported",
      reason: "FILE_SIZE_MISMATCH",
      expectedFileSize: 4,
      storageFileSize: 5,
    });

    expect(storage.getObjectRange).not.toHaveBeenCalled();
  });

  it("does not export a partial R2 read", async () => {
    const storage = createStorage({
      getObjectRange: jest.fn().mockResolvedValue(Buffer.from("tes")),
    });

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [createAttachment()],
      storage,
    });

    expect(result.files).toEqual([]);

    expect(result.manifest.entries[0]).toMatchObject({
      status: "not_exported",
      reason: "EXPORTED_FILE_SIZE_MISMATCH",
      storageFileSize: 4,
      exportedFileSize: 3,
    });
  });

  it("verifies a stored SHA-256 checksum when one is available", async () => {
    const expectedChecksum = require("crypto")
      .createHash("sha256")
      .update(Buffer.from("test"))
      .digest("hex");

    const storage = createStorage();

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [
        createAttachment({
          checksum: expectedChecksum,
        }),
      ],
      storage,
    });

    expect(result.files).toHaveLength(1);
    expect(result.manifest.entries[0]).toMatchObject({
      status: "exported",
      sha256: expectedChecksum,
    });
  });

  it("refuses an attachment when its stored SHA-256 checksum does not match", async () => {
    const storage = createStorage();

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [
        createAttachment({
          checksum: "a".repeat(64),
        }),
      ],
      storage,
    });

    expect(result.files).toEqual([]);

    expect(result.manifest.entries[0]).toMatchObject({
      status: "not_exported",
      reason: "CHECKSUM_MISMATCH",
    });
  });

  it("records an unavailable R2 object without failing the whole export", async () => {
    const storage = createStorage({
      getObjectMetadata: jest.fn().mockRejectedValue(new Error("NoSuchKey")),
    });

    const result = await exportOrganizationAttachmentBinaries({
      organizationId: ORGANIZATION_ID,
      attachments: [createAttachment()],
      storage,
    });

    expect(result.files).toEqual([]);

    expect(result.manifest.entries[0]).toMatchObject({
      status: "not_exported",
      reason: "STORAGE_OBJECT_UNAVAILABLE",
      storageObjectPresent: false,
    });
  });

  it("rejects duplicate supplied attachment ids", async () => {
    const attachment = createAttachment();
    const storage = createStorage();

    await expect(
      exportOrganizationAttachmentBinaries({
        organizationId: ORGANIZATION_ID,
        attachments: [attachment, { ...attachment }],
        storage,
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_ATTACHMENT_ID",
    });

    expect(mockAttachmentFindAll).not.toHaveBeenCalled();
  });

  it("rejects invalid organization ids", async () => {
    const storage = createStorage();

    await expect(
      exportOrganizationAttachmentBinaries({
        organizationId: "invalid",
        attachments: [],
        storage,
      }),
    ).rejects.toBeInstanceOf(OrganizationAttachmentExportError);
  });
});
