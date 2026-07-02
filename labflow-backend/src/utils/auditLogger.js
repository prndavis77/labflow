const { AuditLog } = require("../models");

const getRequestIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
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
      console.error("Audit log write skipped: organizationId is missing.");
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
    console.error("Audit log write failed:", error);
  }
};

module.exports = {
  writeAuditLog,
};
