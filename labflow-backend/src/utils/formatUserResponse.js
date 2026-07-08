const formatUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  organizationId: user.organizationId,
  organization: user.organization
    ? {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        type: user.organization.type,
      }
    : null,
  isActive: user.isActive,
  canCreateExperiments: user.canCreateExperiments,
  canEditExperiments: user.canEditExperiments,
  canCreateProtocols: user.canCreateProtocols,
  canEditProtocols: user.canEditProtocols,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

module.exports = formatUserResponse;
