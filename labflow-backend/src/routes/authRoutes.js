const express = require("express");

const {
  registerUser,
  loginUser,
  getCurrentUser,
  requestPasswordReset,
  getPasswordResetStatus,
  completePasswordReset,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/forgot-password", requestPasswordReset);

router.get("/password-reset/:token", getPasswordResetStatus);

router.post("/password-reset/:token", completePasswordReset);

router.get("/me", protect, getCurrentUser);

module.exports = router;
