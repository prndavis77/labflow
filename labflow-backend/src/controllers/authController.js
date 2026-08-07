const bcrypt = require("bcrypt");

const { User, Organization } = require("../models");

const generateToken = require("../utils/generateToken");

const formatUserResponse = require("../utils/formatUserResponse");

const { createUniqueOrganizationSlug } = require("../utils/organizationSlug");

const { logError } = require("../utils/errorLogger");

const {
  PasswordResetError,
  createPasswordResetRequest,
  invalidatePasswordResetToken,
  resetPasswordWithToken,
  validatePasswordResetToken,
} = require("../services/passwordResetService");

const {
  sendPasswordResetEmail,
} = require("../services/passwordResetEmailService");

const {
  EmailVerificationError,
  createEmailVerificationRequest,
  invalidateEmailVerificationToken,
  validateEmailVerificationToken,
  verifyEmailWithToken,
} = require("../services/emailVerificationService");

const {
  sendEmailVerificationEmail,
} = require("../services/emailVerificationEmailService");

const SALT_ROUNDS = 12;

const ORGANIZATION_TYPES = ["lab", "department", "institution", "company"];

const PASSWORD_RESET_PUBLIC_MESSAGE =
  "If an account exists for that email address, password reset instructions have been sent.";

const PASSWORD_RESET_INVALID_MESSAGE =
  "The password reset link is invalid or has expired.";

const EMAIL_VERIFICATION_INVALID_MESSAGE =
  "The email verification link is invalid or has expired.";

const EMAIL_VERIFICATION_SENT_MESSAGE =
  "A verification email has been sent. Please check your inbox.";

const EMAIL_ALREADY_VERIFIED_MESSAGE =
  "Your email address is already verified.";

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const normalizeRequiredText = (value) => {
  return String(value || "").trim();
};

const getRequestIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim().slice(0, 45);
  }

  return (
    String(req.ip || req.socket?.remoteAddress || "")
      .trim()
      .slice(0, 45) || null
  );
};

const getFrontendBaseUrl = () => {
  return String(process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
};

const sendRegistrationVerificationEmail = async ({ userId, requestIp }) => {
  const verificationRequest = await createEmailVerificationRequest({
    userId,
    requestIp,
  });

  if (!verificationRequest.created) {
    return {
      created: false,
      accepted: false,
      skipped: false,
      reason: verificationRequest.reason || "verification_request_not_created",
    };
  }

  const verificationLink =
    `${getFrontendBaseUrl()}` +
    `/verify-email/` +
    `${verificationRequest.rawToken}`;

  let emailDelivery;

  try {
    emailDelivery = await sendEmailVerificationEmail({
      to: verificationRequest.user.email,
      userName: verificationRequest.user.name,
      organizationName: verificationRequest.user.organizationName,
      verificationLink,
      expiresAt: verificationRequest.expiresAt,
    });
  } catch (deliveryError) {
    logError(deliveryError, {
      event: "registration_verification_delivery_failed",
      message: "Registration verification email delivery failed",
    });

    emailDelivery = {
      accepted: false,
      skipped: false,
    };
  }

  if (!emailDelivery.accepted && !emailDelivery.skipped) {
    await invalidateEmailVerificationToken({
      verificationTokenId: verificationRequest.verificationTokenId,
    });
  }

  return {
    created: true,
    accepted: Boolean(emailDelivery.accepted),
    skipped: Boolean(emailDelivery.skipped),
  };
};

const registerUser = async (req, res) => {
  let transaction;

  try {
    const name = normalizeRequiredText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const department = normalizeRequiredText(req.body.department) || null;

    const organizationName = normalizeRequiredText(req.body.organizationName);

    const organizationType =
      normalizeRequiredText(req.body.organizationType) || "lab";

    if (!name || !email || !password || !organizationName) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, password, and organization name are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long.",
      });
    }

    if (!ORGANIZATION_TYPES.includes(organizationType)) {
      return res.status(400).json({
        status: "error",
        message: `Organization type must be one of: ${ORGANIZATION_TYPES.join(
          ", ",
        )}.`,
      });
    }

    transaction = await User.sequelize.transaction();

    const existingUser = await User.findOne({
      where: {
        email,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();

      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists.",
      });
    }

    const organizationSlug = await createUniqueOrganizationSlug(
      organizationName,
      transaction,
    );

    const organization = await Organization.create(
      {
        name: organizationName,
        slug: organizationSlug,
        type: organizationType,
        isActive: true,
      },
      {
        transaction,
      },
    );

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create(
      {
        name,
        email,
        passwordHash,
        role: "admin",
        department,
        organizationId: organization.id,
        isActive: true,
        emailVerifiedAt: null,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    const createdUser = await User.findByPk(user.id, {
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "slug", "type"],
        },
      ],
    });

    let emailVerification = {
      created: false,
      accepted: false,
      skipped: false,
    };

    try {
      emailVerification = await sendRegistrationVerificationEmail({
        userId: createdUser.id,
        requestIp: getRequestIp(req),
      });
    } catch (verificationError) {
      /*
       * The organization and administrator have already been
       * committed. Verification-email problems must not turn a
       * successful registration into a 500 response.
       *
       * The authenticated resend endpoint can issue another
       * verification token later.
       */
      logError(verificationError, {
        req,
        event: "registration_verification_setup_failed",
        message: "Registration verification setup failed",
      });
    }

    const token = generateToken(createdUser);

    return res.status(201).json({
      status: "success",
      message: emailVerification.accepted
        ? "Organization and administrator account created successfully. Check your email to verify your address."
        : "Organization and administrator account created successfully.",
      data: {
        user: formatUserResponse(createdUser),
        token,
        emailVerification: {
          required: true,
          sent: emailVerification.accepted,
          deliverySkipped: emailVerification.skipped,
        },
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    logError(error, {
      req,
      event: "registration_failed",
      message: "Organization registration failed",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the organization account.",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      where: { email: normalizedEmail },
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "slug", "type"],
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    const passwordMatched = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatched) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated.",
      });
    }

    const token = generateToken(user);

    return res.json({
      status: "success",
      message: "Login successful.",
      data: {
        token,
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "login_failed",
      message: "Login failed",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while logging in.",
    });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (email) {
      const resetRequest = await createPasswordResetRequest({
        email,
        requestIp: getRequestIp(req),
      });

      if (resetRequest.created) {
        const resetLink =
          `${getFrontendBaseUrl()}` +
          `/reset-password/` +
          `${resetRequest.rawToken}`;

        let emailDelivery;

        try {
          emailDelivery = await sendPasswordResetEmail({
            to: resetRequest.user.email,
            userName: resetRequest.user.name,
            organizationName: resetRequest.user.organizationName,
            resetLink,
            expiresAt: resetRequest.expiresAt,
          });
        } catch (deliveryError) {
          logError(deliveryError, {
            req,
            event: "password_reset_delivery_failed",
            message: "Password reset email delivery failed",
          });

          emailDelivery = {
            accepted: false,
            skipped: false,
          };
        }

        /*
         * A disabled provider represents an intentional local/test
         * configuration, so the token can remain available for tests.
         *
         * A genuine delivery failure invalidates the token because no
         * usable reset link reached the account owner.
         */
        if (!emailDelivery.accepted && !emailDelivery.skipped) {
          await invalidatePasswordResetToken({
            resetTokenId: resetRequest.resetTokenId,
          });
        }
      }
    }

    return res.status(200).json({
      status: "success",
      message: PASSWORD_RESET_PUBLIC_MESSAGE,
    });
  } catch (error) {
    logError(error, {
      req,
      event: "password_reset_request_failed",
      message: "Password reset request failed",
    });

    return res.status(200).json({
      status: "success",
      message: PASSWORD_RESET_PUBLIC_MESSAGE,
    });
  }
};

const getPasswordResetStatus = async (req, res) => {
  try {
    const rawToken = String(req.params.token || "").trim();

    const result = await validatePasswordResetToken({
      rawToken,
    });

    if (!result.valid) {
      return res.status(400).json({
        status: "error",
        message: PASSWORD_RESET_INVALID_MESSAGE,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "The password reset link is valid.",
      data: {
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "password_reset_validation_failed",
      message: "Password reset validation failed",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while validating the password reset link.",
    });
  }
};

const completePasswordReset = async (req, res) => {
  try {
    const rawToken = String(req.params.token || "").trim();

    const password = String(req.body.password || "");

    const passwordConfirmation = String(req.body.passwordConfirmation || "");

    if (!rawToken) {
      return res.status(400).json({
        status: "error",
        message: PASSWORD_RESET_INVALID_MESSAGE,
      });
    }

    if (!password) {
      return res.status(400).json({
        status: "error",
        message: "Password is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long.",
      });
    }

    if (passwordConfirmation && password !== passwordConfirmation) {
      return res.status(400).json({
        status: "error",
        message: "Password confirmation does not match.",
      });
    }

    await resetPasswordWithToken({
      rawToken,
      newPassword: password,
    });

    return res.status(200).json({
      status: "success",
      message:
        "Your password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    if (
      error instanceof PasswordResetError &&
      error.code === "INVALID_PASSWORD"
    ) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    if (
      error instanceof PasswordResetError &&
      error.code === "INVALID_OR_EXPIRED_TOKEN"
    ) {
      return res.status(400).json({
        status: "error",
        message: PASSWORD_RESET_INVALID_MESSAGE,
      });
    }

    logError(error, {
      req,
      event: "password_reset_completion_failed",
      message: "Password reset completion failed",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while resetting the password.",
    });
  }
};

const requestEmailVerification = async (req, res) => {
  try {
    const verificationRequest = await createEmailVerificationRequest({
      userId: req.user.id,
      requestIp: getRequestIp(req),
    });

    if (
      verificationRequest.alreadyVerified ||
      verificationRequest.reason === "already_verified"
    ) {
      return res.status(200).json({
        status: "success",
        message: EMAIL_ALREADY_VERIFIED_MESSAGE,
        data: {
          alreadyVerified: true,
        },
      });
    }

    if (!verificationRequest.created) {
      return res.status(400).json({
        status: "error",
        message: "A verification email could not be created for this account.",
      });
    }

    const verificationLink =
      `${getFrontendBaseUrl()}` +
      `/verify-email/` +
      `${verificationRequest.rawToken}`;

    let emailDelivery;

    try {
      emailDelivery = await sendEmailVerificationEmail({
        to: verificationRequest.user.email,
        userName: verificationRequest.user.name,
        organizationName: verificationRequest.user.organizationName,
        verificationLink,
        expiresAt: verificationRequest.expiresAt,
      });
    } catch (deliveryError) {
      logError(deliveryError, {
        req,
        event: "email_verification_delivery_failed",
        message: "Email verification email delivery failed",
      });

      emailDelivery = {
        accepted: false,
        skipped: false,
      };
    }

    if (!emailDelivery.accepted && !emailDelivery.skipped) {
      await invalidateEmailVerificationToken({
        verificationTokenId: verificationRequest.verificationTokenId,
      });

      return res.status(503).json({
        status: "error",
        message:
          "The verification email could not be sent. Please try again later.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: emailDelivery.skipped
        ? "Email verification was created, but email delivery is disabled in this environment."
        : EMAIL_VERIFICATION_SENT_MESSAGE,
      data: {
        alreadyVerified: false,
        deliverySkipped: Boolean(emailDelivery.skipped),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "email_verification_request_failed",
      message: "Email verification request failed",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while requesting email verification.",
    });
  }
};

const getEmailVerificationStatus = async (req, res) => {
  try {
    const rawToken = String(req.params.token || "").trim();

    const result = await validateEmailVerificationToken({
      rawToken,
    });

    if (result.alreadyVerified) {
      return res.status(200).json({
        status: "success",
        message: EMAIL_ALREADY_VERIFIED_MESSAGE,
        data: {
          alreadyVerified: true,
          verifiedAt: result.verifiedAt || null,
        },
      });
    }

    if (!result.valid) {
      return res.status(400).json({
        status: "error",
        message: EMAIL_VERIFICATION_INVALID_MESSAGE,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "The email verification link is valid.",
      data: {
        alreadyVerified: false,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "email_verification_validation_failed",
      message: "Email verification validation failed",
    });

    return res.status(500).json({
      status: "error",
      message:
        "An error occurred while validating the email verification link.",
    });
  }
};

const completeEmailVerification = async (req, res) => {
  try {
    const rawToken = String(req.params.token || "").trim();

    if (!rawToken) {
      return res.status(400).json({
        status: "error",
        message: EMAIL_VERIFICATION_INVALID_MESSAGE,
      });
    }

    const result = await verifyEmailWithToken({
      rawToken,
    });

    return res.status(200).json({
      status: "success",
      message: result.alreadyVerified
        ? EMAIL_ALREADY_VERIFIED_MESSAGE
        : "Your email address has been verified successfully.",
      data: {
        alreadyVerified: result.alreadyVerified,
        verifiedAt: result.verifiedAt,
      },
    });
  } catch (error) {
    if (
      error instanceof EmailVerificationError &&
      error.code === "INVALID_OR_EXPIRED_TOKEN"
    ) {
      return res.status(400).json({
        status: "error",
        message: EMAIL_VERIFICATION_INVALID_MESSAGE,
      });
    }

    logError(error, {
      req,
      event: "email_verification_completion_failed",
      message: "Email verification completion failed",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while verifying the email address.",
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "slug", "type"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "current_user_load_failed",
      message: "Current user load failed",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while loading the current user.",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  requestPasswordReset,
  getPasswordResetStatus,
  completePasswordReset,
  requestEmailVerification,
  getEmailVerificationStatus,
  completeEmailVerification,
  getCurrentUser,
};
