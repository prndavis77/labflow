const express = require("express");
const {
  getNotebookEntries,
  getNotebookEntryById,
  createNotebookEntry,
  updateNotebookEntry,
  deleteNotebookEntry,
} = require("../controllers/notebookEntryController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES, ROLE_GROUPS } = require("../constants/roles");

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
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  createNotebookEntry,
);

// All authenticated roles can update entries
// The controller restricts researchers to their own entries
router.patch(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  updateNotebookEntry,
);

// All authenticated roles can delete entries.
// The controller restricts researchers to their own entries.
router.delete(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  deleteNotebookEntry,
);
module.exports = router;
