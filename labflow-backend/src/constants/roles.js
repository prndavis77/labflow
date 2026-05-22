// Central role constants used across backend authorization logic
// Keeping roles here helps prevent typos in route files
const ROLES = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  RESEARCHER: "researcher",
};

// Role groups used by route protection
const ROLE_GROUPS = {
  MANAGERS: [ROLES.ADMIN, ROLES.SUPERVISOR],
  ALL_AUTHENTICATED: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.RESEARCHER],
};

module.exports = { ROLES, ROLE_GROUPS };
