const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Invitation = sequelize.define(
  "Invitation",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "organization_id",
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: { msg: "A valid email address is required." },
        notEmpty: { msg: "Email is required." },
      },
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Name is required." },
      },
    },

    role: {
      type: DataTypes.ENUM("admin", "supervisor", "researcher"),
      allowNull: false,
      defaultValue: "researcher",
    },

    department: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    tokenHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "token_hash",
    },

    status: {
      type: DataTypes.ENUM("pending", "accepted", "revoked", "expired"),
      allowNull: false,
      defaultValue: "pending",
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },

    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "accepted_at",
    },

    invitedById: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "invited_by_id",
    },

    acceptedUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "accepted_user_id",
    },

    canCreateExperiments: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "can_create_experiments",
    },

    canEditExperiments: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "can_edit_experiments",
    },

    canCreateProtocols: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "can_create_protocols",
    },

    canEditProtocols: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "can_edit_protocols",
    },
  },
  {
    tableName: "invitations",
    underscored: true,
  },
);

module.exports = Invitation;
