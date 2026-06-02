const express = require("express");
const {
  getExperiments,
  getExperimentById,
  createExperiment,
  updateExperiment,
  deleteExperiment,
} = require("../controllers/experimentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES, ROLE_GROUPS } = require("../constants/roles");

const router = express.Router();

// Every experiment route requires a logged-in user
router.use(protect);

// All authenticated users can view experiments for now
router.get("/", getExperiments);
router.get("/:id", getExperimentById);

// All roles can create and update experiments for now
// This is practical because researchers need to record their own experiment work
router.post(
  "/",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  createExperiment,
);
router.patch(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  updateExperiment,
);

// Only admins and supervisors can delete experiments for now
router.delete(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  deleteExperiment,
);

module.exports = router;
