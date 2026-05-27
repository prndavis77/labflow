const express = require("express");
const {
  getNotebookEntries,
  getNotebookEntryById,
  createNotebookEntry,
  updateNotebookEntry,
  deleteNotebookEntry,
} = require("../controllers/notebookEntryController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Every notebook entry route requires a logged-in user
router.use(protect);

// All authenticated users can view notebook entries for now
router.get("/", getNotebookEntries);
router.get("/:id", getNotebookEntryById);

// All authenticated roles can create notebook entries
// Notebook entries are part of normal experiment documentation
router.post(
  "/",
  authorizeRoles("admin", "researcher", "supervisor", "lab_manager"),
  createNotebookEntry,
);

// All authenticated roles can update entries
// The controller restricts researchers to their own entries
router.patch(
  "/:id",
  authorizeRoles("admin", "supervisor", "researcher"),
  updateNotebookEntry,
);

// All authenticated roles can delete entries.
// The controller restricts researchers to their own entries.
router.delete(
  "/:id",
  authorizeRoles("admin", "researcher", "supervisor", "lab_manager"),
  deleteNotebookEntry,
);
module.exports = router;
