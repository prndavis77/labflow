const express = require("express");
const {
  getProjectMembers,
  getProjectMemberById,
  createProjectMember,
  updateProjectMember,
  deleteProjectMember,
} = require("../controllers/projectMemberController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES, ROLE_GROUPS } = require("../constants/roles");

const router = express.Router();

router.use(protect);

// For now, all authenticated users can read project memberships
// Later we can restrict this based on project membership and role
router.get(
  "/",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  getProjectMembers,
);

router.get(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  getProjectMemberById,
);

// Only admins and supervisors can manage project membership for now
router.post("/", authorizeRoles(...ROLE_GROUPS.MANAGERS), createProjectMember);

router.patch(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  updateProjectMember,
);

// Only admins can delete project membership
router.delete(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  deleteProjectMember,
);

module.exports = router;
