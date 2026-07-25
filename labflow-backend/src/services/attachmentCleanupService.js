const { Op } = require("sequelize");

const { Attachment } = require("../models");

const attachmentConfig = require("../config/attachmentConfig");

const { getAttachmentStorage } = require("../storage/attachmentStorage");

const sequelize = Attachment.sequelize;

const isAttachmentStillExpired = ({ attachment, now }) => {
  if (attachment.uploadStatus !== "pending") {
    return false;
  }

  if (!attachment.uploadExpiresAt) {
    return false;
  }

  return new Date(attachment.uploadExpiresAt).getTime() <= now.getTime();
};

const cleanupExpiredAttachment = async ({ attachmentId, now, storage }) => {
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const attachment = await Attachment.findOne({
      where: {
        id: attachmentId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!attachment) {
      await transaction.rollback();
      transaction = null;

      return {
        attachmentId,
        outcome: "skipped",
        reason: "not_found",
      };
    }

    if (
      !isAttachmentStillExpired({
        attachment,
        now,
      })
    ) {
      await transaction.rollback();
      transaction = null;

      return {
        attachmentId,
        outcome: "skipped",
        reason: "no_longer_expired",
      };
    }

    await storage.deleteObject({
      storageKey: attachment.storageKey,
    });

    attachment.uploadStatus = "failed";

    attachment.uploadExpiresAt = null;

    await attachment.save({
      transaction,
    });

    await transaction.commit();
    transaction = null;

    return {
      attachmentId: attachment.id,

      organizationId: attachment.organizationId,

      outcome: "cleaned",
    };
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Attachment cleanup rollback failed", rollbackError);
      }
    }

    console.error(`Failed to clean pending attachment ${attachmentId}`, error);

    return {
      attachmentId,
      outcome: "failed",
      error,
    };
  }
};

const cleanupExpiredPendingAttachments = async ({
  now = new Date(),
  batchSize = attachmentConfig.cleanupBatchSize,
  storage = getAttachmentStorage(),
} = {}) => {
  const expiredAttachments = await Attachment.findAll({
    attributes: ["id"],

    where: {
      uploadStatus: "pending",

      uploadExpiresAt: {
        [Op.lte]: now,
      },
    },

    order: [
      ["uploadExpiresAt", "ASC"],
      ["id", "ASC"],
    ],

    limit: batchSize,

    raw: true,
  });

  const results = [];

  for (const expiredAttachment of expiredAttachments) {
    const result = await cleanupExpiredAttachment({
      attachmentId: expiredAttachment.id,
      now,
      storage,
    });

    results.push(result);
  }

  const summary = {
    scanned: expiredAttachments.length,

    cleaned: results.filter((result) => result.outcome === "cleaned").length,

    skipped: results.filter((result) => result.outcome === "skipped").length,

    failed: results.filter((result) => result.outcome === "failed").length,

    results,
  };

  return summary;
};

module.exports = {
  cleanupExpiredAttachment,
  cleanupExpiredPendingAttachments,
  isAttachmentStillExpired,
};
