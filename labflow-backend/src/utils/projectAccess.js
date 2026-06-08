const { ProjectMember, Project } = require("../models");

const PROJECT_MEMBER_ROLES = {
  LEAD: "lead",
  MEMBER: "member",
  VIEWER: "viewer",
};

const isAdmin = (user) => {
  return user?.role === "admin";
};

const isSupervisor = (user) => {
  return user?.role === "supervisor";
};

const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
};

const canAccessProjectAsSupervisor = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
    return false;
  }

  if (!isSupervisor(user)) {
    return false;
  }

  const project = await Project.findByPk(projectId, {
    attributes: ["id", "supervisorId"],
  });

  if (!project) {
    return false;
  }

  return Number(project?.supervisorId) === Number(user.id);
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
  if (!user || !user.id) {
    return [];
  }

  if (isAdmin(user)) {
    const projects = await Project.findAll({
      attributes: ["id"],
    });

    return projects.map((project) => project.id);
  }

  if (isSupervisor(user)) {
    const projects = await Project.findAll({
      where: {
        supervisorId: user.id,
      },
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

const canViewProject = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (isSupervisor(user)) {
    return canAccessProjectAsSupervisor(user, projectId);
  }

  const membership = await ProjectMember.findOne({
    where: {
      userId: user.id,
      projectId,
    },
  });

  return Boolean(membership);
};

const getProjectMemberRole = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
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
  if (!user || !user.id || !projectId) {
    return false;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return projectRole === PROJECT_MEMBER_ROLES.LEAD;
};

const isProjectMember = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
    return false;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return Boolean(projectRole);
};

const canViewProjectLinkedRecord = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (isSupervisor(user)) {
    return canAccessProjectAsSupervisor(user, projectId);
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return Boolean(projectRole);
};

const canUseProjectForResearchWork = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "supervisor") {
    return canAccessProjectAsSupervisor(user, projectId);
  }

  return isProjectMember(user, projectId);
};

const canEditProjectLinkedWork = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (isSupervisor(user)) {
    return canAccessProjectAsSupervisor(user, projectId);
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
  if (!user || !user.id || !projectId) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "supervisor") {
    return canAccessProjectAsSupervisor(user, projectId);
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  return projectRole === PROJECT_MEMBER_ROLES.LEAD;
};

const canManageProjectMembers = async (user, projectId) => {
  if (!user || !user.id) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "supervisor") {
    return canAccessProjectAsSupervisor(user, projectId);
  }

  return false;
};

const canReviewProjectLinkedRecord = async (user, projectId) => {
  if (!user || !user.id || !projectId) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "supervisor") {
    return canAccessProjectAsSupervisor(user, projectId);
  }

  return false;
};

module.exports = {
  PROJECT_MEMBER_ROLES,
  isAdminOrSupervisor,
  canAccessProjectAsSupervisor,
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
  canReviewProjectLinkedRecord,
};
