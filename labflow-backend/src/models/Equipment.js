const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// Equipment represents a shared lab instrument or resource
// Examples: HPLC, GC-MS, microscope, centrifuge, balance, incubator
const Equipment = sequelize.define(
  "Equipment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Equipment name is required.",
        },
        len: {
          args: [2, 200],
          msg: "Equipment name must be between 2 and 200 characters.",
        },
      },
    },

    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Equipment type is required.",
        },
      },
    },

    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "available",
        "maintenance",
        "out_of_service",
        "retired",
      ),
      allowNull: false,
      defaultValue: "available",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "equipment",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Equipment;
