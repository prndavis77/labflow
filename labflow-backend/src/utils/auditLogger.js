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
  action,
  entityType,
  entityId = null,
  targetUserId = null,
  summary,
  metadata = null,
}) => {
  try {
    await AuditLog.create({
      actorUserId: actorUserId || req?.user?.id || null,
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
