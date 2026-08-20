const { AuditLog } = require("../models");

const { logError } = require("./errorLogger");

const getRequestIp = (req) => {
  return (
    String(req?.ip || req?.socket?.remoteAddress || "")
      .trim()
      .slice(0, 45) || null
  );
};

const writeAuditLog = async ({
  req,
  actorUserId,
  organizationId,
  action,
  entityType,
  entityId = null,
  targetUserId = null,
  summary,
  metadata = null,
}) => {
  try {
    const resolvedOrganizationId =
      organizationId || req?.user?.organizationId || null;

    if (!resolvedOrganizationId) {
      logError(new Error("Audit log organizationId is missing"), {
        req,
        event: "audit_log_missing_organization",
        message: "Audit log write skipped because organizationId is missing",
        context: {
          action,
          entityType,
          entityId,
        },
        level: "warn",
      });
      return;
    }

    await AuditLog.create({
      actorUserId: actorUserId || req?.user?.id || null,
      organizationId: resolvedOrganizationId,
      action,
      entityType,
      entityId,
      targetUserId,
      summary,
      metadata,
      ipAddress: req ? getRequestIp(req) : null,
      userAgent: req?.headers?.["user-agent"] || null,
    });
  } catch (error) {
    logError(error, {
      req,
      event: "audit_log_write_failed",
      message: "Audit log write failed",
      context: {
        action,
        entityType,
        entityId,
      },
    });
  }
};

module.exports = {
  writeAuditLog,
};
