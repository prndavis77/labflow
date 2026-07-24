const {
  Equipment,
  Experiment,
  NotebookEntry,
  Project,
  ProjectMember,
  Protocol,
  Task,
} = require("../models");

const {
  ATTACHMENT_ACCESS_ACTIONS,
  ATTACHMENT_ENTITY_TYPES,
} = require("../constants/attachments");

const normalizePositiveInteger = (value, fieldName) => {
  const normalizedValue = Number(value);

  if (!Number.isSafeInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizeEntityType = (entityType) => {
  const normalizedEntityType = String(entityType || "")
    .trim()
    .toLowerCase();

  if (!ATTACHMENT_ENTITY_TYPES.includes(normalizedEntityType)) {
    throw new Error("Invalid attachment entity type.");
  }

  return normalizedEntityType;
};

const normalizeAction = (action) => {
  const normalizedAction = String(action || "")
    .trim()
    .toLowerCase();

  if (!ATTACHMENT_ACCESS_ACTIONS.includes(normalizedAction)) {
    throw new Error("Invalid attachment access action.");
  }

  return normalizedAction;
};

const isAdministrator = (user) => {
  return user?.role === "admin";
};

const isSupervisor = (user) => {
  return user?.role === "supervisor";
};

const hasSameOrganization = (user, target) => {
  return Number(user?.organizationId) === Number(target?.organizationId);
};

const findProjectMembership = async ({ userId, projectId, transaction }) => {
  return ProjectMember.findOne({
    where: {
      userId,
      projectId,
    },
    transaction,
  });
};

const canViewProject = async ({ user, project, transaction }) => {
  if (!hasSameOrganization(user, project)) {
    return false;
  }

  if (isAdministrator(user)) {
    return true;
  }

  if (isSupervisor(user) && Number(project.supervisorId) === Number(user.id)) {
    return true;
  }

  const membership = await findProjectMembership({
    userId: user.id,
    projectId: project.id,
    transaction,
  });

  return Boolean(membership);
};

const canContributeToProject = async ({ user, project, transaction }) => {
  if (!hasSameOrganization(user, project)) {
    return false;
  }

  if (isAdministrator(user)) {
    return true;
  }

  if (isSupervisor(user) && Number(project.supervisorId) === Number(user.id)) {
    return true;
  }

  const membership = await findProjectMembership({
    userId: user.id,
    projectId: project.id,
    transaction,
  });

  if (!membership) {
    return false;
  }

  return membership.projectRole !== "viewer";
};

const authorizeProjectTarget = async ({
  user,
  target,
  action,
  transaction,
}) => {
  if (action === "view") {
    return canViewProject({
      user,
      project: target,
      transaction,
    });
  }

  return canContributeToProject({
    user,
    project: target,
    transaction,
  });
};

const authorizeExperimentTarget = async ({
  user,
  target,
  action,
  transaction,
}) => {
  if (!hasSameOrganization(user, target)) {
    return false;
  }

  if (isAdministrator(user)) {
    return true;
  }

  const project = await Project.findOne({
    where: {
      id: target.projectId,
      organizationId: user.organizationId,
    },
    transaction,
  });

  if (!project) {
    return false;
  }

  if (action === "view") {
    return canViewProject({
      user,
      project,
      transaction,
    });
  }

  const canContribute = await canContributeToProject({
    user,
    project,
    transaction,
  });

  if (!canContribute) {
    return false;
  }

  if (action === "upload" || action === "update") {
    if (isSupervisor(user)) {
      return true;
    }

    return Boolean(user.canEditExperiments);
  }

  if (action === "archive") {
    if (isSupervisor(user)) {
      return true;
    }

    return Boolean(user.canEditExperiments);
  }

  return false;
};

const authorizeProtocolTarget = async ({
  user,
  target,
  action,
  transaction,
}) => {
  if (!hasSameOrganization(user, target)) {
    return false;
  }

  if (isAdministrator(user)) {
    return true;
  }

  if (!target.projectId) {
    if (action === "view") {
      return true;
    }

    return isSupervisor(user);
  }

  const project = await Project.findOne({
    where: {
      id: target.projectId,
      organizationId: user.organizationId,
    },
    transaction,
  });

  if (!project) {
    return false;
  }

  if (action === "view") {
    return canViewProject({
      user,
      project,
      transaction,
    });
  }

  const canContribute = await canContributeToProject({
    user,
    project,
    transaction,
  });

  if (!canContribute) {
    return false;
  }

  if (isSupervisor(user)) {
    return true;
  }

  return Boolean(user.canEditProtocols);
};

const authorizeNotebookEntryTarget = async ({
  user,
  target,
  action,
  transaction,
}) => {
  if (!hasSameOrganization(user, target)) {
    return false;
  }

  if (isAdministrator(user)) {
    return true;
  }

  const experiment = await Experiment.findOne({
    where: {
      id: target.experimentId,
      organizationId: user.organizationId,
    },
    transaction,
  });

  if (!experiment) {
    return false;
  }

  if (action === "view") {
    return authorizeExperimentTarget({
      user,
      target: experiment,
      action: "view",
      transaction,
    });
  }

  if (isSupervisor(user)) {
    return true;
  }

  if (Number(target.userId) === Number(user.id)) {
    return Boolean(user.canEditExperiments);
  }

  return false;
};

const authorizeEquipmentTarget = ({ user, target, action }) => {
  if (!hasSameOrganization(user, target)) {
    return false;
  }

  if (action === "view") {
    return Boolean(user.isActive);
  }

  return isAdministrator(user) || isSupervisor(user);
};

const authorizeTaskTarget = async ({ user, target, action, transaction }) => {
  if (!hasSameOrganization(user, target)) {
    return false;
  }

  if (isAdministrator(user)) {
    return true;
  }

  if (Number(target.assignedToId) === Number(user.id)) {
    return true;
  }

  if (!target.projectId) {
    return isSupervisor(user);
  }

  const project = await Project.findOne({
    where: {
      id: target.projectId,
      organizationId: user.organizationId,
    },
    transaction,
  });

  if (!project) {
    return false;
  }

  if (action === "view") {
    return canViewProject({
      user,
      project,
      transaction,
    });
  }

  return canContributeToProject({
    user,
    project,
    transaction,
  });
};

const TARGET_MODELS = {
  experiment: Experiment,
  protocol: Protocol,
  project: Project,
  notebook_entry: NotebookEntry,
  equipment: Equipment,
  task: Task,
};

const TARGET_AUTHORIZERS = {
  experiment: authorizeExperimentTarget,
  protocol: authorizeProtocolTarget,
  project: authorizeProjectTarget,
  notebook_entry: authorizeNotebookEntryTarget,
  equipment: authorizeEquipmentTarget,
  task: authorizeTaskTarget,
};

const authorizeAttachmentTarget = async ({
  user,
  entityType,
  entityId,
  action,
  transaction,
}) => {
  if (!user?.id || !user?.organizationId) {
    return {
      allowed: false,
      reason: "unauthenticated",
    };
  }

  if (user.isActive === false) {
    return {
      allowed: false,
      reason: "inactive_user",
    };
  }

  const normalizedEntityType = normalizeEntityType(entityType);

  const normalizedEntityId = normalizePositiveInteger(entityId, "Entity ID");

  const normalizedAction = normalizeAction(action);

  const TargetModel = TARGET_MODELS[normalizedEntityType];

  const target = await TargetModel.findOne({
    where: {
      id: normalizedEntityId,
      organizationId: user.organizationId,
    },
    transaction,
  });

  if (!target) {
    return {
      allowed: false,
      reason: "not_found",
    };
  }

  const authorizeTarget = TARGET_AUTHORIZERS[normalizedEntityType];

  const allowed = await authorizeTarget({
    user,
    target,
    action: normalizedAction,
    transaction,
  });

  if (!allowed) {
    return {
      allowed: false,
      reason: "forbidden",
    };
  }

  return {
    allowed: true,
    target,
  };
};

module.exports = {
  authorizeAttachmentTarget,
};
