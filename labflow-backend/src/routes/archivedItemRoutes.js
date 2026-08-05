const express = require("express");

const {
  getArchivedItems,
  restoreArchivedItem,
} = require("../controllers/archivedItemController");

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

router.use(authorizeRoles(ROLES.ADMIN));

router.get("/", getArchivedItems);

router.post("/:entityType/:id/restore", restoreArchivedItem);

module.exports = router;
