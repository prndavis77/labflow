const { NotebookEntry, Experiment, Project, User } = require("../models");
const { Op } = require("sequelize");
const { getAccessibleProjectIds } = require("../utils/projectAccess");
const { logError } = require("../utils/errorLogger");

// Formats user data safely for API responses
const formatUserSummary = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
  };
};

// Formats project data for notebook entry responses
const formatProjectSummary = (project) => {
  if (!project) {
    return null;
  }

  return {
    id: project.id,
    title: project.title,
    status: project.status,
  };
};

// Formats experiment data for notebook entry responses
const formatExperimentSummary = (experiment) => {
  if (!experiment) {
    return null;
  }

  return {
    id: experiment.id,
    title: experiment.title,
    status: experiment.status,
    reviewStatus: experiment.reviewStatus,
  };
};

// Formats notebook entry data before sending it to the frontend
const formatNotebookEntryResponse = (entry) => {
  return {
    id: entry.id,
    title: entry.title,
    entryType: entry.entryType,
    content: entry.content,
    contentFormat: entry.contentFormat,
    experimentId: entry.experimentId,
    projectId: entry.projectId,
    authorId: entry.authorId,
    experiment: formatExperimentSummary(entry.experiment),
    project: formatProjectSummary(entry.project),
    author: formatUserSummary(entry.author),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
};

// Reusable include configuration for notebook entry queries
const notebookEntryInclude = [
  {
    model: Experiment,
    as: "experiment",
    attributes: ["id", "title", "status", "reviewStatus"],
  },
  {
    model: Project,
    as: "project",
    attributes: ["id", "title", "status"],
  },
  {
    model: User,
    as: "author",
    attributes: ["id", "name", "email", "role", "department"],
  },
];

const VALID_NOTEBOOK_ENTRY_TYPES = [
  "general_note",
  "procedure",
  "observation",
  "result",
  "issue",
  "conclusion",
  "supervisor_comment",
];

const VALID_NOTEBOOK_CONTENT_FORMATS = ["plain_text", "rich_text"];

const parsePositiveIntegerId = (value) => {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) ? id : null;
};

const parsePositiveIntegerBodyId = (value) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  return value;
};

// Checks whether the current user can modify a notebook entry
// Admins and supervisors can modify all entries
// Researchers can modify only their own entries
const canModifyNotebookEntry = (user, entry) => {
  if (!user || !entry) {
    return false;
  }

  if (["admin", "supervisor"].includes(user.role)) {
    return true;
  }

  return Number(entry.authorId) === Number(user.id);
};

// GET /api/notebook-entries
// Returns notebook entries with optional filters for experiment, project, author, and entry type.
const getNotebookEntries = async (req, res) => {
  try {
    const { experimentId, projectId, authorId, entryType } = req.query;

    let parsedExperimentId = null;
    let parsedProjectId = null;
    let parsedAuthorId = null;

    if (experimentId !== undefined) {
      parsedExperimentId = parsePositiveIntegerId(experimentId);

      if (parsedExperimentId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid experiment ID.",
        });
      }
    }

    if (projectId !== undefined) {
      parsedProjectId = parsePositiveIntegerId(projectId);

      if (parsedProjectId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid project ID.",
        });
      }
    }

    if (authorId !== undefined) {
      parsedAuthorId = parsePositiveIntegerId(authorId);

      if (parsedAuthorId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid author ID.",
        });
      }
    }

    if (
      entryType !== undefined &&
      !VALID_NOTEBOOK_ENTRY_TYPES.includes(entryType)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook entry type.",
      });
    }

    // Build a flexible filter object from query parameters.
    const where = { organizationId: req.user.organizationId };

    if (parsedExperimentId !== null) {
      where.experimentId = parsedExperimentId;
    }
    if (parsedAuthorId !== null) {
      where.authorId = parsedAuthorId;
    }
    if (entryType !== undefined) {
      where.entryType = entryType;
    }

    if (req.user.role === "admin") {
      if (parsedProjectId !== null) {
        where.projectId = parsedProjectId;
      }
    } else {
      const accessibleProjectIds = (
        await getAccessibleProjectIds(req.user)
      ).map(Number);

      if (parsedProjectId !== null) {
        if (!accessibleProjectIds.includes(parsedProjectId)) {
          return res.status(403).json({
            status: "error",
            message:
              "You do not have access to notebook entries for this project.",
          });
        }

        where.projectId = parsedProjectId;
      } else {
        where.projectId = {
          [Op.in]: accessibleProjectIds,
        };
      }
    }

    const entries = await NotebookEntry.findAll({
      where,
      include: notebookEntryInclude,
      order: [
        ["createdAt", "DESC"],
        ["updatedAt", "DESC"],
      ],
    });

    return res.json({
      status: "success",
      data: {
        notebookEntries: entries.map(formatNotebookEntryResponse),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "notebook_entry_list_failed",
      message: "Failed to fetch notebook entries",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching notebook entries.",
    });
  }
};

// GET /api/notebook-entries/:id
// Returns one notebook entry by ID
const getNotebookEntryById = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook entry ID.",
      });
    }

    const entry = await NotebookEntry.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
      include: notebookEntryInclude,
    });

    if (!entry) {
      return res.status(404).json({
        status: "error",
        message: "Notebook entry not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        notebookEntry: formatNotebookEntryResponse(entry),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "notebook_entry_load_failed",
      message: "Failed to fetch notebook entry",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the notebook entry.",
    });
  }
};

// POST /api/notebook-entries
// Creates a new notebook entry linked to one experiment
// The projectId is derived from the selected experiment to prevent mismatched data
const createNotebookEntry = async (req, res) => {
  try {
    const {
      title: rawTitle,
      entryType: rawEntryType,
      content: rawContent,
      contentFormat: rawContentFormat,
      experimentId: rawExperimentId,
    } = req.body;

    if (typeof rawTitle !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry title must be a string.",
      });
    }

    if (typeof rawContent !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry content must be a string.",
      });
    }

    if (rawEntryType !== undefined && typeof rawEntryType !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry type must be a string.",
      });
    }

    if (
      rawContentFormat !== undefined &&
      typeof rawContentFormat !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Notebook content format must be a string.",
      });
    }

    const experimentId = parsePositiveIntegerBodyId(rawExperimentId);

    if (experimentId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid experiment ID.",
      });
    }

    const title = rawTitle.trim();
    const content = rawContent.trim();

    const entryType = rawEntryType ?? "general_note";
    const contentFormat = rawContentFormat ?? "plain_text";

    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry title is required.",
      });
    }

    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry title must be between 3 and 200 characters.",
      });
    }

    if (!content) {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry content is required.",
      });
    }

    if (!VALID_NOTEBOOK_ENTRY_TYPES.includes(entryType)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook entry type.",
      });
    }

    if (!VALID_NOTEBOOK_CONTENT_FORMATS.includes(contentFormat)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook content format.",
      });
    }

    const experiment = await Experiment.findOne({
      where: {
        id: experimentId,
        organizationId: req.user.organizationId,
      },
    });

    if (!experiment) {
      return res.status(404).json({
        status: "error",
        message: "Experiment not found.",
      });
    }

    const entry = await NotebookEntry.create({
      title,
      entryType,
      content,
      contentFormat,
      experimentId: experiment.id,
      projectId: experiment.projectId,
      authorId: req.user.id,
      organizationId: req.user.organizationId,
    });
    const createdEntry = await NotebookEntry.findOne({
      where: {
        id: entry.id,
        organizationId: req.user.organizationId,
      },
      include: notebookEntryInclude,
    });

    return res.status(201).json({
      status: "success",
      message: "Notebook entry created successfully.",
      data: {
        notebookEntry: formatNotebookEntryResponse(createdEntry),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "notebook_entry_create_failed",
      message: "Failed to create notebook entry",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the notebook entry.",
    });
  }
};

// PATCH /api/notebook-entries/:id
// Updates an existing notebook entry
// Experiment can be changed, and projectId will be recalculated from the selected experiment
const updateNotebookEntry = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook entry ID.",
      });
    }

    const {
      title: rawTitle,
      entryType: rawEntryType,
      content: rawContent,
      contentFormat: rawContentFormat,
      experimentId: rawExperimentId,
    } = req.body;

    if (rawTitle !== undefined && typeof rawTitle !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry title must be a string.",
      });
    }

    if (rawContent !== undefined && typeof rawContent !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry content must be a string.",
      });
    }

    if (rawEntryType !== undefined && typeof rawEntryType !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry type must be a string.",
      });
    }

    if (
      rawContentFormat !== undefined &&
      typeof rawContentFormat !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Notebook content format must be a string.",
      });
    }

    const experimentId =
      rawExperimentId === undefined
        ? undefined
        : parsePositiveIntegerBodyId(rawExperimentId);

    if (rawExperimentId !== undefined && experimentId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid experiment ID.",
      });
    }

    const entry = await NotebookEntry.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!entry) {
      return res.status(404).json({
        status: "error",
        message: "Notebook entry not found.",
      });
    }

    const title = rawTitle !== undefined ? rawTitle.trim() : entry.title;

    const content =
      rawContent !== undefined ? rawContent.trim() : entry.content;

    const entryType =
      rawEntryType !== undefined ? rawEntryType : entry.entryType;

    const contentFormat =
      rawContentFormat !== undefined ? rawContentFormat : entry.contentFormat;

    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry title is required.",
      });
    }

    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry title must be between 3 and 200 characters.",
      });
    }

    if (!content) {
      return res.status(400).json({
        status: "error",
        message: "Notebook entry content is required.",
      });
    }

    if (!VALID_NOTEBOOK_ENTRY_TYPES.includes(entryType)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook entry type.",
      });
    }

    if (!VALID_NOTEBOOK_CONTENT_FORMATS.includes(contentFormat)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook content format.",
      });
    }

    if (!canModifyNotebookEntry(req.user, entry)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden. You can only update your own notebook entries.",
      });
    }
    let nextExperimentId = entry.experimentId;
    let nextProjectId = entry.projectId;

    if (experimentId !== undefined) {
      const experiment = await Experiment.findOne({
        where: {
          id: parsedExperimentId,
          organizationId: req.user.organizationId,
        },
      });

      if (!experiment) {
        return res.status(404).json({
          status: "error",
          message: "Experiment not found.",
        });
      }

      nextExperimentId = experiment.id;
      nextProjectId = experiment.projectId;
    }

    await entry.update({
      title,
      entryType,
      content,
      contentFormat,
      experimentId: nextExperimentId,
      projectId: nextProjectId,
      organizationId: req.user.organizationId,
    });

    const updatedEntry = await NotebookEntry.findOne({
      where: {
        id: entry.id,
        organizationId: req.user.organizationId,
      },
      include: notebookEntryInclude,
    });

    return res.json({
      status: "success",
      message: "Notebook entry updated successfully.",
      data: {
        notebookEntry: formatNotebookEntryResponse(updatedEntry),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "notebook_entry_update_failed",
      message: "Failed to update notebook entry",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the notebook entry.",
    });
  }
};

// DELETE /api/notebook-entries/:id
// Deletes a notebook entry
// For a future production version, archiving or audit logging would be safer
const deleteNotebookEntry = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid notebook entry ID.",
      });
    }

    const entry = await NotebookEntry.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!entry) {
      return res.status(404).json({
        status: "error",
        message: "Notebook entry not found.",
      });
    }

    if (!canModifyNotebookEntry(req.user, entry)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden. You can only delete your own notebook entries.",
      });
    }

    await entry.destroy();

    return res.json({
      status: "success",
      message: "Notebook entry deleted successfully.",
    });
  } catch (error) {
    logError(error, {
      req,
      event: "notebook_entry_delete_failed",
      message: "Failed to delete notebook entry",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the notebook entry.",
    });
  }
};

module.exports = {
  getNotebookEntries,
  getNotebookEntryById,
  createNotebookEntry,
  updateNotebookEntry,
  deleteNotebookEntry,
};
