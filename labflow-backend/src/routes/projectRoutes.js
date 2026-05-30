const express = require("express");
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLE_GROUPS, ROLES } = require("../constants/roles");

const router = express.Router();

// Every project route requires a valid logged-in user.
router.use(protect);

// All authenticated users can view projects for now.
router.get("/", protect, getProjects);
router.get("/:id", protect, getProjectById);

router.post(
  "/",
  protect,
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  createProject,
);
router.patch(
  "/:id",
  protect,
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  updateProject,
);
router.delete("/:id", protect, authorizeRoles(ROLES.ADMIN), deleteProject);

module.exports = router;
