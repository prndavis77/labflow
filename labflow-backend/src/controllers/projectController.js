const {
  Project,
  User,
  Task,
  Experiment,
  Protocol,
  EquipmentBooking,
  NotebookEntry,
  ProjectMember,
} = require("../models");

const { Op } = require("sequelize");

const { writeAuditLog } = require("../utils/auditLogger");

const {
  getAccessibleProjectIds,
  canViewProject,
} = require("../utils/projectAccess");

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

const projectInclude = [
  {
    model: User,
    as: "supervisor",
    attributes: ["id", "name", "email", "role", "department"],
  },
];

// Validates that the selected project supervisor exists and has a role that is allowed to supervise projects
const validateProjectSupervisor = async (supervisorId, organizationId) => {
  const supervisor = await User.findOne({
    where: {
      id: supervisorId,
      organizationId,
    },
  });

  const validateProjectSupervisor = async (supervisorId, organizationId) => {
    const supervisor = await User.findOne({
      where: {
        id: supervisorId,
        organizationId,
      },
    });

    if (!supervisor) {
      return {
        isValid: false,
        statusCode: 404,
        message: "Project supervisor not found.",
      };
    }

    if (!["admin", "supervisor"].includes(supervisor.role)) {
      return {
        isValid: false,
        statusCode: 400,
        message: "Project supervisor must be an admin or supervisor.",
      };
    }

    return {
      isValid: true,
      supervisor,
    };
  };

  return {
    isValid: true,
    supervisor,
  };
};

// GET /api/projects
// Returns all projects for now
// Later, we will filter by lab membership and project membership
const getProjects = async (req, res) => {
  try {
    const { status, supervisorId } = req.query;

    const where = {
      organizationId: req.user.organizationId,
      isArchived: false,
    };

    if (status) {
      where.status = status;
    }

    if (supervisorId) {
      where.supervisorId = Number(supervisorId);
    }

    if (req.user.role !== "admin") {
      const accessibleProjectIds = await getAccessibleProjectIds(req.user);

      where.id = {
        [Op.in]: accessibleProjectIds,
      };
    }

    const projects = await Project.findAll({
      where,
      include: projectInclude,
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

    const project = await Project.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
        isArchived: false,
      },
      include: projectInclude,
    });

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    const hasAccess = await canViewProject(req.user, project.id);

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to this project.",
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

    if (!title?.trim()) {
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
    const resolvedSupervisorId = supervisorId || req.user.id;

    const supervisorValidation = await validateProjectSupervisor(
      resolvedSupervisorId,
      req.user.organizationId,
    );

    if (!supervisorValidation.isValid) {
      return res.status(supervisorValidation.statusCode).json({
        status: "error",
        message: supervisorValidation.message,
      });
    }

    const project = await Project.create({
      title: title.trim(),
      description: description ? description.trim() : null,
      status: status || "planning",
      startDate: startDate || null,
      targetEndDate: targetEndDate || null,
      supervisorId: resolvedSupervisorId,
      organizationId: req.user.organizationId,
    });

    const createdProject = await Project.findOne({
      where: {
        id: project.id,
        organizationId: req.user.organizationId,
      },
      include: projectInclude,
    });

    return res.status(201).json({
      status: "success",
      message: "Project created successfully.",
      data: {
        project: formatProjectResponse(createdProject),
      },
    });
  } catch (error) {
    console.error("Error creating project", error);

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

    const project = await Project.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    if (title !== undefined && !title?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Project title cannot be empty.",
      });
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

    let resolvedSupervisorId = project.supervisorId;

    if (supervisorId !== undefined) {
      if (!supervisorId) {
        return res.status(400).json({
          status: "error",
          message: "Project supervisor is required.",
        });
      }

      const supervisorValidation = await validateProjectSupervisor(
        resolvedSupervisorId,
        req.user.organizationId,
      );

      if (!supervisorValidation.isValid) {
        return res.status(supervisorValidation.statusCode).json({
          status: "error",
          message: supervisorValidation.message,
        });
      }

      resolvedSupervisorId = supervisorId;
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
      supervisorId: resolvedSupervisorId,
    });

    const updatedProject = await Project.findOne({
      where: {
        id: project.id,
        organizationId: req.user.organizationId,
      },
      include: projectInclude,
    });

    return res.json({
      status: "success",
      message: "Project updated successfully.",
      data: {
        project: formatProjectResponse(updatedProject),
      },
    });
  } catch (error) {
    console.error("Error updating project", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the project.",
    });
  }
};

// DELETE /api/projects/:id
// Archives a project.
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    if (project.isArchived) {
      return res.status(400).json({
        status: "error",
        message: "Project is already archived.",
      });
    }

    if (req.user.role === "admin") {
      // Admins can archive any project.
    } else if (req.user.role === "supervisor") {
      if (project.supervisorId !== req.user.id) {
        return res.status(403).json({
          status: "error",
          message: "Supervisors can only archive projects they supervise.",
        });
      }
    } else {
      return res.status(403).json({
        status: "error",
        message: "Only admins and project supervisors can archive projects.",
      });
    }

    const archiveReason =
      req.body?.archiveReason?.trim() || req.body?.reason?.trim() || null;

    await project.update({
      isArchived: true,
      archivedAt: new Date(),
      archivedById: req.user.id,
      archiveReason,
    });

    await writeAuditLog({
      req,
      action: "project.archived",
      entityType: "project",
      entityId: project.id,
      targetUserId: project.supervisorId || null,
      summary: `${req.user.name} archived project "${project.title}".`,
      metadata: {
        supervisorId: project.supervisorId,
        status: project.status,
        archiveReason,
      },
    });

    return res.json({
      status: "success",
      message: "Project archived successfully.",
    });
  } catch (error) {
    console.error("Error archiving project:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while archiving the project.",
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
