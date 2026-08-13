const express = require("express");
const { getDashboardSummary } = require("../controllers/dashboardController");
const {
  protect,
  requireVerifiedEmail,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Every dashboard route requires a logged-in user.
router.use(protect);

router.use(requireVerifiedEmail);

// Returns dashboard metrics and short summary lists.
router.get("/summary", getDashboardSummary);

module.exports = router;
