const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const PasswordResetToken = sequelize.define(
  "PasswordResetToken",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "Password reset token hash is required.",
        },
        len: {
          args: [64, 64],
          msg: "Password reset token hash must contain 64 characters.",
        },
      },
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    consumedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    invalidatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    requestIp: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    tableName: "password_reset_tokens",
    timestamps: true,
    underscored: false,
  },
);

module.exports = PasswordResetToken;
