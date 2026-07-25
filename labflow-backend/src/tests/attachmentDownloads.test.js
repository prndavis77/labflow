jest.mock("../models", () => ({
  Attachment: {
    findOne: jest.fn(),
  },

  User: {},

  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock("../utils/attachmentAccess", () => ({
  authorizeAttachmentTarget: jest.fn(),
}));

jest.mock("../storage/attachmentStorage", () => ({
  getAttachmentStorage: jest.fn(),
}));

jest.mock("../utils/auditLogger", () => ({
  writeAuditLog: jest.fn(),
}));

const { Attachment } = require("../models");

const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");

const { getAttachmentStorage } = require("../storage/attachmentStorage");

const { writeAuditLog } = require("../utils/auditLogger");

const {
  createAttachmentDownloadUrl,
} = require("../controllers/attachmentController");

const ATTACHMENT_ID = "7dcf9559-0f93-4fb2-8193-5fda32180592";

const ORGANIZATION_ID = 10;
const USER_ID = 3;
const ENTITY_ID = 42;

const STORAGE_KEY =
  `organizations/${ORGANIZATION_ID}/` +
  `experiment/${ENTITY_ID}/` +
  `${ATTACHMENT_ID}/` +
  "gc-ms-run-04.csv";

const createResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);

  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const createUser = (overrides = {}) => ({
  id: USER_ID,
  organizationId: ORGANIZATION_ID,
  role: "researcher",
  isActive: true,
  ...overrides,
});

const createAttachment = (overrides = {}) => ({
  id: ATTACHMENT_ID,

  organizationId: ORGANIZATION_ID,

  uploadedById: USER_ID,

  originalFileName: "GC-MS Run 04.csv",

  fileName: "gc-ms-run-04.csv",

  fileExtension: ".csv",
  mimeType: "text/csv",
  fileSize: 1024,
  verifiedFileSize: 1024,

  storageProvider: "r2",
  storageKey: STORAGE_KEY,

  checksum: "internal-checksum",

  etag: "internal-etag",

  entityType: "experiment",
  entityId: ENTITY_ID,

  category: "raw_data",

  description: "Raw instrument export.",

  uploadStatus: "available",
  uploadExpiresAt: null,

  isArchived: false,
  archivedAt: null,
  archivedById: null,

  uploadedBy: {
    id: USER_ID,
    name: "Researcher",
    email: "researcher@example.com",
    role: "researcher",
  },

  createdAt: new Date("2026-07-24T10:00:00.000Z"),

  updatedAt: new Date("2026-07-24T10:05:00.000Z"),

  ...overrides,
});

const createRequest = ({ id = ATTACHMENT_ID, user = createUser() } = {}) => ({
  params: {
    id,
  },

  user,

  headers: {
    "user-agent": "Jest attachment test",
  },

  socket: {
    remoteAddress: "127.0.0.1",
  },
});

const createStorage = (overrides = {}) => ({
  getObjectMetadata: jest.fn().mockResolvedValue({
    contentLength: 1024,
    contentType: "text/csv",
    etag: "internal-etag",
    checksumSha256: "internal-checksum",
  }),

  createDownloadUrl: jest.fn().mockResolvedValue({
    url: "https://download.example.test/signed-file",
    method: "GET",
    expiresIn: 60,
  }),

  ...overrides,
});

describe("attachment download endpoint", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    writeAuditLog.mockResolvedValue(undefined);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("creates a signed download URL for an accessible attachment", async () => {
    const attachment = createAttachment();

    const storage = createStorage();

    Attachment.findOne.mockResolvedValue(attachment);

    authorizeAttachmentTarget.mockResolvedValue({
      allowed: true,

      target: {
        id: ENTITY_ID,

        organizationId: ORGANIZATION_ID,
      },
    });

    getAttachmentStorage.mockReturnValue(storage);

    const req = createRequest();

    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(Attachment.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ATTACHMENT_ID,

          organizationId: ORGANIZATION_ID,

          uploadStatus: "available",

          isArchived: false,
        },
      }),
    );

    expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
      user: req.user,

      entityType: "experiment",

      entityId: ENTITY_ID,

      action: "view",
    });

    expect(storage.getObjectMetadata).toHaveBeenCalledWith({
      storageKey: STORAGE_KEY,
    });

    expect(storage.createDownloadUrl).toHaveBeenCalledWith({
      storageKey: STORAGE_KEY,

      originalFileName: "GC-MS Run 04.csv",

      mimeType: "text/csv",

      expiresInSeconds: 60,
    });

    expect(writeAuditLog).toHaveBeenCalledWith({
      req,

      action: "attachment.download_url_created",

      entityType: "attachment",

      entityId: ATTACHMENT_ID,

      summary: "Download URL created for GC-MS Run 04.csv.",

      metadata: {
        attachmentId: ATTACHMENT_ID,

        targetEntityType: "experiment",

        targetEntityId: ENTITY_ID,

        originalFileName: "GC-MS Run 04.csv",

        mimeType: "text/csv",

        fileSize: 1024,

        category: "raw_data",
      },
    });

    expect(res.status).toHaveBeenCalledWith(200);

    const responseBody = res.json.mock.calls[0][0];

    expect(responseBody).toEqual({
      status: "success",

      data: {
        attachment: expect.objectContaining({
          id: ATTACHMENT_ID,

          originalFileName: "GC-MS Run 04.csv",

          uploadStatus: "available",
        }),

        download: {
          url: "https://download.example.test/signed-file",

          method: "GET",
          expiresIn: 60,
        },
      },
    });

    expect(responseBody.data.attachment.storageKey).toBeUndefined();

    expect(responseBody.data.attachment.etag).toBeUndefined();

    expect(responseBody.data.attachment.checksum).toBeUndefined();
  });

  test("returns 400 for an invalid attachment UUID", async () => {
    const req = createRequest({
      id: "invalid-id",
    });

    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(Attachment.findOne).not.toHaveBeenCalled();

    expect(getAttachmentStorage).not.toHaveBeenCalled();

    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  test("returns 404 when the attachment does not exist in the organization", async () => {
    Attachment.findOne.mockResolvedValue(null);

    const req = createRequest();

    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(404);

    expect(authorizeAttachmentTarget).not.toHaveBeenCalled();

    expect(getAttachmentStorage).not.toHaveBeenCalled();

    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  test("returns 403 when target access is forbidden", async () => {
    Attachment.findOne.mockResolvedValue(createAttachment());

    authorizeAttachmentTarget.mockResolvedValue({
      allowed: false,
      reason: "forbidden",
    });

    const req = createRequest();

    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(getAttachmentStorage).not.toHaveBeenCalled();

    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  test("returns 404 when the attachment target no longer exists", async () => {
    Attachment.findOne.mockResolvedValue(createAttachment());

    authorizeAttachmentTarget.mockResolvedValue({
      allowed: false,
      reason: "not_found",
    });

    const req = createRequest();

    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(404);

    expect(getAttachmentStorage).not.toHaveBeenCalled();

    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  test.each([
    ["NotFound", undefined],

    ["NoSuchKey", undefined],

    [
      "StorageError",

      {
        httpStatusCode: 404,
      },
    ],
  ])(
    "returns 404 when storage reports a missing object using %s",
    async (errorName, metadata) => {
      Attachment.findOne.mockResolvedValue(createAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const storageError = new Error("Object not found");

      storageError.name = errorName;

      if (metadata) {
        storageError.$metadata = metadata;
      }

      const storage = createStorage({
        getObjectMetadata: jest.fn().mockRejectedValue(storageError),
      });

      getAttachmentStorage.mockReturnValue(storage);

      const req = createRequest();

      const res = createResponse();

      await createAttachmentDownloadUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(storage.createDownloadUrl).not.toHaveBeenCalled();

      expect(writeAuditLog).not.toHaveBeenCalled();
    },
  );

  test("returns 503 when storage signing fails unexpectedly", async () => {
    Attachment.findOne.mockResolvedValue(createAttachment());

    authorizeAttachmentTarget.mockResolvedValue({
      allowed: true,
      target: {},
    });

    const storage = createStorage({
      createDownloadUrl: jest
        .fn()
        .mockRejectedValue(new Error("Signing failed")),
    });

    getAttachmentStorage.mockReturnValue(storage);

    const req = createRequest();

    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(storage.getObjectMetadata).toHaveBeenCalledWith({
      storageKey: STORAGE_KEY,
    });

    expect(res.status).toHaveBeenCalledWith(503);

    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  test("returns 500 when the attachment query fails", async () => {
    Attachment.findOne.mockRejectedValue(new Error("Database failure"));

    const req = createRequest();

    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(500);

    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  test("returns 503 when storage verification fails", async () => {
    Attachment.findOne.mockResolvedValue(createAttachment());

    authorizeAttachmentTarget.mockResolvedValue({
      allowed: true,
      target: {},
    });

    const storage = createStorage({
      getObjectMetadata: jest
        .fn()
        .mockRejectedValue(new Error("Storage unavailable")),
    });

    getAttachmentStorage.mockReturnValue(storage);

    const req = createRequest();
    const res = createResponse();

    await createAttachmentDownloadUrl(req, res);

    expect(storage.createDownloadUrl).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(503);

    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
