const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Name is required.",
        },
        len: {
          args: [2, 100],
          msg: "Name must be between 2 and 100 characters.",
        },
      },
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: "Please provide a valid email address.",
        },
        notEmpty: {
          msg: "Email is required.",
        },
      },
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash",
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
    // Controls whether a researcher can independently create experiments
    // Admins and supervisors have this ability by role regardless of this flag
    canCreateExperiments: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "can_create_experiments",
    },

    // Controls whether a researcher can independently edit experiments
    // Admins and supervisors have this ability by role regardless of this flag
    canEditExperiments: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "can_edit_experiments",
    },

    // Controls whether a researcher can independently create protocols
    // Default is false because protocols/SOPs are more controlled lab documents
    canCreateProtocols: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "can_create_protocols",
    },

    // Controls whether a researcher can independently edit protocols
    // Default is false because protocols/SOPs often need supervisor control
    canEditProtocols: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "can_edit_protocols",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    deactivatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    deactivatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  },
);

module.exports = User;
