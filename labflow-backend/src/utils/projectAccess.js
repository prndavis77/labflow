const { ProjectMember, Project } = require("../models");

const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
};

const isProjectMember = async (userId, projectId) => {
  if (!userId || !projectId) {
    return false;
  }

  const membership = await ProjectMember.findOne({
    where: { userId, projectId },
  });

  return Boolean(membership);
};

const getProjectMembership = async (userId, projectId) => {
  if (!userId || !projectId) {
    return null;
  }

  return ProjectMember.findOne({
    where: { userId, projectId },
  });
};

const getAccessibleProjectIds = async (user) => {
  if (!user) {
    return [];
  }
  if (isAdminOrSupervisor(user)) {
    const projects = await Project.findAll({
      attributes: ["id"],
    });

    return projects.map((project) => project.id);
  }

  const memberships = await ProjectMember.findAll({
    where: { userId: user.id },
    attributes: ["projectId"],
  });

  return memberships.map((membership) => membership.projectId);
};

const canViewProject = (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  return isProjectMember(user.id, projectId);
};

const canUseProjectForResearchWork = (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  return isProjectMember(user.id, projectId);
};

module.exports = {
  isAdminOrSupervisor,
  isProjectMember,
  getProjectMembership,
  getAccessibleProjectIds,
  canViewProject,
  canUseProjectForResearchWork,
};
