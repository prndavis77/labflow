const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Project = require("./Project");
const Experiment = require("./Experiment");
const User = require("./User");

// NotebookEntry represents an experiment-linked lab notebook record
// Each entry belongs to one experiment and is written by one user
// Later, this model can support rich text, file attachments, image uploads, and PDF export
const NotebookEntry = sequelize.define(
  "NotebookEntry",
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
          msg: "Notebook entry title is required.",
        },
        len: {
          args: [3, 200],
          msg: "Notebook entry title must be between 3 and 200 characters.",
        },
      },
    },

    entryType: {
      type: DataTypes.ENUM(
        "general_note",
        "procedure",
        "observation",
        "result",
        "issue",
        "conclusion",
        "supervisor_comment",
      ),
      allowNull: false,
      defaultValue: "general_note",
      field: "entry_type",
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Notebook entry content is required.",
        },
      },
    },

    contentFormat: {
      type: DataTypes.ENUM("plain_text", "rich_text"),
      allowNull: false,
      defaultValue: "plain_text",
      field: "content_format",
    },

    experimentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "experiment_id",
      references: {
        model: Experiment,
        key: "id",
      },
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

    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "author_id",
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    tableName: "notebook_entries",
    timestamps: true,
    underscored: true,
  },
);

// A notebook entry belongs to one experiment
NotebookEntry.belongsTo(Experiment, {
  foreignKey: "experimentId",
  as: "experiment",
});

// An experiment can have many notebook entries
Experiment.hasMany(NotebookEntry, {
  foreignKey: "experimentId",
  as: "notebookEntries",
});

// A notebook entry belongs to one project
// This is stored directly for easier filtering and dashboard queries
NotebookEntry.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// A project can have many notebook entries
Project.hasMany(NotebookEntry, {
  foreignKey: "projectId",
  as: "notebookEntries",
});

// A notebook entry belongs to one author
NotebookEntry.belongsTo(User, {
  foreignKey: "authorId",
  as: "author",
});

// A user can write many notebook entries
User.hasMany(NotebookEntry, {
  foreignKey: "authorId",
  as: "notebookEntries",
});

module.exports = NotebookEntry;
