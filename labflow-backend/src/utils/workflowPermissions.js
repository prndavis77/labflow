// Admins and supervisors have full workflow access by role.
// Researchers depend on their configurable permission flags.

const canCreateExperiment = (user) => {
  if (!user) {
    return false;
  }

  if (["admin", "supervisor"].includes(user.role)) {
    return true;
  }

  return Boolean(user.canCreateExperiments);
};

const canEditExperiment = (user) => {
  if (!user) {
    return false;
  }

  if (["admin", "supervisor"].includes(user.role)) {
    return true;
  }

  return Boolean(user.canEditExperiments);
};

const canCreateProtocol = (user) => {
  if (!user) {
    return false;
  }

  if (["admin", "supervisor"].includes(user.role)) {
    return true;
  }

  return Boolean(user.canCreateProtocols);
};

const canEditProtocol = (user) => {
  if (!user) {
    return false;
  }

  if (["admin", "supervisor"].includes(user.role)) {
    return true;
  }

  return Boolean(user.canEditProtocols);
};

module.exports = {
  canCreateExperiment,
  canEditExperiment,
  canCreateProtocol,
  canEditProtocol,
};
