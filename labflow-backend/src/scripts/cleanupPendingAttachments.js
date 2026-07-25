require("dotenv").config();

const { Attachment } = require("../models");

const {
  cleanupExpiredPendingAttachments,
} = require("../services/attachmentCleanupService");

const sequelize = Attachment.sequelize;

const run = async () => {
  try {
    console.log("Starting expired attachment cleanup.");

    const summary = await cleanupExpiredPendingAttachments();

    console.log("Expired attachment cleanup completed.", {
      scanned: summary.scanned,
      cleaned: summary.cleaned,
      skipped: summary.skipped,
      failed: summary.failed,
    });

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Expired attachment cleanup failed.", error);

    process.exitCode = 1;
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
};

run();
