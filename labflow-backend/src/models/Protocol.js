const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Project = require("./Project");
const User = require("./User");

// Protocol represents a reusable lab method, SOP, or procedure
// Examples: HPLC method, sample preparation SOP, extraction protocol, calibration workflow
const Protocol = sequelize.define(
  "Protocol",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Protocol title is required.",
        },
        len: {
          args: [3, 200],
          msg: "Protocol title must be between 3 and 200 characters.",
        },
      },
    },

    version: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "1.0",
      validate: {
        notEmpty: {
          msg: "Protocol version is required.",
        },
      },
    },

    purpose: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Protocol content is required.",
        },
      },
    },

    approvalStatus: {
      type: DataTypes.ENUM(
        "draft",
        "pending_review",
        "approved",
        "changes_requested",
        "archived",
      ),
      allowNull: false,
      defaultValue: "draft",
      field: "approval_status",
    },

    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "project_id",
      references: {
        model: Project,
        key: "id",
      },
    },

    createdById: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "created_by_id",
      references: {
        model: User,
        key: "id",
      },
    },

    approvedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "approved_by_id",
      references: {
        model: User,
        key: "id",
      },
    },

    approvedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "approved_at",
    },
  },
  {
    tableName: "protocols",
    timestamps: true,
    underscored: true,
  },
);

// A protocol belongs to one project
Protocol.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// A project can have many protocols
Project.hasMany(Protocol, {
  foreignKey: "projectId",
  as: "protocols",
});

// A protocol is created by one user
Protocol.belongsTo(User, {
  foreignKey: "createdById",
  as: "createdBy",
});

// A user can create many protocols
User.hasMany(Protocol, {
  foreignKey: "createdById",
  as: "createdProtocols",
});

// A protocol can be approved by one supervisor or admin
Protocol.belongsTo(User, {
  foreignKey: "approvedById",
  as: "approvedBy",
});

// A user can approve many protocols
User.hasMany(Protocol, {
  foreignKey: "approvedById",
  as: "approvedProtocols",
});

module.exports = Protocol;
