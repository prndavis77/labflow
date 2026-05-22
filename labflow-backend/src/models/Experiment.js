const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Project = require("./Project");
const User = require("./User");
const Task = require("./Task");
const Protocol = require("./Protocol");

// Experiment represents a real lab activity connected to a research project.
// Examples: HPLC run, sample extraction, microscopy session, method validation test.
const Experiment = sequelize.define(
  "Experiment",
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
          msg: "Experiment title is required.",
        },
        len: {
          args: [3, 200],
          msg: "Experiment title must be between 3 and 200 characters.",
        },
      },
    },

    objective: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "planned",
        "in_progress",
        "waiting_for_data",
        "needs_review",
        "completed",
        "failed",
        "repeated",
        "archived",
      ),
      allowNull: false,
      defaultValue: "planned",
    },

    reviewStatus: {
      type: DataTypes.ENUM(
        "not_submitted",
        "pending",
        "approved",
        "changes_requested",
      ),
      allowNull: false,
      defaultValue: "not_submitted",
      field: "review_status",
    },

    startedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "started_at",
    },

    completedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "completed_at",
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

    researcherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "researcher_id",
      references: {
        model: User,
        key: "id",
      },
    },

    taskId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "task_id",
      references: {
        model: Task,
        key: "id",
      },
    },

    protocolId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "protocol_id",
      references: {
        model: Protocol,
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
  },
  {
    tableName: "experiments",
    timestamps: true,
    underscored: true,
  },
);

// An experiment belongs to one project
Experiment.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// A project can have many experiments
Project.hasMany(Experiment, {
  foreignKey: "projectId",
  as: "experiments",
});

// An experiment is performed by one researcher
Experiment.belongsTo(User, {
  foreignKey: "researcherId",
  as: "researcher",
});

// A user can perform many experiments
User.hasMany(Experiment, {
  foreignKey: "researcherId",
  as: "researchExperiments",
});

// An experiment may be linked to one task.
Experiment.belongsTo(Task, {
  foreignKey: "taskId",
  as: "task",
});

// A task may have many related experiments
Task.hasMany(Experiment, {
  foreignKey: "taskId",
  as: "experiments",
});

// An experiment is created by one user
Experiment.belongsTo(User, {
  foreignKey: "createdById",
  as: "createdBy",
});

// A user can create many experiment records.
User.hasMany(Experiment, {
  foreignKey: "createdById",
  as: "createdExperiments",
});

// An experiment may use one protocol.
Experiment.belongsTo(Protocol, {
  foreignKey: "protocolId",
  as: "protocol",
});

// A protocol can be used by many experiments.
Protocol.hasMany(Experiment, {
  foreignKey: "protocolId",
  as: "experiments",
});

module.exports = Experiment;
