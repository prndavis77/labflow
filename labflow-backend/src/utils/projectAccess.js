const { ProjectMember, Project } = require("../models");

const PROJECT_MEMBER_ROLES = {
  LEAD: "lead",
  MEMBER: "member",
  VIEWER: "viewer",
};

const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
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

  return isProjectMember(user, projectId);
};

const canUseProjectForResearchWork = (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  return isProjectMember(user, projectId);
};

const getProjectMemberRole = async (user, projectId) => {
  if (!user || !projectId) {
    return null;
  }

  if (isAdminOrSupervisor(user)) {
    return null;
  }

  const membership = await ProjectMember.findOne({
    where: {
      userId: user.id,
      projectId,
    },
  });

  return membership?.projectRole || null;
};

const isProjectLead = async (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return projectRole === PROJECT_MEMBER_ROLES.LEAD;
};

const isProjectMember = async (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return Boolean(projectRole);
};

const canViewProjectLinkedRecord = async (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return Boolean(projectRole);
};

const canEditProjectLinkedWork = async (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return [PROJECT_MEMBER_ROLES.LEAD, PROJECT_MEMBER_ROLES.MEMBER].includes(
    projectRole,
  );
};

const canCreateProjectTask = async (user, projectId) => {
  return canEditProjectLinkedWork(user, projectId);
};

const canAssignProjectTask = async (user, projectId) => {
  if (!user || !projectId) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }
  const projectRole = await getProjectMemberRole(user, projectId);

  return projectRole === PROJECT_MEMBER_ROLES.LEAD;
};

const canManageProjectMembers = async (user, projectId) => {
  if (!user) {
    return false;
  }

  return isAdminOrSupervisor(user);
};

module.exports = {
  PROJECT_MEMBER_ROLES,
  isAdminOrSupervisor,
  isProjectMember,
  getProjectMembership,
  getAccessibleProjectIds,
  canViewProject,
  canUseProjectForResearchWork,
  getProjectMemberRole,
  isProjectLead,
  isProjectMember,
  canViewProjectLinkedRecord,
  canEditProjectLinkedWork,
  canCreateProjectTask,
  canAssignProjectTask,
  canManageProjectMembers,
};
