const mockSequelize = {
  transaction: jest.fn(),
};

jest.mock("../models", () => ({
  Attachment: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    sequelize: mockSequelize,
  },
}));

jest.mock("../storage/attachmentStorage", () => ({
  getAttachmentStorage: jest.fn(),
}));

const { Op } = require("sequelize");
const { Attachment } = require("../models");
const { getAttachmentStorage } = require("../storage/attachmentStorage");
const {
  cleanupExpiredAttachment,
  cleanupExpiredPendingAttachments,
  isAttachmentStillExpired,
} = require("../services/attachmentCleanupService");

const sequelize = Attachment.sequelize;

const ATTACHMENT_ID = "7dcf9559-0f93-4fb2-8193-5fda32180592";

const SECOND_ATTACHMENT_ID = "c62a1ab1-5c08-46b8-9416-7ec779d213df";

const ORGANIZATION_ID = 10;

const ENTITY_ID = 42;

const NOW = new Date("2026-07-25T12:00:00.000Z");

const FINAL_STORAGE_KEY =
  `organizations/${ORGANIZATION_ID}/experiment/${ENTITY_ID}/attachments/` +
  `${ATTACHMENT_ID}/results.csv`;

const createTransaction = () => ({
  commit: jest.fn().mockResolvedValue(undefined),

  rollback: jest.fn().mockResolvedValue(undefined),

  LOCK: {
    UPDATE: "UPDATE",
  },
});

const createAttachment = (overrides = {}) => ({
  id: ATTACHMENT_ID,

  organizationId: ORGANIZATION_ID,

  entityType: "experiment",

  entityId: ENTITY_ID,

  fileName: "results.csv",

  uploadStatus: "pending",

  uploadExpiresAt: new Date("2026-07-25T11:00:00.000Z"),

  storageKey:
    `organizations/${ORGANIZATION_ID}/experiment/${ENTITY_ID}/staging/` +
    `${ATTACHMENT_ID}/results.csv`,

  save: jest.fn().mockResolvedValue(undefined),

  ...overrides,
});

const createStorage = (overrides = {}) => ({
  deleteObject: jest.fn().mockResolvedValue({
    deleted: true,
  }),

  ...overrides,
});

describe("attachment pending-upload cleanup", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("isAttachmentStillExpired", () => {
    test("returns true for an expired pending attachment", () => {
      expect(
        isAttachmentStillExpired({
          attachment: createAttachment(),
          now: NOW,
        }),
      ).toBe(true);
    });

    test("returns false when the attachment is available", () => {
      expect(
        isAttachmentStillExpired({
          attachment: createAttachment({
            uploadStatus: "available",
          }),
          now: NOW,
        }),
      ).toBe(false);
    });

    test("returns false when the attachment has not expired", () => {
      expect(
        isAttachmentStillExpired({
          attachment: createAttachment({
            uploadExpiresAt: new Date("2026-07-25T13:00:00.000Z"),
          }),
          now: NOW,
        }),
      ).toBe(false);
    });

    test("returns false when the expiration date is missing", () => {
      expect(
        isAttachmentStillExpired({
          attachment: createAttachment({
            uploadExpiresAt: null,
          }),
          now: NOW,
        }),
      ).toBe(false);
    });
  });

  describe("cleanupExpiredAttachment", () => {
    test("deletes the object and marks the attachment failed", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment();

      const storage = createStorage();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      const result = await cleanupExpiredAttachment({
        attachmentId: ATTACHMENT_ID,
        now: NOW,
        storage,
      });

      expect(Attachment.findOne).toHaveBeenCalledWith({
        where: {
          id: ATTACHMENT_ID,
        },

        transaction,

        lock: transaction.LOCK.UPDATE,
      });

      expect(storage.deleteObject).toHaveBeenNthCalledWith(1, {
        storageKey: attachment.storageKey,
      });

      expect(storage.deleteObject).toHaveBeenNthCalledWith(2, {
        storageKey: FINAL_STORAGE_KEY,
      });

      expect(storage.deleteObject).toHaveBeenCalledTimes(2);

      expect(attachment.uploadStatus).toBe("failed");

      expect(attachment.uploadExpiresAt).toBeNull();

      expect(attachment.save).toHaveBeenCalledWith({
        transaction,
      });

      expect(transaction.commit).toHaveBeenCalledTimes(1);

      expect(transaction.rollback).not.toHaveBeenCalled();

      expect(result).toEqual({
        attachmentId: ATTACHMENT_ID,

        organizationId: ORGANIZATION_ID,

        outcome: "cleaned",
      });
    });

    test("skips an attachment that no longer exists", async () => {
      const transaction = createTransaction();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(null);

      const storage = createStorage();

      const result = await cleanupExpiredAttachment({
        attachmentId: ATTACHMENT_ID,
        now: NOW,
        storage,
      });

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(storage.deleteObject).not.toHaveBeenCalled();

      expect(result).toEqual({
        attachmentId: ATTACHMENT_ID,

        outcome: "skipped",

        reason: "not_found",
      });
    });

    test("skips an attachment that was completed before locking", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment({
        uploadStatus: "available",

        uploadExpiresAt: null,
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      const storage = createStorage();

      const result = await cleanupExpiredAttachment({
        attachmentId: ATTACHMENT_ID,
        now: NOW,
        storage,
      });

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(storage.deleteObject).not.toHaveBeenCalled();

      expect(attachment.save).not.toHaveBeenCalled();

      expect(result).toEqual({
        attachmentId: ATTACHMENT_ID,

        outcome: "skipped",

        reason: "no_longer_expired",
      });
    });

    test("leaves the attachment pending when storage deletion fails", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment();

      const storage = createStorage({
        deleteObject: jest.fn().mockRejectedValue(new Error("R2 unavailable")),
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      const result = await cleanupExpiredAttachment({
        attachmentId: ATTACHMENT_ID,
        now: NOW,
        storage,
      });

      expect(storage.deleteObject).toHaveBeenCalledTimes(1);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(transaction.commit).not.toHaveBeenCalled();

      expect(attachment.uploadStatus).toBe("pending");

      expect(attachment.save).not.toHaveBeenCalled();

      expect(result.outcome).toBe("failed");

      expect(result.attachmentId).toBe(ATTACHMENT_ID);
    });

    test("leaves the attachment pending when final object deletion fails", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment();

      const finalCleanupError = new Error("Final object deletion failed");

      const storage = createStorage({
        deleteObject: jest
          .fn()
          .mockResolvedValueOnce({
            deleted: true,
          })
          .mockRejectedValueOnce(finalCleanupError),
      });

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      const result = await cleanupExpiredAttachment({
        attachmentId: ATTACHMENT_ID,
        now: NOW,
        storage,
      });

      expect(storage.deleteObject).toHaveBeenNthCalledWith(1, {
        storageKey: attachment.storageKey,
      });

      expect(storage.deleteObject).toHaveBeenNthCalledWith(2, {
        storageKey: FINAL_STORAGE_KEY,
      });

      expect(attachment.uploadStatus).toBe("pending");

      expect(attachment.save).not.toHaveBeenCalled();

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(transaction.commit).not.toHaveBeenCalled();

      expect(result.outcome).toBe("failed");

      expect(result.attachmentId).toBe(ATTACHMENT_ID);
    });

    test("rolls back when saving the failed status fails", async () => {
      const transaction = createTransaction();

      const attachment = createAttachment({
        save: jest.fn().mockRejectedValue(new Error("Database failure")),
      });

      const storage = createStorage();

      sequelize.transaction.mockResolvedValue(transaction);

      Attachment.findOne.mockResolvedValue(attachment);

      const result = await cleanupExpiredAttachment({
        attachmentId: ATTACHMENT_ID,
        now: NOW,
        storage,
      });

      expect(storage.deleteObject).toHaveBeenNthCalledWith(1, {
        storageKey: attachment.storageKey,
      });

      expect(storage.deleteObject).toHaveBeenNthCalledWith(2, {
        storageKey: FINAL_STORAGE_KEY,
      });

      expect(storage.deleteObject).toHaveBeenCalledTimes(2);

      expect(transaction.rollback).toHaveBeenCalledTimes(1);

      expect(transaction.commit).not.toHaveBeenCalled();

      expect(result.outcome).toBe("failed");
    });
  });

  describe("cleanupExpiredPendingAttachments", () => {
    test("finds expired attachments and returns a cleanup summary", async () => {
      const firstTransaction = createTransaction();

      const secondTransaction = createTransaction();

      const firstAttachment = createAttachment();

      const secondAttachment = createAttachment({
        id: SECOND_ATTACHMENT_ID,

        organizationId: 20,

        storageKey: "organizations/20/experiment/9/expired-file-2.csv",
      });

      const storage = createStorage();

      Attachment.findAll.mockResolvedValue([
        {
          id: ATTACHMENT_ID,
        },

        {
          id: SECOND_ATTACHMENT_ID,
        },
      ]);

      sequelize.transaction
        .mockResolvedValueOnce(firstTransaction)
        .mockResolvedValueOnce(secondTransaction);

      Attachment.findOne
        .mockResolvedValueOnce(firstAttachment)
        .mockResolvedValueOnce(secondAttachment);

      getAttachmentStorage.mockReturnValue(storage);

      const result = await cleanupExpiredPendingAttachments({
        now: NOW,
        batchSize: 25,
        storage,
      });

      expect(Attachment.findAll).toHaveBeenCalledWith({
        attributes: ["id"],

        where: {
          uploadStatus: "pending",

          uploadExpiresAt: {
            [Op.lte]: NOW,
          },
        },

        order: [
          ["uploadExpiresAt", "ASC"],

          ["id", "ASC"],
        ],

        limit: 25,

        raw: true,
      });

      expect(result).toEqual({
        scanned: 2,
        cleaned: 2,
        skipped: 0,
        failed: 0,

        results: [
          {
            attachmentId: ATTACHMENT_ID,

            organizationId: ORGANIZATION_ID,

            outcome: "cleaned",
          },

          {
            attachmentId: SECOND_ATTACHMENT_ID,

            organizationId: 20,

            outcome: "cleaned",
          },
        ],
      });
    });

    test("returns an empty summary when nothing has expired", async () => {
      const storage = createStorage();

      Attachment.findAll.mockResolvedValue([]);

      const result = await cleanupExpiredPendingAttachments({
        now: NOW,
        batchSize: 25,
        storage,
      });

      expect(result).toEqual({
        scanned: 0,
        cleaned: 0,
        skipped: 0,
        failed: 0,
        results: [],
      });

      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    test("continues processing after one attachment fails", async () => {
      const firstTransaction = createTransaction();

      const secondTransaction = createTransaction();

      const firstAttachment = createAttachment();

      const secondAttachment = createAttachment({
        id: SECOND_ATTACHMENT_ID,

        storageKey: "organizations/10/experiment/42/second-file.csv",
      });

      const storage = createStorage({
        deleteObject: jest
          .fn()
          .mockRejectedValueOnce(new Error("Temporary failure"))
          .mockResolvedValueOnce({
            deleted: true,
          }),
      });

      Attachment.findAll.mockResolvedValue([
        {
          id: ATTACHMENT_ID,
        },

        {
          id: SECOND_ATTACHMENT_ID,
        },
      ]);

      sequelize.transaction
        .mockResolvedValueOnce(firstTransaction)
        .mockResolvedValueOnce(secondTransaction);

      Attachment.findOne
        .mockResolvedValueOnce(firstAttachment)
        .mockResolvedValueOnce(secondAttachment);

      const result = await cleanupExpiredPendingAttachments({
        now: NOW,
        batchSize: 25,
        storage,
      });

      expect(result.scanned).toBe(2);

      expect(result.cleaned).toBe(1);

      expect(result.failed).toBe(1);
    });
  });
});
