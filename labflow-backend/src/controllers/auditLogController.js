const { AuditLog, User } = require("../models");

const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      action,
      entityType,
      actorUserId,
      targetUserId,
    } = req.query;

    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const offset = (parsedPage - 1) * parsedLimit;

    const where = {};

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (actorUserId) {
      where.actorUserId = Number(actorUserId);
    }

    if (targetUserId) {
      where.targetUserId = Number(targetUserId);
    }

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "actor",
          attributes: ["id", "name", "email", "role"],
          required: false,
        },
        {
          model: User,
          as: "targetUser",
          attributes: ["id", "name", "email", "role"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parsedLimit,
      offset,
    });

    return res.json({
      status: "success",
      data: {
        auditLogs: rows,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: count,
          totalPages: Math.ceil(count / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching audit logs.",
    });
  }
};

module.exports = { getAuditLogs };
