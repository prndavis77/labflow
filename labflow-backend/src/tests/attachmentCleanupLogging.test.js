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
      id: 42,
      organizationId: 7,
      uploadStatus: "pending",
      uploadExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
      storageKey: "private/secret-storage-key",
    });

    const storage = {
      deleteObject: jest.fn().mockRejectedValue(cleanupError),
    };

    const result = await cleanupExpiredAttachment({
      attachmentId: 42,
      now: new Date("2026-02-01T00:00:00.000Z"),
      storage,
    });

    expect(rollback).toHaveBeenCalledTimes(1);

    expect(logError).toHaveBeenCalledWith(cleanupError, {
      event: "attachment_cleanup_item_failed",
      message: "Failed to clean pending attachment",
      context: {
        attachmentId: 42,
      },
    });

    expect(result).toEqual({
      attachmentId: 42,
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
      id: 84,
      organizationId: 9,
      uploadStatus: "pending",
      uploadExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
      storageKey: "private/another-secret-key",
    });

    const storage = {
      deleteObject: jest.fn().mockRejectedValue(cleanupError),
    };

    const result = await cleanupExpiredAttachment({
      attachmentId: 84,
      now: new Date("2026-02-01T00:00:00.000Z"),
      storage,
    });

    expect(logError).toHaveBeenCalledWith(rollbackError, {
      event: "attachment_cleanup_rollback_failed",
      message: "Attachment cleanup rollback failed",
      context: {
        attachmentId: 84,
      },
    });

    expect(logError).toHaveBeenCalledWith(cleanupError, {
      event: "attachment_cleanup_item_failed",
      message: "Failed to clean pending attachment",
      context: {
        attachmentId: 84,
      },
    });

    expect(result.outcome).toBe("failed");

    const serializedLogs = JSON.stringify(logError.mock.calls);

    expect(serializedLogs).not.toContain("private/another-secret-key");
  });
});
