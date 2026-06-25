function formatUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    canCreateExperiments: user.canCreateExperiments,
    canEditExperiments: user.canEditExperiments,
    canCreateProtocols: user.canCreateProtocols,
    canEditProtocols: user.canEditProtocols,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isActive: user.isActive,
    deactivatedAt: user.deactivatedAt,
    deactivatedById: user.deactivatedById,
  };
}

module.exports = formatUserResponse;
