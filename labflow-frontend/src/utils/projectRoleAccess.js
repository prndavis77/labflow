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

    return Number(memberUserId) === Number(currentUser.id);
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
