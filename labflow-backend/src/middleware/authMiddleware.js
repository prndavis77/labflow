const jwt = require("jsonwebtoken");
const { User } = require("../models");

const EMAIL_VERIFICATION_REQUIRED_CODE = "EMAIL_VERIFICATION_REQUIRED";

const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Verify your email address before using this feature.";

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Not authorized, no token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Not authorized, invalid or expired token.",
    });
  }
};

const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      message: "Not authorized.",
    });
  }

  if (!req.user.emailVerifiedAt) {
    return res.status(403).json({
      status: "error",
      code: EMAIL_VERIFICATION_REQUIRED_CODE,
      message: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
    });
  }

  next();
};

const authorizeRoles = (...allowedRoles) => {
  const roleMiddleware = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Not authorized.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message:
          "Forbidden: You do not have permission to access this resource.",
      });
    }

    next();
  };

  return roleMiddleware;
};

module.exports = {
  protect,
  authorizeRoles,
  requireVerifiedEmail,
  EMAIL_VERIFICATION_REQUIRED_CODE,
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
};
