const express = require("express");

const {
  listInvitations,
  createInvitation,
  revokeInvitation,
} = require("../controllers/invitationController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(protect);

router.get("/", authorizeRoles(ROLES.ADMIN), listInvitations);
router.post("/", authorizeRoles(ROLES.ADMIN), createInvitation);
router.patch("/:id/revoke", authorizeRoles(ROLES.ADMIN), revokeInvitation);

module.exports = router;
