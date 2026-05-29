const { Project, User } = require("../models");
const {
  isValidDateOnly,
  isEndDateAfterStartDate,
} = require("../utils/dateUtils");

// This helper formats project objects before sending them to the frontend
// It avoids exposing unnecessary Sequelize metadata
const formatProjectResponse = (project) => {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    supervisorId: project.supervisorId,
    supervisor: project.supervisor
      ? {
          id: project.supervisor.id,
          name: project.supervisor.name,
          email: project.supervisor.email,
          role: project.supervisor.role,
          department: project.supervisor.department,
        }
      : null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
};

// GET /api/projects
// Returns all projects for now
// Later, we will filter by lab membership and project membership
const getProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      status: "success",
      data: {
        projects: projects.map(formatProjectResponse),
      },
    });
  } catch (error) {
    console.error("Error fetching projects:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching projects.",
    });
  }
};

// GET /api/projects/:id
// Returns one project by ID
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        project: formatProjectResponse(project),
      },
    });
  } catch (error) {
    console.error("Error fetching project:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the project.",
    });
  }
};

// POST /api/projects
// Creates a new project
// For now, admins and supervisors can create projects
const createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      startDate,
      targetEndDate,
      supervisorId,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Project title is required.",
      });
    }

    // Validate project dates before writing to the database
    if (!isValidDateOnly(startDate) || !isValidDateOnly(targetEndDate)) {
      return res.status(400).json({
        status: "error",
        message: "Project dates must use YYYY-MM-DD format.",
      });
    }

    if (!isEndDateAfterStartDate(startDate, targetEndDate)) {
      return res.status(400).json({
        status: "error",
        message: "Target end date must be after or equal to start date.",
      });
    }

    // If no supervisorId is provided, use the logged-in user as the supervisor
    // This is convenient for supervisors creating their own projects
    const resolvedSupervisorId = supervisorId || req.user.id;

    const supervisor = await User.findByPk(resolvedSupervisorId);

    if (!supervisor) {
      return res.status(404).json({
        status: "error",
        message: "Supervisor not found.",
      });
    }

    if (!["admin", "supervisor"].includes(req.user.role)) {
      return res.status(400).json({
        status: "error",
        message: "Project supervisor must be an admin or supervisor.",
      });
    }

    const project = await Project.create({
      title: title.trim(),
      description: description ? description.trim() : null,
      status: status || "planning",
      startDate: startDate || null,
      targetEndDate: targetEndDate || null,
      supervisorId: resolvedSupervisorId,
    });

    const createdProject = await Project.findByPk(project.id, {
      include: [
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
    });

    return res.status(201).json({
      status: "success",
      data: {
        project: formatProjectResponse(createdProject),
      },
    });
  } catch (error) {
    console.error("Error creating project:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the project.",
    });
  }
};

// PATCH /api/projects/:id
// Updates a project
// For now, admins and supervisors can update projects
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      startDate,
      targetEndDate,
      supervisorId,
    } = req.body;

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    if (supervisorId) {
      const supervisor = await User.findByPk(supervisorId);

      if (!supervisor) {
        return res.status(404).json({
          status: "error",
          message: "Supervisor not found.",
        });
      }

      if (!["admin", "supervisor"].includes(supervisor.role)) {
        return res.status(400).json({
          status: "error",
          message: "Project supervisor must be an admin or supervisor.",
        });
      }
    }

    // Validate updated project dates before writing to the database
    const nextStartDate =
      startDate !== undefined ? startDate || null : project.startDate;

    const nextTargetEndDate =
      targetEndDate !== undefined
        ? targetEndDate || null
        : project.targetEndDate;

    if (
      !isValidDateOnly(nextStartDate) ||
      !isValidDateOnly(nextTargetEndDate)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Project dates must use YYYY-MM-DD format.",
      });
    }

    if (!isEndDateAfterStartDate(nextStartDate, nextTargetEndDate)) {
      return res.status(400).json({
        status: "error",
        message: "Target end date must be after or equal to start date.",
      });
    }

    await project.update({
      title: title !== undefined ? title.trim() : project.title,
      description:
        description !== undefined
          ? description.trim() || null
          : project.description,
      status: status !== undefined ? status : project.status,
      startDate: nextStartDate,
      targetEndDate: nextTargetEndDate,
      supervisorId:
        supervisorId !== undefined ? supervisorId : project.supervisorId,
    });

    const updatedProject = await Project.findByPk(project.id, {
      include: [
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "name", "email", "role", "department"],
        },
      ],
    });

    return res.json({
      status: "success",
      message: "Project updated successfully.",
      data: {
        project: formatProjectResponse(updatedProject),
      },
    });
  } catch (error) {
    console.error("Error updating project:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the project.",
    });
  }
};

// DELETE /api/projects/:id
// Deletes a project.
// In a real production app, soft delete or archive is often safer.
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    await project.destroy();

    return res.json({
      status: "success",
      message: "Project deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting project:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the project.",
    });
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};
