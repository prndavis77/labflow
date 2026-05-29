const express = require("express");
const {
  getReviewEvents,
  getReviewEventById,
  createReviewEvent,
  deleteReviewEvent,
} = require("../controllers/reviewEventController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES, ROLE_GROUPS } = require("../constants/roles");

const router = express.Router();

// Every review event route requires a logged-in user
router.use(protect);

// Authenticated users can view review history
// This lets researchers see feedback history on their experiments/protocols
router.get("/", getReviewEvents);
router.get("/:id", getReviewEventById);

// Only admins and supervisors can create review history events
router.post("/", authorizeRoles(...ROLE_GROUPS.MANAGERS), createReviewEvent);

// Only admins can delete review history events
// In a production system, deleting review history should be rare or avoided
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteReviewEvent);

module.exports = router;
