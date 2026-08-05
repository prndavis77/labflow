const express = require("express");

const {
  listInvitations,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  getInvitationForAcceptance,
  acceptInvitation,
} = require("../controllers/invitationController");

const {
  protect,
  requireVerifiedEmail,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const { ROLES } = require("../constants/roles");

const router = express.Router();

router.get("/accept/:token", getInvitationForAcceptance);

router.post("/accept/:token", acceptInvitation);

router.use(protect);

router.use(requireVerifiedEmail);

router.get("/", authorizeRoles(ROLES.ADMIN), listInvitations);

router.post("/", authorizeRoles(ROLES.ADMIN), createInvitation);

router.post("/:id/resend", authorizeRoles(ROLES.ADMIN), resendInvitation);

router.patch("/:id/revoke", authorizeRoles(ROLES.ADMIN), revokeInvitation);

module.exports = router;
