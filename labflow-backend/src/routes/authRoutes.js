const express = require("express");

const {
  registerUser,
  loginUser,
  getCurrentUser,
  requestPasswordReset,
  getPasswordResetStatus,
  completePasswordReset,
  requestEmailVerification,
  getEmailVerificationStatus,
  completeEmailVerification,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/forgot-password", requestPasswordReset);

router.get("/password-reset/:token", getPasswordResetStatus);

router.post("/password-reset/:token", completePasswordReset);

router.post("/email-verification/request", protect, requestEmailVerification);

router.get("/email-verification/:token", getEmailVerificationStatus);

router.post("/email-verification/:token", completeEmailVerification);

router.get("/me", protect, getCurrentUser);

module.exports = router;
