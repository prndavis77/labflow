const {
  Task,
  Project,
  User,
  ProjectMember,
  ReviewEvent,
} = require("../models");

const { getAccessibleProjectIds } = require("../utils/projectAccess");

const { writeAuditLog } = require("../utils/auditLogger");

const {
  canUseProjectForResearchWork,
  canEditProjectLinkedWork,
  canAssignProjectTask,
  canCreateProjectTask,
  canViewProjectLinkedRecord,
  canReviewProjectLinkedRecord,
  getProjectMemberRole,
} = require("../utils/projectAccess");
const {
  isValidDateOnly,
  isEndDateAfterStartDate,
} = require("../utils/dateUtils");

const { Op } = require("sequelize");

const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
};

const isUserProjectMember = async ({ userId, projectId }) => {
  if (!userId || !projectId) {
    return false;
  }

  const membership = await ProjectMember.findOne({
    where: {
      userId,
      projectId,
    },
  });

  return Boolean(membership);
};

const canViewTask = async (user, task) => {
  if (!user || !task) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  if (Number(task.assignedToId) === Number(user.id)) {
    return true;
  }

  if (task.projectId) {
    return canUseProjectForResearchWork(user, task.projectId);
  }

  return false;
};

const canCreateTaskForPayload = async (user, projectId) => {
  if (!user || !user.id) {
    return false;
  }

  // Standalone task rule.
  // Researchers can create standalone tasks assigned to themselves.
  if (!projectId) {
    return true;
  }

  // Project-linked task creation is a coordination action.
  // Allowed: admin, supervised-project supervisor, project lead.
  return canCreateProjectTask(user, projectId);
};

const canEditProjectTaskRecord = async ({ user, task }) => {
  if (!user || !user.id || !task) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "supervisor") {
    if (!task.projectId) {
      return Number(task.assignedToId) === Number(user.id);
    }

    return canEditProjectLinkedWork(user, task.projectId);
  }

  if (!task.projectId) {
    return Number(task.assignedToId) === Number(user.id);
  }

  const projectRole = await getProjectMemberRole(user, task.projectId);

  if (projectRole === "lead") {
    return true;
  }

  if (projectRole === "member") {
    return Number(task.assignedToId) === Number(user.id);
  }

  return false;
};

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  return Number.isNaN(numericValue) ? null : numericValue;
};

// Formats user data safely for API responses
// This prevents password hashes and unnecessary fields from leaking to the frontend
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

// Formats project data for task responses.
// Tasks only need a project summary, not the full project object.
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

// Formats task data before sending it to the frontend.
const formatTaskResponse = (task) => {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    projectId: task.projectId,
    assignedToId: task.assignedToId,
    createdById: task.createdById,
    project: formatProjectSummary(task.project),
    assignedTo: formatUserSummary(task.assignedTo),
    createdBy: formatUserSummary(task.createdBy),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

// GET /api/tasks
// Returns all tasks for now, with optional filters for project and status
const getTasks = async (req, res) => {
  try {
    const { projectId, status } = req.query;

    // Build a flexible where clause from optional query parameters.
    const where = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status;
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
            message: "You do not have access to tasks for this project.",
          });
        }

        where.projectId = requestedProjectId;
      } else {
        where[Op.or] = [
          {
            projectId: {
              [Op.in]: accessibleProjectIds,
            },
          },
          {
            projectId: null,
            assignedToId: req.user.id,
          },
          {
            projectId: null,
            createdById: req.user.id,
          },
        ];
      }
    }

    const tasks = await Task.findAll({
      where,
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "title", "status"],
          required: false,
        },
        {
          model: User,
          as: "assignedTo",
          attributes: ["id", "name", "email", "role", "department"],
        },
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
      order: [
        ["dueDate", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.json({
      status: "success",
      data: {
        tasks: tasks.map(formatTaskResponse),
      },
    });
  } catch (error) {
    console.error("Error getting tasks", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching tasks.",
    });
  }
};

// GET /api/tasks/:id
// Returns one task by ID.
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "title", "status"],
          required: false,
        },
        {
          model: User,
          as: "assignedTo",
          attributes: ["id", "name", "email", "role", "department"],
        },
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
    });

    if (!task) {
      return res.status(404).json({
        status: "error",
        message: "Task not found.",
      });
    }

    if (task.projectId) {
      const canViewTaskProject = await canViewProjectLinkedRecord(
        req.user,
        task.projectId,
      );

      if (!canViewTaskProject) {
        return res.status(403).json({
          status: "error",
          message: "You do not have access to this task.",
        });
      }
    }

    const hasAccess = await canViewTask(req.user, task);

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to this task.",
      });
    }

    return res.json({
      status: "success",
      data: {
        task: formatTaskResponse(task),
      },
    });
  } catch (error) {
    console.error("Error getting task by ID", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the task.",
    });
  }
};

// POST /api/tasks
// Creates a task linked to a project.
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      projectId,
      assignedToId,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Task title is required.",
      });
    }

    const isAdminOrSupervisor = ["admin", "supervisor"].includes(req.user.role);

    const resolvedProjectId = projectId || null;
    const resolvedAssignedToId =
      resolvedProjectId || ["admin", "supervisor"].includes(req.user.role)
        ? assignedToId
        : req.user.id;

    if (resolvedProjectId) {
      const project = await Project.findByPk(projectId);

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
        });
      }
    }

    const isProjectLinkedTask = Boolean(resolvedProjectId);

    if (isProjectLinkedTask) {
      const canCreateForProject = await canCreateTaskForPayload(
        req.user,
        resolvedProjectId,
      );

      if (!canCreateForProject) {
        return res.status(403).json({
          status: "error",
          message:
            "Only admins, project supervisors, and project leads can create project-linked tasks.",
        });
      }
    }

    const assignedUser = await User.findByPk(resolvedAssignedToId);

    if (!assignedUser) {
      return res.status(404).json({
        status: "error",
        message: "Assigned user not found.",
      });
    }

    const isAssigningToSomeoneElse =
      Number(resolvedAssignedToId) !== Number(req.user.id);

    if (resolvedProjectId) {
      const canEditProject = await canEditProjectLinkedWork(
        req.user,
        resolvedProjectId,
      );

      if (!canEditProject) {
        return res.status(403).json({
          status: "error",
          message:
            "You have read-only access to this project and cannot create project-linked tasks.",
        });
      }

      if (!isAdminOrSupervisor && isAssigningToSomeoneElse) {
        const canAssignProjectTasks = await canAssignProjectTask(
          req.user,
          resolvedProjectId,
        );

        if (!canAssignProjectTasks) {
          return res.status(403).json({
            status: "error",
            message:
              "Only project leads, admins, and supervisors can assign project tasks to other users.",
          });
        }
      }

      if (resolvedAssignedToId) {
        const assigneeIsProjectMember = await isUserProjectMember({
          userId: resolvedAssignedToId,
          projectId: resolvedProjectId,
        });

        if (!assigneeIsProjectMember) {
          return res.status(400).json({
            status: "error",
            message:
              "Project-linked tasks can only be assigned to members of the selected project.",
          });
        }
      }
    }

    if (
      !resolvedProjectId &&
      !isAdminOrSupervisor &&
      isAssigningToSomeoneElse
    ) {
      return res.status(403).json({
        status: "error",
        message:
          "Researchers can only create standalone tasks assigned to themselves.",
      });
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || null,
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null,
      projectId: resolvedProjectId,
      assignedToId: resolvedAssignedToId,
      createdById: req.user.id,
    });

    const createdTask = await Task.findByPk(task.id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "title", "status"],
        },
        {
          model: User,
          as: "assignedTo",
          attributes: ["id", "name", "email", "role", "department"],
        },
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "Task created successfully.",
      data: {
        task: formatTaskResponse(createdTask),
      },
    });
  } catch (error) {
    console.error("Error creating task", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the task.",
    });
  }
};

// PATCH /api/tasks/:id
// Updates an existing task.
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      projectId,
      assignedToId,
    } = req.body;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({
        status: "error",
        message: "Task not found.",
      });
    }

    const isChangingAssignment =
      assignedToId !== undefined &&
      Number(assignedToId) !== Number(task.assignedToId);

    if (isChangingAssignment) {
      if (!task.projectId) {
        if (req.user.role !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "Only admins can reassign standalone tasks.",
          });
        }
      } else {
        const canAssignOnProject = await canAssignProjectTask(
          req.user,
          task.projectId,
        );

        if (!canAssignOnProject) {
          return res.status(403).json({
            status: "error",
            message:
              "Only admins, project supervisors, and project leads can reassign project-linked tasks.",
          });
        }
      }

      if (!assignedToId) {
        if (req.user.role !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "Only admins can unassign tasks.",
          });
        }
      }

      if (assignedToId) {
        const assignedUser = await User.findByPk(assignedToId);

        if (!assignedUser) {
          return res.status(404).json({
            status: "error",
            message: "Assigned user not found.",
          });
        }

        if (task.projectId) {
          const assigneeIsProjectMember = await isUserProjectMember({
            userId: assignedToId,
            projectId: task.projectId,
          });

          if (!assigneeIsProjectMember) {
            return res.status(400).json({
              status: "error",
              message:
                "Project-linked tasks can only be assigned to members of the selected project.",
            });
          }
        }
      }
    }

    const isProjectTaskMemberSelfEdit =
      task.projectId &&
      req.user.role === "researcher" &&
      Number(task.assignedToId) === Number(req.user.id) &&
      (await getProjectMemberRole(req.user, task.projectId)) === "member";

    if (isProjectTaskMemberSelfEdit) {
      const blockedFields = [];

      if (assignedToId !== undefined) {
        blockedFields.push("assignedToId");
      }

      if (priority !== undefined) {
        blockedFields.push("priority");
      }

      if (dueDate !== undefined) {
        blockedFields.push("dueDate");
      }

      if (blockedFields.length > 0) {
        return res.status(403).json({
          status: "error",
          message:
            "Project members can update assigned task progress but cannot change task coordination fields.",
        });
      }
    }

    const currentProjectId = normalizeOptionalId(task.projectId);
    const requestedProjectId = normalizeOptionalId(projectId);

    if (projectId !== undefined && requestedProjectId !== currentProjectId) {
      return res.status(400).json({
        status: "error",
        message: "Task project cannot be changed after creation.",
      });
    }

    const isTaskCompletionReviewDecision =
      status !== undefined &&
      ["done", "in_progress"].includes(status) &&
      task.status === "completion_requested";

    if (isTaskCompletionReviewDecision) {
      if (!["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({
          status: "error",
          message:
            "Only admins and supervisors can review task completion requests.",
        });
      }

      if (task.projectId) {
        const canReviewTaskProject = await canReviewProjectLinkedRecord(
          req.user,
          task.projectId,
        );

        if (!canReviewTaskProject) {
          return res.status(403).json({
            status: "error",
            message:
              "You can only review task completion requests for projects you are authorized to supervise.",
          });
        }
      } else if (req.user.role !== "admin") {
        return res.status(403).json({
          status: "error",
          message:
            "Only admins can review standalone task completion requests.",
        });
      }
    }

    if (!isTaskCompletionReviewDecision) {
      const canEditTask = await canEditProjectTaskRecord({
        user: req.user,
        task,
      });

      if (!canEditTask) {
        return res.status(403).json({
          status: "error",
          message: "You do not have permission to edit this task.",
        });
      }
    }

    if (task.projectId && !isTaskCompletionReviewDecision) {
      const canEditProject = await canEditProjectLinkedWork(
        req.user,
        task.projectId,
      );

      if (!canEditProject) {
        return res.status(403).json({
          status: "error",
          message:
            "You have read-only access to this project and cannot edit project-linked tasks.",
        });
      }
    }

    if (status === "done" && !isTaskCompletionReviewDecision) {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          status: "error",
          message:
            "Tasks must be submitted for completion review before they can be marked done.",
        });
      }
    }

    const previousStatus = task.status;

    await task.update({
      title: title !== undefined ? title.trim() : task.title,
      description:
        description !== undefined
          ? description?.trim() || null
          : task.description,
      status: status !== undefined ? status : task.status,
      priority: priority !== undefined ? priority : task.priority,
      dueDate: dueDate !== undefined ? dueDate || null : task.dueDate,
      assignedToId:
        assignedToId !== undefined ? assignedToId || null : task.assignedToId,
    });

    if (
      status === "completion_requested" &&
      previousStatus !== "completion_requested"
    ) {
      await writeAuditLog({
        req,
        action: "task.completion_requested",
        entityType: "task",
        entityId: task.id,
        targetUserId: task.assignedToId || req.user.id,
        summary: `${req.user.name} requested completion review for task "${task.title}".`,
        metadata: {
          previousStatus,
          newStatus: status,
          projectId: task.projectId,
          assignedToId: task.assignedToId,
        },
      });
    }

    if (isTaskCompletionReviewDecision) {
      await ReviewEvent.create({
        targetType: "task",
        targetId: task.id,
        action: status === "done" ? "approved" : "changes_requested",
        comment:
          status === "done"
            ? "Task completion confirmed."
            : "Task reopened for further work.",
        reviewerId: req.user.id,
      });

      await writeAuditLog({
        req,
        action:
          status === "done"
            ? "task.completion_confirmed"
            : "task.completion_reopened",
        entityType: "task",
        entityId: task.id,
        targetUserId: task.assignedToId || null,
        summary:
          status === "done"
            ? `${req.user.name} confirmed completion of task "${task.title}".`
            : `${req.user.name} reopened task "${task.title}" for further work.`,
        metadata: {
          previousStatus,
          newStatus: status,
          projectId: task.projectId,
          assignedToId: task.assignedToId,
        },
      });
    }

    const updatedTask = await Task.findByPk(task.id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "title", "status"],
        },
        {
          model: User,
          as: "assignedTo",
          attributes: ["id", "name", "email", "role", "department"],
        },
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
    });

    return res.json({
      status: "success",
      message: "Task updated successfully.",
      data: {
        task: formatTaskResponse(updatedTask),
      },
    });
  } catch (error) {
    console.error("Error updating task:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the task.",
    });
  }
};

// DELETE /api/tasks/:id
// Deletes a task.
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({
        status: "error",
        message: "Task not found.",
      });
    }

    if (req.user.role === "admin") {
      await task.destroy();

      return res.json({
        status: "success",
        message: "Task deleted successfully.",
      });
    }

    if (req.user.role === "supervisor") {
      if (!task.projectId) {
        return res.status(403).json({
          status: "error",
          message: "Only admins can delete standalone tasks.",
        });
      }

      const canDeleteProjectTask = await canEditProjectLinkedWork(
        req.user,
        task.projectId,
      );

      if (!canDeleteProjectTask) {
        return res.status(403).json({
          status: "error",
          message:
            "Supervisors can only delete tasks for projects they supervise.",
        });
      }

      await task.destroy();

      return res.json({
        status: "success",
        message: "Task deleted successfully.",
      });
    }

    return res.status(403).json({
      status: "error",
      message: "Only admins and project supervisors can delete tasks.",
    });
  } catch (error) {
    console.error("Error deleting task", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the task.",
    });
  }
};

module.exports = { getTasks, getTaskById, createTask, updateTask, deleteTask };
