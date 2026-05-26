const { NotebookEntry, Experiment, Project, User } = require("../models");

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

    // Build a flexible filter object from query parameters.
    const where = {};

    if (experimentId) {
      where.experimentId = experimentId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (entryType) {
      where.entryType = entryType;
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
    console.error("Error fetching notebook entries", error);

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
    const { id } = req.params;

    const entry = await NotebookEntry.findByPk(id, {
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
    console.error("Error fetching notebook entry", error);

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
    const { title, entryType, content, contentFormat, experimentId } = req.body;

    if (!title || !content || !experimentId) {
      return res.status(400).json({
        status: "error",
        message: "Title, content, and experiment are required.",
      });
    }

    const experiment = await Experiment.findByPk(experimentId);

    if (!experiment) {
      return res.status(404).json({
        status: "error",
        message: "Experiment not found.",
      });
    }

    const entry = await NotebookEntry.create({
      title: title.trim(),
      entryType: entryType || "general_note",
      content: content.trim(),
      contentFormat: contentFormat || "plain_text",
      experimentId: experiment.id,
      projectId: experiment.projectId,
      authorId: req.user.id,
    });

    const createdEntry = await NotebookEntry.findByPk(entry.id, {
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
    console.error("Error creating notebook entry", error);

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
    const { id } = req.params;

    const { title, entryType, content, contentFormat, experimentId } = req.body;

    const entry = await NotebookEntry.findByPk(id);

    if (!entry) {
      return res.status(404).json({
        status: "error",
        message: "Notebook entry not found.",
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
      const experiment = await Experiment.findByPk(experimentId);

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
      title: title !== undefined ? title.trim() : entry.title,
      entryType: entryType !== undefined ? entryType : entry.entryType,
      content: content !== undefined ? content.trim() : entry.content,
      contentFormat:
        contentFormat !== undefined ? contentFormat : entry.contentFormat,
      experimentId: nextExperimentId,
      projectId: nextProjectId,
    });

    const updatedEntry = await NotebookEntry.findByPk(entry.id, {
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
    console.error("Error updating notebook entry", error);

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
    const { id } = req.params;

    const entry = await NotebookEntry.findByPk(id);

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
    console.error("Error deleting notebook entry", error);

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
