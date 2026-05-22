const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const User = require("./User");

// Project represents a research project inside a university lab.
// Later, tasks, experiments, protocols, samples, and bookings will connect to this model.
const Project = sequelize.define(
  "Project",
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
          msg: "Project title cannot be empty.",
        },
        len: {
          args: [3, 200],
          msg: "Project title must be between 3 and 200 characters.",
        },
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "planning",
        "active",
        "on_hold",
        "completed",
        "archived",
      ),
      allowNull: false,
      defaultValue: "planning",
    },

    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "start_date",
    },

    targetEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "target_end_date",
    },
    supervisorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "supervisor_id",
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    tableName: "projects",
    timestamps: true,
    underscored: true,
  },
);

// A project belongs to one supervisor.
// This lets us show supervisor details when fetching projects.
Project.belongsTo(User, {
  foreignKey: "supervisorId",
  as: "supervisor",
});

// A supervisor can manage many projects.
// This is useful later for dashboard summaries.
User.hasMany(Project, {
  foreignKey: "supervisorId",
  as: "supervisedProjects",
});

module.exports = Project;
