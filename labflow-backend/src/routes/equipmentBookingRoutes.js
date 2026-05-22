const express = require("express");
const {
  getEquipmentBookings,
  getEquipmentBookingById,
  createEquipmentBooking,
  updateEquipmentBooking,
  deleteEquipmentBooking,
} = require("../controllers/equipmentBookingController");
const { ROLE_GROUPS } = require("../constants/roles");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Every booking route requires a logged-in user
router.use(protect);

// All authenticated users can view equipment bookings
router.get("/", getEquipmentBookings);
router.get("/:id", getEquipmentBookingById);

// All authenticated roles can create and update bookings
// Researchers need to reserve instruments for their lab work
router.post(
  "/",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  createEquipmentBooking,
);

router.patch(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.ALL_AUTHENTICATED),
  updateEquipmentBooking,
);

// Only admins and supervisors can delete bookings for now
router.delete(
  "/:id",
  authorizeRoles(...ROLE_GROUPS.MANAGERS),
  deleteEquipmentBooking,
);

module.exports = router;
