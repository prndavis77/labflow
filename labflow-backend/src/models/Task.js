const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Project = require("./Project");
const User = require("./User");

// Task represents a project-related action item inside a lab project.
// Examples: prepare standards, analyze chromatograms, review protocol, write report section.
const Task = sequelize.define(
  "Task",
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
          msg: "Task title is required.",
        },
        len: {
          args: [3, 200],
          msg: "Task title must be between 3 and 200 characters.",
        },
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "todo",
        "in_progress",
        "blocked",
        "review",
        "completion_requested",
        "done",
      ),
      allowNull: false,
      defaultValue: "todo",
    },

    priority: {
      type: DataTypes.ENUM("low", "medium", "high", "urgent"),
      allowNull: false,
      defaultValue: "medium",
    },

    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "due_date",
    },

    projectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "project_id",
      references: {
        model: Project,
        key: "id",
      },
    },

    assignedToId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_to_id",
      references: {
        model: User,
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

    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_archived",
    },

    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "archived_at",
    },

    archivedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "archived_by_id",
      references: {
        model: User,
        key: "id",
      },
    },

    archiveReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "archive_reason",
    },
  },
  {
    tableName: "tasks",
    timestamps: true,
    underscored: true,
  },
);

// A project can have many tasks.
Project.hasMany(Task, {
  foreignKey: "projectId",
  as: "tasks",
});

// A task belongs to one project
Task.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// A task can be assigned to one user.
Task.belongsTo(User, {
  foreignKey: "assignedToId",
  as: "assignedTo",
});

// A user can have many assigned tasks.
User.hasMany(Task, {
  foreignKey: "assignedToId",
  as: "assignedTasks",
});

// A task is created by one user.
Task.belongsTo(User, {
  foreignKey: "createdById",
  as: "createdBy",
});

// A user can create many tasks.
User.hasMany(Task, {
  foreignKey: "createdById",
  as: "createdTasks",
});

Task.belongsTo(User, {
  foreignKey: "archivedById",
  as: "archivedBy",
});

User.hasMany(Task, {
  foreignKey: "archivedById",
  as: "archivedTasks",
});

module.exports = Task;
