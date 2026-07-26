jest.mock("../models", () => ({
  Attachment: {
    create: jest.fn(),
    findOne: jest.fn(),
    sequelize: {
      transaction: jest.fn(),
    },
  },
  User: {},
}));

jest.mock("../utils/attachmentAccess", () => ({
  authorizeAttachmentTarget: jest.fn(),
}));

jest.mock("../utils/auditLogger", () => ({
  writeAuditLog: jest.fn(),
}));

const { Attachment } = require("../models");

const sequelize = Attachment.sequelize;

const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");

const { writeAuditLog } = require("../utils/auditLogger");

const {
  archiveAttachment,
  updateAttachmentMetadata,
} = require("../controllers/attachmentController");

const ATTACHMENT_ID = "7dcf9559-0f93-4fb2-8193-5fda32180592";

const ORGANIZATION_ID = 10;
const USER_ID = 3;
const OTHER_USER_ID = 99;
const ENTITY_ID = 42;

const createResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);

  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const createTransaction = () => ({
  commit: jest.fn().mockResolvedValue(undefined),

  rollback: jest.fn().mockResolvedValue(undefined),

  LOCK: {
    UPDATE: "UPDATE",
  },
});

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

  storageKey: "internal-storage-key",

  checksum: "internal-checksum",

  etag: "internal-etag",

  entityType: "experiment",
  entityId: ENTITY_ID,

  category: "raw_data",

  description: "Original description.",

  uploadStatus: "available",
  uploadExpiresAt: null,

  isArchived: false,
  archivedAt: null,
  archivedById: null,

  createdAt: new Date("2026-07-24T10:00:00.000Z"),

  updatedAt: new Date("2026-07-24T10:05:00.000Z"),

  uploadedBy: {
    id: USER_ID,
    name: "Researcher",
    email: "researcher@example.com",
    role: "researcher",
  },

  save: jest.fn().mockResolvedValue(undefined),

  ...overrides,
});

const createRequest = ({
  id = ATTACHMENT_ID,
  user = createUser(),
  body = {},
} = {}) => ({
  params: {
    id,
  },

  user,
  body,

  headers: {
    "user-agent": "Jest attachment test",
  },

  socket: {
    remoteAddress: "127.0.0.1",
  },
});

describe("attachment metadata and archive endpoints", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    writeAuditLog.mockResolvedValue(undefined);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("updateAttachmentMetadata", () => {
    test("updates attachment metadata", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment();

      const updatedAttachment = createAttachment({
        category: "result",
        description: "Processed results.",
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(updatedAttachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest({
        body: {
          category: "RESULT",

          description: "  Processed results.  ",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(Attachment.findOne).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            id: ATTACHMENT_ID,

            organizationId: ORGANIZATION_ID,

            uploadStatus: "available",

            isArchived: false,
          },

          transaction,

          lock: transaction.LOCK.UPDATE,
        }),
      );

      expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
        user: req.user,

        entityType: "experiment",

        entityId: ENTITY_ID,

        action: "update",

        transaction,
      });

      expect(attachment.category).toBe("result");

      expect(attachment.description).toBe("Processed results.");

      expect(attachment.save).toHaveBeenCalledWith({
        transaction,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(writeAuditLog).toHaveBeenCalledWith({
        req,

        action: "attachment.metadata_updated",

        entityType: "attachment",

        entityId: null,

        summary: "Attachment metadata updated for GC-MS Run 04.csv.",

        metadata: {
          attachmentId: ATTACHMENT_ID,

          targetEntityType: "experiment",

          targetEntityId: ENTITY_ID,

          originalFileName: "GC-MS Run 04.csv",

          previousMetadata: {
            category: "raw_data",

            description: "Original description.",
          },

          updatedMetadata: {
            category: "result",

            description: "Processed results.",
          },
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("allows clearing the description", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(
          createAttachment({
            description: null,
          }),
        );

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest({
        body: {
          description: "",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(attachment.description).toBeNull();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 400 for an invalid UUID", async () => {
      const req = createRequest({
        id: "invalid-id",

        body: {
          category: "result",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    test("returns 400 when no metadata fields are provided", async () => {
      const req = createRequest({
        body: {},
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    test("returns 400 for an invalid category", async () => {
      const req = createRequest({
        body: {
          category: "not-a-category",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 404 when the attachment is not found", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(null);

      const req = createRequest({
        body: {
          category: "result",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 403 when target update access is forbidden", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(createAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "forbidden",
      });

      const req = createRequest({
        body: {
          category: "result",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("prevents a researcher from updating another user's attachment", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(
        createAttachment({
          uploadedById: OTHER_USER_ID,
        }),
      );

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest({
        body: {
          category: "result",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("allows a supervisor to update another user's attachment", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment({
        uploadedById: OTHER_USER_ID,
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(
          createAttachment({
            uploadedById: OTHER_USER_ID,

            category: "result",
          }),
        );

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest({
        user: createUser({
          id: 2,
          role: "supervisor",
        }),

        body: {
          category: "result",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 500 when the updated attachment cannot be reloaded", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(createAttachment())
        .mockResolvedValueOnce(null);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest({
        body: {
          category: "result",
        },
      });

      const res = createResponse();

      await updateAttachmentMetadata(req, res);

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(writeAuditLog).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("archiveAttachment", () => {
    test("archives an available attachment", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment();

      const archivedAttachment = createAttachment({
        isArchived: true,
        archivedAt: new Date("2026-07-25T10:00:00.000Z"),
        archivedById: USER_ID,
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(archivedAttachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest();

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
        user: req.user,

        entityType: "experiment",

        entityId: ENTITY_ID,

        action: "archive",

        transaction,
      });

      expect(attachment.isArchived).toBe(true);

      expect(attachment.archivedAt).toEqual(expect.any(Date));

      expect(attachment.archivedById).toBe(USER_ID);

      expect(attachment.save).toHaveBeenCalledWith({
        transaction,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(writeAuditLog).toHaveBeenCalledWith({
        req,

        action: "attachment.archived",

        entityType: "attachment",

        entityId: null,

        summary: "Attachment archived: GC-MS Run 04.csv.",

        metadata: {
          attachmentId: ATTACHMENT_ID,

          targetEntityType: "experiment",

          targetEntityId: ENTITY_ID,

          originalFileName: "GC-MS Run 04.csv",

          archivedById: USER_ID,
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns an already archived attachment idempotently", async () => {
      const transaction = createTransaction();

      Attachment.findOne.mockResolvedValue(
        createAttachment({
          isArchived: true,

          archivedAt: new Date(),

          archivedById: USER_ID,
        }),
      );

      sequelize.transaction.mockResolvedValue(transaction);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest();

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
        user: req.user,
        entityType: "experiment",
        entityId: ENTITY_ID,
        action: "archive",
        transaction,
      });

      expect(writeAuditLog).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("does not return an archived attachment when target access is forbidden", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(
        createAttachment({
          isArchived: true,
          archivedAt: new Date(),
          archivedById: USER_ID,
        }),
      );

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "forbidden",
      });

      const req = createRequest();
      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(writeAuditLog).not.toHaveBeenCalled();
    });

    test("returns 404 when the archive target no longer exists", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(createAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "not_found",
      });

      const req = createRequest();
      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 400 for an invalid UUID", async () => {
      const req = createRequest({
        id: "invalid-id",
      });

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    test("returns 404 when the attachment is not found", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(null);

      const req = createRequest();

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 409 when the attachment is not available", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(
        createAttachment({
          uploadStatus: "pending",
        }),
      );

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest();

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
        user: req.user,
        entityType: "experiment",
        entityId: ENTITY_ID,
        action: "archive",
        transaction,
      });

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(writeAuditLog).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test("returns 403 when target archive access is forbidden", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(createAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "forbidden",
      });

      const req = createRequest();

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("prevents a researcher from archiving another user's attachment", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(
        createAttachment({
          uploadedById: OTHER_USER_ID,
        }),
      );

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest();

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("allows an admin to archive another user's attachment", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment({
        uploadedById: OTHER_USER_ID,
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(
          createAttachment({
            uploadedById: OTHER_USER_ID,

            isArchived: true,

            archivedAt: new Date(),

            archivedById: 1,
          }),
        );

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest({
        user: createUser({
          id: 1,
          role: "admin",
        }),
      });

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 500 when the archived attachment cannot be reloaded", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(createAttachment())
        .mockResolvedValueOnce(null);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      const req = createRequest();

      const res = createResponse();

      await archiveAttachment(req, res);

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(writeAuditLog).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  test("returns 404 when the update target no longer exists", async () => {
    const transaction = createTransaction();

    sequelize.transaction.mockResolvedValue(transaction);

    Attachment.findOne.mockResolvedValue(createAttachment());

    authorizeAttachmentTarget.mockResolvedValue({
      allowed: false,
      reason: "not_found",
    });

    const req = createRequest({
      body: {
        category: "result",
      },
    });

    const res = createResponse();

    await updateAttachmentMetadata(req, res);

    expect(transaction.rollback).toHaveBeenCalledTimes(1);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
