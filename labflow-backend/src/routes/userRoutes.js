const express = require("express");
const {
  getUsers,
  getUserById,
  updateUserRole,
  updateUserWorkflowPermissions,
  updateUserAccountStatus,
} = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES, ROLE_GROUPS } = require("../constants/roles");

const router = express.Router();

// Every user route requires authentication
router.use(protect);

// All authenticated lab users can view basic user summaries
// This supports assignment dropdowns for tasks, experiments, and project workflows
router.get("/", authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED), getUsers);
router.get(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  getUserById,
);

// Only admins can change user roles.
router.patch("/:id/role", authorizeRoles(ROLES.ADMIN), updateUserRole);

router.patch(
  "/:id/status",
  authorizeRoles(ROLES.ADMIN),
  updateUserAccountStatus,
);

// Only admins can customize researcher workflow permissions
router.patch(
  "/:id/permissions",
  authorizeRoles(ROLES.ADMIN),
  updateUserWorkflowPermissions,
);

module.exports = router;
