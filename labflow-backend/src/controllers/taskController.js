const { Task, Project, User } = require("../models");
const { canUseProjectForResearchWork } = require("../utils/projectAccess");
const {
  isValidDateOnly,
  isEndDateAfterStartDate,
} = require("../utils/dateUtils");

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

    const tasks = await Task.findAll({
      where,
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

    if (!title || !projectId) {
      return res.status(400).json({
        status: "error",
        message: "Task title and project are required.",
      });
    }

    const project = await Project.findByPk(projectId);

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
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

    const canUseProject = await canUseProjectForResearchWork(
      req.user,
      projectId,
    );

    if (!canUseProject) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to create tasks for this project.",
      });
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || null,
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null,
      projectId,
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

    if (
      projectId !== undefined &&
      Number(projectId) !== Number(task.projectId)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Task project cannot be changed after creation.",
      });
    }

    const resolvedProjectId = task.projectId;

    const canUseProject = await canUseProjectForResearchWork(
      req.user,
      resolvedProjectId,
    );

    if (!canUseProject) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to update tasks for this project.",
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
