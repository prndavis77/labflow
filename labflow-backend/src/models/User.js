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
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  },
);

module.exports = User;
