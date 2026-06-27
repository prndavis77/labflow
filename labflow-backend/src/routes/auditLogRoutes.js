const express = require("express");

const { getAuditLogs } = require("../controllers/auditLogController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles(ROLES.ADMIN));

router.get("/", getAuditLogs);

module.exports = router;
