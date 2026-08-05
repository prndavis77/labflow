const express = require("express");

const {
  getCurrentOrganization,
  updateCurrentOrganization,
} = require("../controllers/organizationController");

const {
  protect,
  requireVerifiedEmail,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(protect);

router.use(protect);

router.use(requireVerifiedEmail);

router.get("/", getCurrentOrganization);
router.patch("/", authorizeRoles(ROLES.ADMIN), updateCurrentOrganization);

module.exports = router;
