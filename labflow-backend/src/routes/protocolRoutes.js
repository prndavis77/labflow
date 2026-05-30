const express = require("express");
const {
  getProtocols,
  getProtocolById,
  createProtocol,
  updateProtocol,
  deleteProtocol,
} = require("../controllers/protocolController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES, ROLE_GROUPS } = require("../constants/roles");

const router = express.Router();

// Every protocol route requires a logged-in user
router.use(protect);

// All authenticated users can view protocols for now
router.get("/", getProtocols);
router.get("/:id", getProtocolById);

// Only admins and supervisors can create, update, or delete protocols for now
// This keeps protocol approval and method control stricter than normal task edits
router.post(
  "/",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  createProtocol,
);
router.patch(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  updateProtocol,
);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteProtocol);

module.exports = router;
