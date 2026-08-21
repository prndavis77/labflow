require("dotenv").config();

const logger = require("../config/logger");
const { logError } = require("../utils/errorLogger");
const { Attachment } = require("../models");
const {
  cleanupExpiredPendingAttachments,
} = require("../services/attachmentCleanupService");

const sequelize = Attachment.sequelize;

const run = async () => {
  try {
    logger.info("Starting expired attachment cleanup.");

    const summary = await cleanupExpiredPendingAttachments();

    logger.info(
      {
        scanned: summary.scanned,
        cleaned: summary.cleaned,
        skipped: summary.skipped,
        failed: summary.failed,
      },
      "Expired attachment cleanup completed.",
    );

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    logError(error, {
      event: "attachment_cleanup_script_failed",
      message: "Expired attachment cleanup failed.",
    });

    process.exitCode = 1;
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
};

run();
