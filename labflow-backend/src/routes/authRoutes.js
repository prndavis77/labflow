const express = require("express");
const rateLimit = require("express-rate-limit");
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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many login attempts. Please try again later.",
  },
});

const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many password reset requests. Please try again later.",
  },
});

const emailVerificationRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many verification email requests. Please try again later.",
  },
});

router.post("/register", registerUser);

router.post("/login", loginLimiter, loginUser);

router.post(
  "/forgot-password",
  passwordResetRequestLimiter,
  requestPasswordReset,
);

router.get("/password-reset/:token", getPasswordResetStatus);

router.post("/password-reset/:token", completePasswordReset);

router.post(
  "/email-verification/request",
  protect,
  emailVerificationRequestLimiter,
  requestEmailVerification,
);

router.get("/email-verification/:token", getEmailVerificationStatus);

router.post("/email-verification/:token", completeEmailVerification);

router.get("/me", protect, getCurrentUser);

module.exports = router;
