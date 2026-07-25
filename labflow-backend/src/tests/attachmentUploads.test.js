jest.mock("crypto", () => ({
  randomUUID: jest.fn(),
}));

jest.mock("../models", () => ({
  Attachment: {
    create: jest.fn(),
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

const crypto = require("crypto");

const { Attachment, sequelize } = require("../models");

const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");

const { getAttachmentStorage } = require("../storage/attachmentStorage");

const { writeAuditLog } = require("../utils/auditLogger");

const {
  completeAttachmentUpload,
  initiateAttachmentUpload,
} = require("../controllers/attachmentController");

const ATTACHMENT_ID = "7dcf9559-0f93-4fb2-8193-5fda32180592";

const ORGANIZATION_ID = 10;
const RESEARCHER_ID = 3;
const ADMIN_ID = 1;
const ENTITY_ID = 42;

const STORAGE_KEY =
  `organizations/${ORGANIZATION_ID}/experiment/${ENTITY_ID}/` +
  `${ATTACHMENT_ID}/gc-ms-run-04.csv`;

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
  id: RESEARCHER_ID,
  organizationId: ORGANIZATION_ID,
  role: "researcher",
  isActive: true,
  ...overrides,
});

const createValidInitiationRequest = (overrides = {}) => ({
  user: createUser(),

  body: {
    originalFileName: "GC-MS Run 04.csv",
    mimeType: "text/csv",
    fileSize: 1024,
    entityType: "experiment",
    entityId: ENTITY_ID,
    category: "raw_data",
    description: "Raw instrument export.",
    ...overrides,
  },
});

const createPendingAttachment = (overrides = {}) => ({
  id: ATTACHMENT_ID,
  organizationId: ORGANIZATION_ID,
  uploadedById: RESEARCHER_ID,

  originalFileName: "GC-MS Run 04.csv",
  fileName: "gc-ms-run-04.csv",
  fileExtension: ".csv",
  mimeType: "text/csv",
  fileSize: 1024,
  verifiedFileSize: null,

  storageProvider: "r2",
  storageKey: STORAGE_KEY,
  checksum: null,
  etag: null,

  entityType: "experiment",
  entityId: ENTITY_ID,

  category: "raw_data",
  description: "Raw instrument export.",

  uploadStatus: "pending",

  uploadExpiresAt: new Date(Date.now() + 10 * 60 * 1000),

  isArchived: false,
  archivedAt: null,
  archivedById: null,

  createdAt: new Date("2026-07-24T10:00:00.000Z"),

  updatedAt: new Date("2026-07-24T10:00:00.000Z"),

  save: jest.fn().mockResolvedValue(undefined),

  ...overrides,
});

const createReturnedAttachment = (overrides = {}) => ({
  ...createPendingAttachment(),

  uploadedBy: {
    id: RESEARCHER_ID,
    name: "Researcher",
    email: "researcher@example.com",
    role: "researcher",
  },

  ...overrides,
});

const createCompletionRequest = ({
  user = createUser(),
  id = ATTACHMENT_ID,
} = {}) => ({
  params: {
    id,
  },

  user,
});

const createUploadStorage = (overrides = {}) => ({
  createUploadUrl: jest.fn().mockResolvedValue({
    url: "https://upload.example.test",
    method: "PUT",

    headers: {
      "Content-Type": "text/csv",
    },

    expiresIn: 300,
  }),

  ...overrides,
});

const createCompletionStorage = (overrides = {}) => ({
  getObjectMetadata: jest.fn().mockResolvedValue({
    contentLength: 1024,
    contentType: "text/csv",
    etag: "abc123",
    checksumSha256: "checksum-value",

    lastModified: new Date("2026-07-24T10:05:00.000Z"),

    metadata: {},
  }),

  ...overrides,
});

describe("attachment upload endpoints", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    crypto.randomUUID.mockReturnValue(ATTACHMENT_ID);

    writeAuditLog.mockResolvedValue(undefined);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("initiateAttachmentUpload", () => {
    test("initiates a valid attachment upload", async () => {
      const transaction = createTransaction();

      const createdAttachment = createPendingAttachment();

      const returnedAttachment = createReturnedAttachment();

      const storage = createUploadStorage();

      sequelize.transaction.mockResolvedValue(transaction);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,
          organizationId: ORGANIZATION_ID,
        },
      });

      Attachment.create.mockResolvedValue(createdAttachment);

      Attachment.findOne.mockResolvedValue(returnedAttachment);

      getAttachmentStorage.mockReturnValue(storage);

      const req = createValidInitiationRequest();

      const res = createResponse();

      await initiateAttachmentUpload(req, res);

      expect(writeAuditLog).toHaveBeenCalledWith({
        req,
        action: "attachment.upload_initiated",
        entityType: "attachment",
        entityId: ATTACHMENT_ID,
        summary: "Attachment upload initiated for GC-MS Run 04.csv.",
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

      expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
        user: req.user,
        entityType: "experiment",
        entityId: ENTITY_ID,
        action: "upload",
      });

      expect(crypto.randomUUID).toHaveBeenCalledTimes(1);

      expect(Attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ATTACHMENT_ID,

          organizationId: ORGANIZATION_ID,

          uploadedById: RESEARCHER_ID,

          originalFileName: "GC-MS Run 04.csv",

          fileName: "gc-ms-run-04.csv",

          fileExtension: ".csv",
          mimeType: "text/csv",
          fileSize: 1024,
          verifiedFileSize: null,

          storageProvider: "r2",
          storageKey: STORAGE_KEY,
          checksum: null,
          etag: null,

          entityType: "experiment",
          entityId: ENTITY_ID,
          category: "raw_data",

          description: "Raw instrument export.",

          uploadStatus: "pending",

          uploadExpiresAt: expect.any(Date),

          isArchived: false,
          archivedAt: null,
          archivedById: null,
        }),

        {
          transaction,
        },
      );

      expect(storage.createUploadUrl).toHaveBeenCalledWith({
        storageKey: STORAGE_KEY,
        mimeType: "text/csv",
        expiresInSeconds: 300,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(transaction.rollback).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(201);

      const responseBody = res.json.mock.calls[0][0];

      expect(responseBody).toEqual({
        status: "success",

        data: {
          attachment: expect.objectContaining({
            id: ATTACHMENT_ID,

            organizationId: ORGANIZATION_ID,

            uploadedById: RESEARCHER_ID,

            originalFileName: "GC-MS Run 04.csv",

            fileName: "gc-ms-run-04.csv",

            fileExtension: ".csv",
            mimeType: "text/csv",
            fileSize: 1024,

            entityType: "experiment",

            entityId: ENTITY_ID,
            category: "raw_data",

            uploadStatus: "pending",

            isArchived: false,
          }),

          upload: {
            url: "https://upload.example.test",

            method: "PUT",

            headers: {
              "Content-Type": "text/csv",
            },

            expiresIn: 300,
          },
        },
      });

      expect(responseBody.data.attachment.storageKey).toBeUndefined();

      expect(responseBody.data.attachment.etag).toBeUndefined();

      expect(responseBody.data.attachment.checksum).toBeUndefined();
    });

    test("returns 400 for invalid upload metadata", async () => {
      const req = createValidInitiationRequest({
        originalFileName: "malware.exe",

        mimeType: "application/octet-stream",
      });

      const res = createResponse();

      await initiateAttachmentUpload(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(sequelize.transaction).not.toHaveBeenCalled();

      expect(Attachment.create).not.toHaveBeenCalled();

      expect(authorizeAttachmentTarget).not.toHaveBeenCalled();
    });

    test("returns 403 when upload access is forbidden", async () => {
      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "forbidden",
      });

      const req = createValidInitiationRequest();

      const res = createResponse();

      await initiateAttachmentUpload(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(sequelize.transaction).not.toHaveBeenCalled();

      expect(Attachment.create).not.toHaveBeenCalled();
    });

    test("returns 404 when the target is not found", async () => {
      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "not_found",
      });

      const req = createValidInitiationRequest();

      const res = createResponse();

      await initiateAttachmentUpload(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(sequelize.transaction).not.toHaveBeenCalled();

      expect(Attachment.create).not.toHaveBeenCalled();
    });

    test("rolls back and returns 503 when upload URL signing fails", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      Attachment.create.mockResolvedValue(createPendingAttachment());

      getAttachmentStorage.mockReturnValue(
        createUploadStorage({
          createUploadUrl: jest
            .fn()
            .mockRejectedValue(new Error("Signing failed")),
        }),
      );

      const req = createValidInitiationRequest();

      const res = createResponse();

      await initiateAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(transaction.commit).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(503);
    });

    test("returns 500 if the created attachment cannot be reloaded", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      Attachment.create.mockResolvedValue(createPendingAttachment());

      Attachment.findOne.mockResolvedValue(null);

      getAttachmentStorage.mockReturnValue(createUploadStorage());

      const req = createValidInitiationRequest();

      const res = createResponse();

      await initiateAttachmentUpload(req, res);

      expect(writeAuditLog).not.toHaveBeenCalled();

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("completeAttachmentUpload", () => {
    test("completes a valid pending attachment upload", async () => {
      const transaction = createTransaction();

      const attachment = createPendingAttachment();

      const completedAttachment = createReturnedAttachment({
        uploadStatus: "available",
        verifiedFileSize: 1024,
        uploadExpiresAt: null,
        etag: "abc123",

        checksum: "checksum-value",
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(completedAttachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      const storage = createCompletionStorage();

      getAttachmentStorage.mockReturnValue(storage);

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(writeAuditLog).toHaveBeenCalledWith({
        req,
        action: "attachment.upload_completed",
        entityType: "attachment",
        entityId: ATTACHMENT_ID,
        summary: "Attachment upload completed for GC-MS Run 04.csv.",
        metadata: {
          attachmentId: ATTACHMENT_ID,
          targetEntityType: "experiment",
          targetEntityId: ENTITY_ID,
          originalFileName: "GC-MS Run 04.csv",
          mimeType: "text/csv",
          fileSize: 1024,
          verifiedFileSize: 1024,
          category: "raw_data",
        },
      });

      expect(Attachment.findOne).toHaveBeenNthCalledWith(
        1,

        expect.objectContaining({
          where: {
            id: ATTACHMENT_ID,

            organizationId: ORGANIZATION_ID,

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
        action: "upload",
        transaction,
      });

      expect(storage.getObjectMetadata).toHaveBeenCalledWith({
        storageKey: STORAGE_KEY,
      });

      expect(attachment.uploadStatus).toBe("available");

      expect(attachment.verifiedFileSize).toBe(1024);

      expect(attachment.mimeType).toBe("text/csv");

      expect(attachment.etag).toBe("abc123");

      expect(attachment.checksum).toBe("checksum-value");

      expect(attachment.uploadExpiresAt).toBeNull();

      expect(attachment.save).toHaveBeenCalledWith({
        transaction,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(transaction.rollback).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 400 for an invalid attachment UUID", async () => {
      const req = createCompletionRequest({
        id: "not-a-uuid",
      });

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(sequelize.transaction).not.toHaveBeenCalled();

      expect(Attachment.findOne).not.toHaveBeenCalled();
    });

    test("returns 404 when the attachment is not found in the organization", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(null);

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 403 when another researcher tries to complete the upload", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(
        createPendingAttachment({
          uploadedById: 99,
        }),
      );

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(authorizeAttachmentTarget).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("allows an admin to complete another user's upload", async () => {
      const transaction = createTransaction();

      const attachment = createPendingAttachment({
        uploadedById: RESEARCHER_ID,
      });

      const completedAttachment = createReturnedAttachment({
        uploadedById: RESEARCHER_ID,

        uploadStatus: "available",
        verifiedFileSize: 1024,
        uploadExpiresAt: null,
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(completedAttachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      getAttachmentStorage.mockReturnValue(createCompletionStorage());

      const req = createCompletionRequest({
        user: createUser({
          id: ADMIN_ID,
          role: "admin",
        }),
      });

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(transaction.commit).toHaveBeenCalledTimes(1);
    });

    test("returns an already available attachment idempotently", async () => {
      const transaction = createTransaction();

      const availableAttachment = createPendingAttachment({
        uploadStatus: "available",
        verifiedFileSize: 1024,
        uploadExpiresAt: null,
      });

      const returnedAttachment = createReturnedAttachment({
        uploadStatus: "available",
        verifiedFileSize: 1024,
        uploadExpiresAt: null,
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(availableAttachment)
        .mockResolvedValueOnce(returnedAttachment);

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(transaction.commit).not.toHaveBeenCalled();

      expect(authorizeAttachmentTarget).not.toHaveBeenCalled();

      expect(getAttachmentStorage).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 500 if an available attachment cannot be reloaded", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(
          createPendingAttachment({
            uploadStatus: "available",

            verifiedFileSize: 1024,
            uploadExpiresAt: null,
          }),
        )
        .mockResolvedValueOnce(null);

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test("returns 409 when the attachment is not pending or available", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(
        createPendingAttachment({
          uploadStatus: "failed",
          uploadExpiresAt: null,
        }),
      );

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test("marks an expired upload as failed and returns 410", async () => {
      const transaction = createTransaction();

      const attachment = createPendingAttachment({
        uploadExpiresAt: new Date(Date.now() - 60 * 1000),
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(attachment.uploadStatus).toBe("failed");

      expect(attachment.uploadExpiresAt).toBeNull();

      expect(attachment.save).toHaveBeenCalledWith({
        transaction,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(410);
    });

    test("returns 403 when target upload access is no longer allowed", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(createPendingAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "forbidden",
      });

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("returns 404 when the attachment target no longer exists", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(createPendingAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "not_found",
      });

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(404);
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
      "returns 409 when storage reports a missing object using %s",
      async (errorName, metadata) => {
        const transaction = createTransaction();

        sequelize.transaction.mockResolvedValue(transaction);

        Attachment.findOne.mockResolvedValue(createPendingAttachment());

        authorizeAttachmentTarget.mockResolvedValue({
          allowed: true,

          target: {
            id: ENTITY_ID,

            organizationId: ORGANIZATION_ID,
          },
        });

        const storageError = new Error("Object not found");

        storageError.name = errorName;

        if (metadata) {
          storageError.$metadata = metadata;
        }

        getAttachmentStorage.mockReturnValue(
          createCompletionStorage({
            getObjectMetadata: jest.fn().mockRejectedValue(storageError),
          }),
        );

        const req = createCompletionRequest();

        const res = createResponse();

        await completeAttachmentUpload(req, res);

        expect(transaction.rollback).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(409);
      },
    );

    test("returns 503 when storage verification fails unexpectedly", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(createPendingAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      getAttachmentStorage.mockReturnValue(
        createCompletionStorage({
          getObjectMetadata: jest
            .fn()
            .mockRejectedValue(new Error("Storage unavailable")),
        }),
      );

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(503);
    });

    test("marks a size mismatch as failed and returns 422", async () => {
      const transaction = createTransaction();

      const attachment = createPendingAttachment();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      getAttachmentStorage.mockReturnValue(
        createCompletionStorage({
          getObjectMetadata: jest.fn().mockResolvedValue({
            contentLength: 2048,
            contentType: "text/csv",

            etag: "abc123",

            checksumSha256: null,
          }),
        }),
      );

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(attachment.uploadStatus).toBe("failed");

      expect(attachment.uploadExpiresAt).toBeNull();

      expect(attachment.save).toHaveBeenCalledWith({
        transaction,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    test("marks a MIME-type mismatch as failed and returns 422", async () => {
      const transaction = createTransaction();

      const attachment = createPendingAttachment();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      getAttachmentStorage.mockReturnValue(
        createCompletionStorage({
          getObjectMetadata: jest.fn().mockResolvedValue({
            contentLength: 1024,

            contentType: "application/pdf",

            etag: "abc123",

            checksumSha256: null,
          }),
        }),
      );

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(attachment.uploadStatus).toBe("failed");

      expect(attachment.uploadExpiresAt).toBeNull();

      expect(attachment.save).toHaveBeenCalledWith({
        transaction,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    test("accepts a stored MIME type containing a charset parameter", async () => {
      const transaction = createTransaction();

      const attachment = createPendingAttachment();

      const completedAttachment = createReturnedAttachment({
        uploadStatus: "available",
        verifiedFileSize: 1024,
        uploadExpiresAt: null,
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(completedAttachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      getAttachmentStorage.mockReturnValue(
        createCompletionStorage({
          getObjectMetadata: jest.fn().mockResolvedValue({
            contentLength: 1024,

            contentType: "text/csv; charset=utf-8",

            etag: "abc123",

            checksumSha256: null,
          }),
        }),
      );

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(attachment.mimeType).toBe("text/csv");

      expect(attachment.uploadStatus).toBe("available");

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 500 if the completed attachment cannot be reloaded", async () => {
      const transaction = createTransaction();

      const attachment = createPendingAttachment();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne
        .mockResolvedValueOnce(attachment)
        .mockResolvedValueOnce(null);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      getAttachmentStorage.mockReturnValue(createCompletionStorage());

      const req = createCompletionRequest();

      const res = createResponse();

      await completeAttachmentUpload(req, res);

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(writeAuditLog).not.toHaveBeenCalled();
    });
  });
});
