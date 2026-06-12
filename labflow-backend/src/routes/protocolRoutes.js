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

// All authenticated users can attempt protocol create/update
// The controller enforces detailed protocol permissions including researcher workflow permissions, project membership and general SOP restrictions
// Delete remains restricted to admins and supervisors at the route level
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
router.delete("/:id", authorizeRoles(...ROLE_GROUPS.MANAGERS), deleteProtocol);

module.exports = router;
