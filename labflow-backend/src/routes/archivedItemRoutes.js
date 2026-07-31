const express = require("express");

const {
  getArchivedItems,
  restoreArchivedItem,
} = require("../controllers/archivedItemController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles(ROLES.ADMIN));

router.get("/", getArchivedItems);

router.post("/:entityType/:id/restore", restoreArchivedItem);

module.exports = router;
