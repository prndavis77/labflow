const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    actorUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "actor_user_id",
    },

    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Audit action is required.",
        },
      },
    },

    entityType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "entity_type",
      validate: {
        notEmpty: {
          msg: "Audit entity type is required.",
        },
      },
    },

    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "entity_id",
    },

    targetUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "target_user_id",
    },

    summary: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Audit summary is required.",
        },
      },
    },

    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    ipAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "ip_address",
    },

    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "user_agent",
    },

    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "organization_id",
    },
  },
  {
    tableName: "audit_logs",
    underscored: true,
  },
);

module.exports = AuditLog;
