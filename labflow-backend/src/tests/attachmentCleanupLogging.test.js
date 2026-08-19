const { Attachment } = require("../models");
const { logError } = require("../utils/errorLogger");

const {
  cleanupExpiredAttachment,
} = require("../services/attachmentCleanupService");

jest.mock("../utils/errorLogger", () => ({
  logError: jest.fn(),
}));

describe("Attachment cleanup logging", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("logs an item failure and returns a failed outcome", async () => {
    const cleanupError = new Error("R2 object deletion failed");

    const rollback = jest.fn().mockResolvedValue();

    jest.spyOn(Attachment.sequelize, "transaction").mockResolvedValue({
      LOCK: {
        UPDATE: "UPDATE",
      },
      rollback,
    });

    jest.spyOn(Attachment, "findOne").mockResolvedValue({
      id: "7dcf9559-0f93-4fb2-8193-5fda32180592",
      organizationId: 7,
      entityType: "experiment",
      entityId: 42,
      fileName: "secret-file.csv",
      uploadStatus: "pending",
      uploadExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
      storageKey: "private/secret-storage-key",
    });

    const storage = {
      deleteObject: jest.fn().mockRejectedValue(cleanupError),
    };

    const result = await cleanupExpiredAttachment({
      attachmentId: "7dcf9559-0f93-4fb2-8193-5fda32180592",
      now: new Date("2026-02-01T00:00:00.000Z"),
      storage,
    });

    expect(rollback).toHaveBeenCalledTimes(1);

    expect(logError).toHaveBeenCalledWith(cleanupError, {
      event: "attachment_cleanup_item_failed",
      message: "Failed to clean pending attachment",
      context: {
        attachmentId: "7dcf9559-0f93-4fb2-8193-5fda32180592",
      },
    });

    expect(result).toEqual({
      attachmentId: "7dcf9559-0f93-4fb2-8193-5fda32180592",
      outcome: "failed",
      error: cleanupError,
    });

    const serializedLogs = JSON.stringify(logError.mock.calls);

    expect(serializedLogs).not.toContain("private/secret-storage-key");
  });

  test("logs rollback failure separately from the original cleanup failure", async () => {
    const cleanupError = new Error("Storage deletion failed");
    const rollbackError = new Error("Database rollback failed");

    const rollback = jest.fn().mockRejectedValue(rollbackError);

    jest.spyOn(Attachment.sequelize, "transaction").mockResolvedValue({
      LOCK: {
        UPDATE: "UPDATE",
      },
      rollback,
    });

    jest.spyOn(Attachment, "findOne").mockResolvedValue({
      id: "c62a1ab1-5c08-46b8-9416-7ec779d213df",
      organizationId: 9,
      entityType: "experiment",
      entityId: 84,
      fileName: "another-secret-file.csv",
      uploadStatus: "pending",
      uploadExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
      storageKey: "private/another-secret-key",
    });

    const storage = {
      deleteObject: jest.fn().mockRejectedValue(cleanupError),
    };

    const result = await cleanupExpiredAttachment({
      attachmentId: "c62a1ab1-5c08-46b8-9416-7ec779d213df",
      now: new Date("2026-02-01T00:00:00.000Z"),
      storage,
    });

    expect(logError).toHaveBeenCalledWith(rollbackError, {
      event: "attachment_cleanup_rollback_failed",
      message: "Attachment cleanup rollback failed",
      context: {
        attachmentId: "c62a1ab1-5c08-46b8-9416-7ec779d213df",
      },
    });

    expect(logError).toHaveBeenCalledWith(cleanupError, {
      event: "attachment_cleanup_item_failed",
      message: "Failed to clean pending attachment",
      context: {
        attachmentId: "c62a1ab1-5c08-46b8-9416-7ec779d213df",
      },
    });

    expect(result.outcome).toBe("failed");

    const serializedLogs = JSON.stringify(logError.mock.calls);

    expect(serializedLogs).not.toContain("private/another-secret-key");
  });
});
