const express = require("express");

const {
  getCurrentOrganization,
  updateCurrentOrganization,
} = require("../controllers/organizationController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(protect);

router.get("/", getCurrentOrganization);
router.patch("/", authorizeRoles(ROLES.ADMIN), updateCurrentOrganization);

module.exports = router;
