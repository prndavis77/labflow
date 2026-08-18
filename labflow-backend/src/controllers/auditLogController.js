const { AuditLog, User } = require("../models");
const { Op } = require("sequelize");
const { logError } = require("../utils/errorLogger");

const parsePositiveIntegerQuery = ({ value, fallback, maximum, fieldName }) => {
  if (value === undefined || value === "") {
    return {
      value: fallback,
    };
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return {
      error: `${fieldName} must be a positive integer.`,
    };
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue)) {
    return {
      error: `${fieldName} must be a positive integer.`,
    };
  }

  if (maximum !== undefined && parsedValue > maximum) {
    return {
      error: `${fieldName} cannot be greater than ${maximum}.`,
    };
  }

  return {
    value: parsedValue,
  };
};

const getAuditLogs = async (req, res) => {
  try {
    const {
      page,
      limit,
      action,
      entityType,
      actorUserId,
      targetUserId,
      actorName,
      targetName,
    } = req.query;

    const pageResult = parsePositiveIntegerQuery({
      value: page,
      fallback: 1,
      fieldName: "page",
    });

    if (pageResult.error) {
      return res.status(400).json({
        status: "error",
        message: pageResult.error,
      });
    }

    const limitResult = parsePositiveIntegerQuery({
      value: limit,
      fallback: 25,
      maximum: 100,
      fieldName: "limit",
    });

    if (limitResult.error) {
      return res.status(400).json({
        status: "error",
        message: limitResult.error,
      });
    }

    const parsedPage = pageResult.value;
    const parsedLimit = limitResult.value;
    const offset = (parsedPage - 1) * parsedLimit;

    if (!Number.isSafeInteger(offset)) {
      return res.status(400).json({
        status: "error",
        message: "page is too large.",
      });
    }

    const where = {
      organizationId: req.user.organizationId,
    };

    if (action !== undefined) {
      if (typeof action !== "string") {
        return res.status(400).json({
          status: "error",
          message: "action must be a string.",
        });
      }

      const normalizedAction = action.trim();

      if (!normalizedAction || normalizedAction.length > 100) {
        return res.status(400).json({
          status: "error",
          message: "action must be between 1 and 100 characters.",
        });
      }

      where.action = normalizedAction;
    }

    if (entityType !== undefined) {
      if (typeof entityType !== "string") {
        return res.status(400).json({
          status: "error",
          message: "entityType must be a string.",
        });
      }

      const normalizedEntityType = entityType.trim();

      if (!normalizedEntityType || normalizedEntityType.length > 100) {
        return res.status(400).json({
          status: "error",
          message: "entityType must be between 1 and 100 characters.",
        });
      }

      where.entityType = normalizedEntityType;
    }

    let parsedActorUserId;
    let parsedTargetUserId;

    if (actorUserId !== undefined) {
      const result = parsePositiveIntegerQuery({
        value: actorUserId,
        fieldName: "actorUserId",
      });

      if (result.error) {
        return res.status(400).json({
          status: "error",
          message: result.error,
        });
      }

      parsedActorUserId = result.value;
    }

    if (targetUserId !== undefined) {
      const result = parsePositiveIntegerQuery({
        value: targetUserId,
        fieldName: "targetUserId",
      });

      if (result.error) {
        return res.status(400).json({
          status: "error",
          message: result.error,
        });
      }

      parsedTargetUserId = result.value;
    }

    if (actorName !== undefined && typeof actorName !== "string") {
      return res.status(400).json({
        status: "error",
        message: "actorName must be a string.",
      });
    }

    if (targetName !== undefined && typeof targetName !== "string") {
      return res.status(400).json({
        status: "error",
        message: "targetName must be a string.",
      });
    }

    const normalizedActorName = actorName !== undefined ? actorName.trim() : "";

    const normalizedTargetName =
      targetName !== undefined ? targetName.trim() : "";

    if (parsedActorUserId !== undefined) {
      where.actorUserId = parsedActorUserId;
    }

    if (parsedTargetUserId !== undefined) {
      where.targetUserId = parsedTargetUserId;
    }

    const include = [
      {
        model: User,
        as: "actor",
        attributes: ["id", "name", "email", "role"],
        required: Boolean(normalizedActorName),
        where: normalizedActorName
          ? {
              name: {
                [Op.iLike]: `%${normalizedActorName}%`,
              },
            }
          : undefined,
      },
      {
        model: User,
        as: "targetUser",
        attributes: ["id", "name", "email", "role"],
        required: Boolean(normalizedTargetName),
        where: normalizedTargetName
          ? {
              name: {
                [Op.iLike]: `%${normalizedTargetName}%`,
              },
            }
          : undefined,
      },
    ];

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      include,
      order: [["createdAt", "DESC"]],
      limit: parsedLimit,
      offset,
      distinct: true,
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
    logError(error, {
      req,
      event: "audit_logs_load_failed",
      message: "Failed to load audit logs",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching audit logs.",
    });
  }
};

module.exports = { getAuditLogs };
