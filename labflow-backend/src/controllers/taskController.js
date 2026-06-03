const { Task, Project, User } = require("../models");
const { getAccessibleProjectIds } = require("../utils/projectAccess");
const { canUseProjectForResearchWork } = require("../utils/projectAccess");
const {
  isValidDateOnly,
  isEndDateAfterStartDate,
} = require("../utils/dateUtils");
const { Op } = require("sequelize");

const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
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

const canCreateTaskForPayload = async (user, projectId, assignedToId) => {
  if (!user) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  if (projectId) {
    return canUseProjectForResearchWork(user, projectId);
  }

  return Number(assignedToId) === Number(user.id);
};

const canUpdateTask = async (user, task) => {
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

    if (req.user.role === "researcher") {
      const accessibleProjectIds = await getAccessibleProjectIds(req.user);

      where[Op.or] = [
        {
          assignedToId: req.user.id,
        },
        {
          projectId: {
            [Op.in]: accessibleProjectIds,
          },
        },
      ];
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

    if (projectId) {
      const project = await Project.findByPk(projectId);

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
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
    }

    const canCreateTask = await canCreateTaskForPayload(
      req.user,
      projectId,
      assignedToId,
    );

    if (!canCreateTask) {
      return res.status(403).json({
        status: "error",
        message:
          "You do not have permission to create this task. Researchers can create tasks for member projects or tasks assigned to themselves.",
      });
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || null,
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null,
      projectId: projectId || null,
      assignedToId: assignedToId || null,
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

    const currentProjectId = normalizeOptionalId(task.projectId);
    const requestedProjectId = normalizeOptionalId(projectId);

    if (projectId !== undefined && requestedProjectId !== currentProjectId) {
      return res.status(400).json({
        status: "error",
        message: "Task project cannot be changed after creation.",
      });
    }

    const canUpdate = await canUpdateTask(req.user, task);

    if (!canUpdate) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to update this task.",
      });
    }

    if (assignedToId !== undefined && !isAdminOrSupervisor) {
      return res.status(403).json({
        status: "error",
        message: "Only admins and supervisors can change task assignment.",
      });
    }

    if (assignedToId) {
      const assignedUser = await User.findByPk(assignedToId);

      if (!assignedUser) {
        return res.status(404).json({
          status: "error",
          message: "Assigned user not found.",
        });
      }
    }

    const isAdminOrSupervisor = ["admin", "supervisor"].includes(req.user.role);

    if (status === "done" && !isAdminOrSupervisor) {
      return res.status(403).json({
        status: "error",
        message: "Only admins and supervisors can mark tasks as done.",
      });
    }

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
// Later, we may replace this with archiving if we want better audit history.
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

    await task.destroy();

    return res.json({
      status: "success",
      message: "Task deleted successfully.",
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
