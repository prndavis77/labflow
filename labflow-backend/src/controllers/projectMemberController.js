const { ProjectMember, Project, User } = require("../models");
const {
  getAccessibleProjectIds,
  canViewProject,
} = require("../utils/projectAccess");
const { Op } = require("sequelize");
const { logError } = require("../utils/errorLogger");

const VALID_PROJECT_ROLES = ["lead", "member", "viewer"];

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

const formatProjectSummary = (project) => {
  if (!project) {
    return null;
  }

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    supervisorId: project.supervisorId,
  };
};

const formatProjectMemberResponse = (projectMember) => {
  return {
    id: projectMember.id,
    projectId: projectMember.projectId,
    userId: projectMember.userId,
    projectRole: projectMember.projectRole,
    project: formatProjectSummary(projectMember.project),
    user: formatUserSummary(projectMember.user),
    createdAt: projectMember.createdAt,
    updatedAt: projectMember.updatedAt,
  };
};

const projectMemberInclude = [
  {
    model: Project,
    as: "project",
    attributes: ["id", "title", "status", "supervisorId"],
  },
  {
    model: User,
    as: "user",
    attributes: ["id", "name", "email", "role", "department"],
  },
];

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

// GET /api/project-members
// Optional filters: projectId, userId, projectRole.
const getProjectMembers = async (req, res) => {
  try {
    const { projectId, userId, projectRole } = req.query;

    let parsedProjectId = null;
    let parsedUserId = null;

    if (projectId !== undefined) {
      parsedProjectId = parsePositiveIntegerId(projectId);

      if (parsedProjectId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid project ID.",
        });
      }
    }

    if (userId !== undefined) {
      parsedUserId = parsePositiveIntegerId(userId);

      if (parsedUserId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid user ID.",
        });
      }
    }

    if (
      projectRole !== undefined &&
      !VALID_PROJECT_ROLES.includes(projectRole)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid project role.",
      });
    }

    const where = { organizationId: req.user.organizationId };

    if (parsedProjectId !== null) {
      where.projectId = parsedProjectId;
    }

    if (parsedUserId !== null) {
      where.userId = parsedUserId;
    }

    if (projectRole !== undefined) {
      where.projectRole = projectRole;
    }

    if (req.user.role === "researcher") {
      const accessibleProjectIds = await getAccessibleProjectIds(req.user);

      if (accessibleProjectIds.length === 0) {
        return res.json({
          status: "success",
          data: {
            projectMembers: [],
          },
        });
      }

      if (parsedProjectId !== null) {
        if (!accessibleProjectIds.map(Number).includes(parsedProjectId)) {
          return res.status(403).json({
            status: "error",
            message: "You do not have access to this project's memberships.",
          });
        }
      }

      if (parsedProjectId !== null) {
        where.projectId = parsedProjectId;
      } else {
        where.projectId = {
          [Op.in]: accessibleProjectIds,
        };
      }
    }

    const projectMembers = await ProjectMember.findAll({
      where,
      include: projectMemberInclude,
      order: [
        ["projectId", "ASC"],
        ["projectRole", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    return res.json({
      status: "success",
      data: {
        projectMembers: projectMembers.map(formatProjectMemberResponse),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "project_member_list_failed",
      message: "Failed to fetch project members",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching project members.",
    });
  }
};

// GET /api/project-members/:id
const getProjectMemberById = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid project member ID.",
      });
    }

    const projectMember = await ProjectMember.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
      include: projectMemberInclude,
    });

    if (!projectMember) {
      return res.status(404).json({
        status: "error",
        message: "Project member not found.",
      });
    }

    const hasAccess = await canViewProject(req.user, projectMember.projectId);

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "You do not have access to this project membership.",
      });
    }

    return res.json({
      status: "success",
      data: {
        projectMember: formatProjectMemberResponse(projectMember),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "project_member_load_failed",
      message: "Failed to fetch project member",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the project member.",
    });
  }
};

// POST /api/project-members
// Adds a user to a project with a specific role (lead, member, viewer)
const createProjectMember = async (req, res) => {
  try {
    const {
      projectId: rawProjectId,
      userId: rawUserId,
      projectRole = "member",
    } = req.body;

    const projectId = parsePositiveIntegerBodyId(rawProjectId);
    const userId = parsePositiveIntegerBodyId(rawUserId);

    if (projectId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid project ID.",
      });
    }

    if (userId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user ID.",
      });
    }

    if (typeof projectRole !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Project role must be a string.",
      });
    }

    if (!VALID_PROJECT_ROLES.includes(projectRole)) {
      return res.status(400).json({
        status: "error",
        message: "Project role must be lead, member, or viewer.",
      });
    }

    const project = await Project.findOne({
      where: {
        id: projectId,
        organizationId: req.user.organizationId,
        isArchived: false,
      },
    });

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    if (
      req.user.role === "supervisor" &&
      project.supervisorId !== req.user.id
    ) {
      return res.status(403).json({
        status: "error",
        message:
          "You do not have permission to manage this project's membership.",
      });
    }

    const user = await User.findOne({
      where: {
        id: userId,
        organizationId: req.user.organizationId,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    const existingMembership = await ProjectMember.findOne({
      where: {
        projectId,
        userId,
        organizationId: req.user.organizationId,
      },
    });

    if (existingMembership) {
      return res.status(409).json({
        status: "error",
        message: "This user is already a member of this project.",
      });
    }

    const projectMember = await ProjectMember.create({
      projectId,
      userId,
      projectRole,
      organizationId: req.user.organizationId,
    });

    const createdProjectMember = await ProjectMember.findOne({
      where: {
        id: projectMember.id,
        organizationId: req.user.organizationId,
      },
      include: projectMemberInclude,
    });

    return res.status(201).json({
      status: "success",
      message: "Project member added successfully.",
      data: {
        projectMember: formatProjectMemberResponse(createdProjectMember),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "project_member_create_failed",
      message: "Failed to create project member",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while adding the project member.",
    });
  }
};

// PATCH /api/project-members/:id
// Updates a project member's project-specific role
const updateProjectMember = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid project member ID.",
      });
    }

    const { projectRole } = req.body;

    if (!projectRole) {
      return res.status(400).json({
        status: "error",
        message: "Project role is required.",
      });
    }

    if (typeof projectRole !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Project role must be a string.",
      });
    }

    if (!VALID_PROJECT_ROLES.includes(projectRole)) {
      return res.status(400).json({
        status: "error",
        message: "Project role must be lead, member, or viewer.",
      });
    }

    const projectMember = await ProjectMember.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!projectMember) {
      return res.status(404).json({
        status: "error",
        message: "Project member not found.",
      });
    }

    if (req.user.role === "supervisor") {
      const project = await Project.findOne({
        where: {
          id: projectMember.projectId,
          organizationId: req.user.organizationId,
          supervisorId: req.user.id,
          isArchived: false,
        },
      });

      if (!project) {
        return res.status(403).json({
          status: "error",
          message:
            "You do not have permission to manage this project's membership.",
        });
      }
    }

    await projectMember.update({
      projectRole,
    });

    const updatedProjectMember = await ProjectMember.findOne({
      where: {
        id: projectMember.id,
        organizationId: req.user.organizationId,
      },
      include: projectMemberInclude,
    });

    return res.json({
      status: "success",
      message: "Project member updated successfully.",
      data: {
        projectMember: formatProjectMemberResponse(updatedProjectMember),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "project_member_update_failed",
      message: "Failed to update project member",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the project member.",
    });
  }
};

// DELETE /api/project-members/:id
// Removes a user from a project
const deleteProjectMember = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid project member ID.",
      });
    }

    const projectMember = await ProjectMember.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!projectMember) {
      return res.status(404).json({
        status: "error",
        message: "Project member not found.",
      });
    }

    if (req.user.role === "supervisor") {
      const project = await Project.findOne({
        where: {
          id: projectMember.projectId,
          organizationId: req.user.organizationId,
          supervisorId: req.user.id,
          isArchived: false,
        },
      });

      if (!project) {
        return res.status(403).json({
          status: "error",
          message:
            "You do not have permission to manage this project's membership.",
        });
      }
    }

    await projectMember.destroy();

    return res.json({
      status: "success",
      message: "Project member removed successfully.",
    });
  } catch (error) {
    logError(error, {
      req,
      event: "project_member_delete_failed",
      message: "Failed to delete project member",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the project member.",
    });
  }
};

module.exports = {
  getProjectMembers,
  getProjectMemberById,
  createProjectMember,
  updateProjectMember,
  deleteProjectMember,
};
