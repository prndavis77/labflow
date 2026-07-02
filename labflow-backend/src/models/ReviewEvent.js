const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const User = require("./User");

// ReviewEvent stores the history of review decisions for experiments and protocols
// It supports repeated review cycles such as:
// changes requested -> revised -> more changes requested -> approved
const ReviewEvent = sequelize.define(
  "ReviewEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    targetType: {
      type: DataTypes.ENUM("experiment", "protocol", "task"),
      allowNull: false,
      field: "target_type",
      validate: {
        notEmpty: {
          msg: "Review event target type is required.",
        },
      },
    },

    targetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "target_id",
      validate: {
        notEmpty: {
          msg: "Review event target ID is required.",
        },
      },
    },

    action: {
      type: DataTypes.ENUM("submitted", "approved", "changes_requested"),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Review event action is required.",
        },
      },
    },

    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    reviewerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "reviewer_id",
      references: {
        model: User,
        key: "id",
      },
    },

    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "organization_id",
    },
  },
  {
    tableName: "review_events",
    timestamps: true,
    underscored: true,
  },
);

// A review event belongs to the user who made the review decision
ReviewEvent.belongsTo(User, {
  foreignKey: "reviewerId",
  as: "reviewer",
});

// A user can create many review events
User.hasMany(ReviewEvent, {
  foreignKey: "reviewerId",
  as: "reviewEvents",
});

module.exports = ReviewEvent;
