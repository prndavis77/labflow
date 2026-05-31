const { ProjectMember, Project, User } = require("../models");

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

// GET /api/project-members
// Optional filters: projectId, userId, projectRole.
const getProjectMembers = async (req, res) => {
  try {
    const { projectId, userId, projectRole } = req.query;

    const where = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (projectRole) {
      where.projectRole = projectRole;
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
    console.error("Error fetching project members:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching project members.",
    });
  }
};

// GET /api/project-members/:id
const getProjectMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    const projectMember = await ProjectMember.findByPk(id, {
      include: projectMemberInclude,
    });

    if (!projectMember) {
      return res.status(404).json({
        status: "error",
        message: "Project member not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        projectMember: formatProjectMemberResponse(projectMember),
      },
    });
  } catch (error) {
    console.error("Error fetching project member by ID:", error);

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
    const { projectId, userId, projectRole = "member" } = req.body;

    if (!projectId || !userId) {
      return res.status(400).json({
        status: "error",
        message: "Project ID and user ID are required.",
      });
    }

    if (!VALID_PROJECT_ROLES.includes(projectRole)) {
      return res.status(400).json({
        status: "error",
        message: "Project role must be lead, member, or viewer.",
      });
    }

    const project = await Project.findByPk(projectId);

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found.",
      });
    }

    const user = await User.findByPk(userId);

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
    });

    const createdProjectMember = await ProjectMember.findByPk(
      projectMember.id,
      {
        include: projectMemberInclude,
      },
    );

    return res.status(201).json({
      status: "success",
      message: "Project member added successfully.",
      data: {
        projectMember: formatProjectMemberResponse(createdProjectMember),
      },
    });
  } catch (error) {
    console.error("Error creating project member:", error);

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
    const { id } = req.params;
    const { projectRole } = req.body;

    if (!projectRole) {
      return res.status(400).json({
        status: "error",
        message: "Project role is required.",
      });
    }

    if (!VALID_PROJECT_ROLES.includes(projectRole)) {
      return res.status(400).json({
        status: "error",
        message: "Project role must be lead, member, or viewer.",
      });
    }

    const projectMember = await ProjectMember.findByPk(id);

    if (!projectMember) {
      return res.status(404).json({
        status: "error",
        message: "Project member not found.",
      });
    }

    await projectMember.update({
      projectRole,
    });

    const updatedProjectMember = await ProjectMember.findByPk(
      projectMember.id,
      {
        include: projectMemberInclude,
      },
    );

    return res.json({
      status: "success",
      message: "Project member updated successfully.",
      data: {
        projectMember: formatProjectMemberResponse(updatedProjectMember),
      },
    });
  } catch (error) {
    console.error("Error updating project member:", error);

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
    const { id } = req.params;

    const projectMember = await ProjectMember.findByPk(id);

    if (!projectMember) {
      return res.status(404).json({
        status: "error",
        message: "Project member not found.",
      });
    }

    await projectMember.destroy();

    return res.json({
      status: "success",
      message: "Project member removed successfully.",
    });
  } catch (error) {
    console.error("Error deleting project member:", error);

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
