const express = require("express");
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLE_GROUPS } = require("../constants/roles");

const router = express.Router();

// Every task route requires a logged-in user
router.use(protect);

// All authenticated users can view tasks for now
router.get("/", getTasks);
router.get("/:id", getTaskById);

// Admins, supervisors, and researchers can create and update tasks
// This is practical for lab work because researchers often manage their own tasks
router.post("/", authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED), createTask);
router.patch(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  updateTask,
);

// Only admins and supervisors can delete tasks for now.
router.delete("/:id", authorizeRoles(...ROLE_GROUPS.MANAGERS), deleteTask);

module.exports = router;
