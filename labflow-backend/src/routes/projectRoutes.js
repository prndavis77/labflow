const express = require("express");
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");
const {
  protect,
  requireVerifiedEmail,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const { ROLE_GROUPS, ROLES } = require("../constants/roles");

const router = express.Router();

// Every project route requires a valid logged-in user.
router.use(protect);

router.use(requireVerifiedEmail);

// All authenticated users can view projects for now.
router.get("/", getProjects);
router.get("/:id", getProjectById);

router.post(
  "/",
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  createProject,
);
router.patch(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  updateProject,
);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteProject);

module.exports = router;
