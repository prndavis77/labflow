const {
  Experiment,
  Project,
  User,
  Task,
  Protocol,
  ReviewEvent,
} = require("../models");

const { writeAuditLog } = require("../utils/auditLogger");

const { Op } = require("sequelize");

const {
  getAccessibleProjectIds,
  canUseProjectForResearchWork,
  canEditProjectLinkedWork,
  canViewProjectLinkedRecord,
  canReviewProjectLinkedRecord,
  getProjectMemberRole,
} = require("../utils/projectAccess");

const {
  canCreateExperiment,
  canEditExperiment,
} = require("../utils/workflowPermissions");

const VALID_REVIEW_STATUSES = [
  "not_submitted",
  "pending",
  "approved",
  "changes_requested",
];

const VALID_EXPERIMENT_STATUSES = [
  "planned",
  "in_progress",
  "waiting_for_data",
  "needs_review",
  "completed",
  "failed",
  "repeated",
  "archived",
];

const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
};

const canCreateExperimentInProject = async (user, projectId) => {
  const canEditProject = await canEditProjectLinkedWork(user, projectId);

  if (!canEditProject) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  if (projectRole === "lead") {
    return true;
  }

  if (projectRole === "member") {
    return canCreateExperiment(user);
  }

  return false;
};

const canEditExperimentInProject = async (user, projectId) => {
  const canEditProject = await canEditProjectLinkedWork(user, projectId);

  if (!canEditProject) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  if (projectRole === "lead") {
    return true;
  }

  if (projectRole === "member") {
    return canEditExperiment(user);
  }

  return false;
};

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

// Creates a review history event for experiment review decisions.
// This keeps a permanent record of approvals and change requests.
const createExperimentReviewEvent = async ({
  experimentId,
  action,
  comment,
  reviewerId,
}) => {
  await ReviewEvent.create({
    targetType: "experiment",
    targetId: experimentId,
    action,
    comment: comment?.trim() || null,
    reviewerId,
  });
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

    if (req.user.role !== "admin") {
      const accessibleProjectIds = (
        await getAccessibleProjectIds(req.user)
      ).map(Number);

      if (projectId) {
        const requestedProjectId = Number(projectId);

        if (!accessibleProjectIds.includes(requestedProjectId)) {
          return res.status(403).json({
            status: "error",
            message: "You do not have access to this project's experiments.",
          });
        }

        where.projectId = requestedProjectId;
      } else {
        where.projectId = {
          [Op.in]: accessibleProjectIds,
        };
      }
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

    if (experiment.projectId) {
      const canViewExperimentProject = await canViewProjectLinkedRecord(
        req.user,
        experiment.projectId,
      );

      if (!canViewExperimentProject) {
        return res.status(403).json({
          status: "error",
          message: "You do not have access to this experiment.",
        });
      }
    }

    const canUseProject = await canUseProjectForResearchWork(
      req.user,
      experiment.projectId,
    );

    if (!canUseProject) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to this experiment.",
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

    if (status !== undefined && !VALID_EXPERIMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid experiment status.",
      });
    }

    if (
      reviewStatus !== undefined &&
      !VALID_REVIEW_STATUSES.includes(reviewStatus)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid review status.",
      });
    }

    if (
      reviewStatus !== undefined &&
      ["approved", "changes_requested"].includes(reviewStatus) &&
      !["admin", "supervisor"].includes(req.user.role)
    ) {
      return res.status(403).json({
        status: "error",
        message:
          "Only admins and supervisors can create experiments with review decisions.",
      });
    }

    if (reviewStatus === "changes_requested" && !reviewComment?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "A review comment is required when requesting changes.",
      });
    }

    const project = await Project.findByPk(projectId);

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    const canUseProject = await canUseProjectForResearchWork(
      req.user,
      projectId,
    );

    if (!canUseProject) {
      return res.status(403).json({
        status: "error",
        message:
          "You do not have access to create experiments for this project.",
      });
    }

    const canCreateForProject = await canCreateExperimentInProject(
      req.user,
      projectId,
    );

    if (!canCreateForProject) {
      return res.status(403).json({
        status: "error",
        message:
          "Only admins, project supervisors, project leads, and workflow-authorized project members can create experiments.",
      });
    }

    // If no researcher is provided, default to the logged-in user
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

    if (
      projectId !== undefined &&
      Number(projectId) !== Number(experiment.projectId)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Experiment project cannot be changed after creation.",
      });
    }

    if (status !== undefined && !VALID_EXPERIMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid experiment status.",
      });
    }

    if (
      reviewStatus !== undefined &&
      !VALID_REVIEW_STATUSES.includes(reviewStatus)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid review status.",
      });
    }

    const resolvedProjectId = experiment.projectId;

    const canUseProject = await canUseProjectForResearchWork(
      req.user,
      resolvedProjectId,
    );

    if (!canUseProject) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to edit experiments for this project.",
      });
    }

    const canEditForProject = await canEditExperimentInProject(
      req.user,
      experiment.projectId,
    );

    if (!canEditForProject) {
      return res.status(403).json({
        status: "error",
        message:
          "Only admins, project supervisors, project leads, and workflow-authorized project members can edit experiments.",
      });
    }

    const previousReviewStatus = experiment.reviewStatus;

    const isReviewDecision =
      reviewStatus !== undefined &&
      ["approved", "changes_requested"].includes(reviewStatus);

    if (isReviewDecision) {
      if (!["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({
          status: "error",
          message:
            "Only admins and supervisors can make experiment review decisions.",
        });
      }

      const canReviewExperimentProject = await canReviewProjectLinkedRecord(
        req.user,
        experiment.projectId,
      );

      if (!canReviewExperimentProject) {
        return res.status(403).json({
          status: "error",
          message:
            "You can only review experiments for projects you are authorized to supervise.",
        });
      }
    }

    const isSubmitForReview =
      reviewStatus === "pending" &&
      ["not_submitted", "changes_requested"].includes(previousReviewStatus);

    if (reviewStatus === "pending" && !isSubmitForReview) {
      return res.status(400).json({
        status: "error",
        message:
          "Only not submitted or changes requested experiments can be submitted for review.",
      });
    }

    if (reviewStatus === "changes_requested" && !reviewComment?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "A review comment is required when requesting changes.",
      });
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

      if (
        protocol.projectId &&
        Number(protocol.projectId) !== Number(resolvedProjectId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Linked protocol must either be general or belong to the selected project.",
        });
      }
    }

    const nextReviewStatus =
      reviewStatus !== undefined ? reviewStatus : experiment.reviewStatus;

    const nextStatus = status !== undefined ? status : experiment.status;

    await experiment.update({
      title: title !== undefined ? title.trim() : experiment.title,
      objective:
        objective !== undefined
          ? objective?.trim() || null
          : experiment.objective,
      notes: notes !== undefined ? notes?.trim() || null : experiment.notes,
      status: nextStatus,
      reviewStatus: nextReviewStatus,
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
      researcherId:
        researcherId !== undefined ? researcherId : experiment.researcherId,
      taskId: taskId !== undefined ? taskId || null : experiment.taskId,
      protocolId:
        protocolId !== undefined ? protocolId || null : experiment.protocolId,
    });

    if (
      reviewStatus !== undefined &&
      ["approved", "changes_requested"].includes(nextReviewStatus)
    ) {
      const shouldCreateReviewEvent =
        nextReviewStatus !== previousReviewStatus ||
        nextReviewStatus === "changes_requested";

      if (shouldCreateReviewEvent) {
        await createExperimentReviewEvent({
          experimentId: experiment.id,
          action: nextReviewStatus,
          comment:
            nextReviewStatus === "changes_requested"
              ? reviewComment
              : reviewComment || "Experiment approved.",
          reviewerId: req.user.id,
        });

        await writeAuditLog({
          req,
          action:
            nextReviewStatus === "approved"
              ? "experiment.approved"
              : "experiment.changes_requested",
          entityType: "experiment",
          entityId: experiment.id,
          summary:
            nextReviewStatus === "approved"
              ? `${req.user.name} approved experiment "${experiment.title}".`
              : `${req.user.name} requested changes for experiment "${experiment.title}".`,
          metadata: {
            previousReviewStatus,
            newReviewStatus: nextReviewStatus,
            reviewComment:
              nextReviewStatus === "changes_requested"
                ? reviewComment?.trim()
                : reviewComment?.trim() || "Experiment approved.",
            projectId: experiment.projectId,
          },
        });
      }
    }

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

    if (req.user.role === "admin") {
      await experiment.destroy();

      return res.json({
        status: "success",
        message: "Experiment deleted successfully.",
      });
    }

    if (req.user.role === "supervisor") {
      const canDeleteExperimentProject = await canEditProjectLinkedWork(
        req.user,
        experiment.projectId,
      );

      if (!canDeleteExperimentProject) {
        return res.status(403).json({
          status: "error",
          message:
            "Supervisors can only delete experiments for projects they supervise.",
        });
      }

      await experiment.destroy();

      return res.json({
        status: "success",
        message: "Experiment deleted successfully.",
      });
    }

    return res.status(403).json({
      status: "error",
      message: "Only admins and project supervisors can delete experiments.",
    });
  } catch (error) {
    console.error("Error deleting experiment:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the experiment.",
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
