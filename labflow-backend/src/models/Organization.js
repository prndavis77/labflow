const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Organization = sequelize.define(
  "Organization",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Organization name is required." },
      },
    },

    slug: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: "Organization slug is required." },
      },
    },

    type: {
      type: DataTypes.ENUM(
        "lab",
        "department",
        "institution",
        "company",
        "demo",
      ),
      allowNull: false,
      defaultValue: "lab",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "organizations",
    underscored: true,
  },
);

module.exports = Organization;
