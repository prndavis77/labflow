const { Experiment, Project, User, Task, Protocol } = require("../models");

// Formats user data safely for API responses
// This prevents sensitive fields like passwordHash from leaking to the frontend

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

// Formats project data for experiment responses.
// Experiments only need a project summary in list views
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

// Formats task data for experiment responses
// Experiments can optionally be linked to a task
const formatTaskSummary = (task) => {
  if (!task) {
    return null;
  }

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
  };
};

// Formats protocol data for experiment responses
// Experiments only need a protocol summary in list views
const formatProtocolSummary = (protocol) => {
  if (!protocol) {
    return null;
  }

  return {
    id: protocol.id,
    title: protocol.title,
    version: protocol.version,
    approvalStatus: protocol.approvalStatus,
  };
};

// Formats experiment data before sending it to the frontend
const formatExperimentResponse = (experiment) => {
  return {
    id: experiment.id,
    title: experiment.title,
    objective: experiment.objective,
    notes: experiment.notes,
    status: experiment.status,
    reviewStatus: experiment.reviewStatus,
    reviewComment: experiment.reviewComment,
    startedAt: experiment.startedAt,
    completedAt: experiment.completedAt,
    projectId: experiment.projectId,
    researcherId: experiment.researcherId,
    taskId: experiment.taskId,
    protocolId: experiment.protocolId,
    createdById: experiment.createdById,
    project: formatProjectSummary(experiment.project),
    researcher: formatUserSummary(experiment.researcher),
    task: formatTaskSummary(experiment.task),
    protocol: formatProtocolSummary(experiment.protocol),
    createdBy: formatUserSummary(experiment.createdBy),
    createdAt: experiment.createdAt,
    updatedAt: experiment.updatedAt,
  };
};

// Reusable include configuration for experiment queries
// This keeps list, detail, create, and update responses consistent

const experimentInclude = [
  {
    model: Project,
    as: "project",
    attributes: ["id", "title", "status"],
  },
  {
    model: User,
    as: "researcher",
    attributes: ["id", "name", "email", "role", "department"],
  },
  {
    model: Task,
    as: "task",
    attributes: ["id", "title", "status", "priority", "dueDate"],
  },
  {
    model: Protocol,
    as: "protocol",
    attributes: ["id", "title", "version", "approvalStatus"],
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "name", "email", "role", "department"],
  },
];

// GET /api/experiments
// Returns experiments with optional filters for project, status, review status, and researcher.
const getExperiments = async (req, res) => {
  try {
    const { projectId, status, reviewStatus, researcherId, taskId } = req.query;

    // Build a flexible filter object from query parameters
    const where = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (taskId) {
      where.taskId = taskId;
    }

    if (status) {
      where.status = status;
    }

    if (reviewStatus) {
      where.reviewStatus = reviewStatus;
    }

    if (researcherId) {
      where.researcherId = researcherId;
    }

    const experiments = await Experiment.findAll({
      where,
      include: experimentInclude,
      order: [
        ["startedAt", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.json({
      status: "success",
      data: {
        experiments: experiments.map(formatExperimentResponse),
      },
    });
  } catch (error) {
    console.error("Error getting experiments", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching experiments.",
    });
  }
};

// GET /api/experiments/:id
// Returns one experiment by ID.
const getExperimentById = async (req, res) => {
  try {
    const { id } = req.params;

    const experiment = await Experiment.findByPk(id, {
      include: experimentInclude,
    });

    if (!experiment) {
      return res.status(404).json({
        status: "error",
        message: "Experiment not found.",
      });
    }
    return res.json({
      status: "success",
      data: {
        experiment: formatExperimentResponse(experiment),
      },
    });
  } catch (error) {
    console.error("Error getting experiment", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the experiment.",
    });
  }
};

// POST /api/experiments
// Creates a project-linked experiment
const createExperiment = async (req, res) => {
  try {
    const {
      title,
      objective,
      notes,
      status,
      reviewStatus,
      reviewComment,
      startedAt,
      completedAt,
      projectId,
      researcherId,
      taskId,
      protocolId,
    } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({
        status: "error",
        message: "Experiment title and project are required.",
      });
    }

    const project = await Project.findByPk(projectId);

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    // If no researcher is provided, default to the logged-in user.
    const resolvedResearcherId = researcherId || req.user.id;

    const researcher = await User.findByPk(resolvedResearcherId);

    if (!researcher) {
      return res.status(404).json({
        status: "error",
        message: "Researcher not found.",
      });
    }

    if (taskId) {
      const task = await Task.findByPk(taskId);

      if (!task) {
        return res.status(404).json({
          status: "error",
          message: "Linked task not found.",
        });
      }

      if (Number(task.projectId) !== Number(projectId)) {
        return res.status(400).json({
          status: "error",
          message: "Linked task must belong to the selected project.",
        });
      }
    }

    if (protocolId) {
      const protocol = await Protocol.findByPk(protocolId);

      if (!protocol) {
        return res.status(404).json({
          status: "error",
          message: "Linked protocol not found.",
        });
      }

      // Project-specific protocols must belong to the selected project
      // General or equipment-specific SOPs with no project are allowed
      if (
        protocol.projectId &&
        Number(protocol.projectId) !== Number(projectId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Linked protocol must either be general or belong to the selected project.",
        });
      }
    }

    const experiment = await Experiment.create({
      title: title.trim(),
      objective: objective?.trim() || null,
      notes: notes?.trim() || null,
      status: status || "planned",
      reviewStatus: reviewStatus || "not_submitted",
      reviewComment: reviewComment?.trim() || null,
      startedAt: startedAt || null,
      completedAt: completedAt || null,
      projectId,
      researcherId: resolvedResearcherId,
      taskId: taskId || null,
      protocolId: protocolId || null,
      createdById: req.user.id,
    });

    const createdExperiment = await Experiment.findByPk(experiment.id, {
      include: experimentInclude,
    });

    return res.status(201).json({
      status: "success",
      message: "Experiment created successfully.",
      data: {
        experiment: formatExperimentResponse(createdExperiment),
      },
    });
  } catch (error) {
    console.error("Error creating experiment", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the experiment.",
    });
  }
};

// PATCH /api/experiments/:id
// Updates an existing experiment
const updateExperiment = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      objective,
      notes,
      status,
      reviewStatus,
      reviewComment,
      startedAt,
      completedAt,
      projectId,
      researcherId,
      taskId,
      protocolId,
    } = req.body;

    const experiment = await Experiment.findByPk(id);

    if (!experiment) {
      return res.status(404).json({
        status: "error",
        message: "Experiment not found.",
      });
    }

    const resolvedProjectId =
      projectId !== undefined ? projectId : experiment.projectId;

    if (projectId) {
      const project = await Project.findByPk(projectId);

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
        });
      }
    }

    if (researcherId) {
      const researcher = await User.findByPk(researcherId);

      if (!researcher) {
        return res.status(404).json({
          status: "error",
          message: "Researcher not found.",
        });
      }
    }

    if (taskId) {
      const task = await Task.findByPk(taskId);

      if (!task) {
        return res.status(404).json({
          status: "error",
          message: "Linked task not found.",
        });
      }

      if (Number(task.projectId) !== Number(resolvedProjectId)) {
        return res.status(400).json({
          status: "error",
          message: "Linked task must belong to the selected project.",
        });
      }
    }

    if (protocolId) {
      const protocol = await Protocol.findByPk(protocolId);

      if (!protocol) {
        return res.status(404).json({
          status: "error",
          message: "Linked protocol not found.",
        });
      }

      // Project-specific protocols must belong to the selected project.
      // General or equipment-specific SOPs with no project are allowed.
      if (
        protocol.projectId &&
        Number(protocol.projectId) !== Number(projectId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Linked protocol must either be general or belong to the selected project.",
        });
      }
    }

    await experiment.update({
      title: title !== undefined ? title.trim() : experiment.title,
      objective:
        objective !== undefined
          ? objective?.trim() || null
          : experiment.objective,
      notes: notes !== undefined ? notes?.trim() || null : experiment.notes,
      status: status !== undefined ? status : experiment.status,
      reviewStatus:
        reviewStatus !== undefined ? reviewStatus : experiment.reviewStatus,
      reviewComment:
        reviewComment !== undefined
          ? reviewComment?.trim() || null
          : experiment.reviewComment,
      startedAt:
        startedAt !== undefined ? startedAt || null : experiment.startedAt,
      completedAt:
        completedAt !== undefined
          ? completedAt || null
          : experiment.completedAt,
      projectId: projectId !== undefined ? projectId : experiment.projectId,
      researcherId:
        researcherId !== undefined ? researcherId : experiment.researcherId,
      taskId: taskId !== undefined ? taskId || null : experiment.taskId,
      protocolId:
        protocolId !== undefined ? protocolId || null : experiment.protocolId,
    });

    const updatedExperiment = await Experiment.findByPk(experiment.id, {
      include: experimentInclude,
    });

    return res.json({
      status: "success",
      message: "Experiment updated successfully.",
      data: {
        experiment: formatExperimentResponse(updatedExperiment),
      },
    });
  } catch (error) {
    console.error("Error updating experiment", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the experiment.",
    });
  }
};

// DELETE /api/experiments/:id
// Deletes an experiment
// Later, archiving is safer than hard deletion for audit history
const deleteExperiment = async (req, res) => {
  try {
    const { id } = req.params;

    const experiment = await Experiment.findByPk(id);

    if (!experiment) {
      return res.status(404).json({
        status: "error",
        message: "Experiment not found.",
      });
    }

    await experiment.destroy();

    return res.json({
      status: "success",
      message: "Experiment deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting experiment", error);

    return res.status(500).json({
      status: "error",
      message: "Something went wrong while deleting the experiment.",
    });
  }
};

module.exports = {
  getExperiments,
  getExperimentById,
  createExperiment,
  updateExperiment,
  deleteExperiment,
};
