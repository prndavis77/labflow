export const PROJECT_MEMBER_ROLES = {
  LEAD: "lead",
  MEMBER: "member",
  VIEWER: "viewer",
};

export const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
};

export const getCurrentUserProjectRole = (
  projectMembers,
  currentUser,
  projectId,
) => {
  if (!Array.isArray(projectMembers) || !currentUser?.id) {
    return null;
  }

  const membership = projectMembers.find((member) => {
    const memberUserId = member.userId ?? member.user?.id;
    const memberProjectId = member.projectId ?? member.project?.id;

    const userMatches = Number(memberUserId) === Number(currentUser.id);

    const projectMatches =
      projectId === undefined ||
      projectId === null ||
      memberProjectId === undefined ||
      memberProjectId === null ||
      Number(memberProjectId) === Number(projectId);

    return userMatches && projectMatches;
  });

  return membership?.projectRole || null;
};

export const canEditProjectLinkedWork = (currentUser, projectRole) => {
  if (isAdminOrSupervisor(currentUser)) {
    return true;
  }

  return [PROJECT_MEMBER_ROLES.LEAD, PROJECT_MEMBER_ROLES.MEMBER].includes(
    projectRole,
  );
};

export const canViewProjectLinkedWork = (currentUser, projectRole) => {
  if (isAdminOrSupervisor(currentUser)) {
    return true;
  }

  return Boolean(projectRole);
};

export const canAssignProjectTask = (currentUser, projectRole) => {
  if (isAdminOrSupervisor(currentUser)) {
    return true;
  }

  return projectRole === PROJECT_MEMBER_ROLES.LEAD;
};

export const canManageProjectMembers = (currentUser) => {
  return isAdminOrSupervisor(currentUser);
};

export const canEditProjectTaskRecord = ({
  currentUser,
  projectRole,
  task,
}) => {
  if (!currentUser || !task) {
    return false;
  }

  if (isAdminOrSupervisor(currentUser)) {
    return true;
  }

  if (projectRole === PROJECT_MEMBER_ROLES.LEAD) {
    return true;
  }

  if (projectRole === PROJECT_MEMBER_ROLES.MEMBER) {
    return Number(task.assignedToId) === Number(currentUser.id);
  }

  return false;
};
