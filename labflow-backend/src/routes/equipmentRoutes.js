const express = require("express");
const {
  getEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} = require("../controllers/equipmentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLE_GROUPS } = require("../constants/roles");

const router = express.Router();

// Every equipment route requires a logged-in user
router.use(protect);

// All authenticated users can view equipment
router.get("/", getEquipment);
router.get("/:id", getEquipmentById);

// Only admins and supervisors can manage the equipment inventory
router.post("/", authorizeRoles(...ROLE_GROUPS.MANAGERS), createEquipment);
router.patch("/:id", authorizeRoles(...ROLE_GROUPS.MANAGERS), updateEquipment);
router.delete("/:id", authorizeRoles(...ROLE_GROUPS.MANAGERS), deleteEquipment);

module.exports = router;
