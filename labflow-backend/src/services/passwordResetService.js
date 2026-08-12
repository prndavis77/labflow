const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { validatePassword } = require("../utils/passwordPolicy");
const { Op } = require("sequelize");
const { User, Organization, PasswordResetToken } = require("../models");

const SALT_ROUNDS = 12;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MINUTES = 30;

class PasswordResetError extends Error {
  constructor(message, code) {
    super(message);

    this.name = "PasswordResetError";
    this.code = code;
  }
}

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const normalizeRawToken = (token) => {
  return String(token || "").trim();
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const createRawToken = () => {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
};

const calculateExpiry = (
  now = new Date(),
  expiryMinutes = RESET_TOKEN_EXPIRY_MINUTES,
) => {
  return new Date(now.getTime() + expiryMinutes * 60 * 1000);
};

const invalidateActiveResetTokens = async ({
  userId,
  invalidatedAt,
  transaction,
  excludeTokenId = null,
}) => {
  const where = {
    userId,
    consumedAt: null,
    invalidatedAt: null,
  };

  if (excludeTokenId !== null) {
    where.id = {
      [Op.ne]: excludeTokenId,
    };
  }

  await PasswordResetToken.update(
    {
      invalidatedAt,
    },
    {
      where,
      transaction,
    },
  );
};

/**
 * Creates a single-use password-reset token for an active user.
 *
 * The raw token is returned only so the controller can place it in an
 * email. It must never be stored in the database, logged, or returned
 * through the public API.
 *
 * A non-existent or inactive account returns created: false. The future
 * controller must still return the same public response in every case.
 */
const createPasswordResetRequest = async ({
  email,
  requestIp = null,
  now = new Date(),
  expiryMinutes = RESET_TOKEN_EXPIRY_MINUTES,
}) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return {
      created: false,
      reason: "missing_email",
    };
  }

  const transaction = await PasswordResetToken.sequelize.transaction();

  try {
    const user = await User.findOne({
      where: {
        email: normalizedEmail,
        isActive: true,
      },
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "isActive"],
        },
      ],
      transaction,
    });

    if (!user || !user.organization || !user.organization.isActive) {
      await transaction.commit();

      return {
        created: false,
        reason: "account_unavailable",
      };
    }

    await invalidateActiveResetTokens({
      userId: user.id,
      invalidatedAt: now,
      transaction,
    });

    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = calculateExpiry(now, expiryMinutes);

    const resetToken = await PasswordResetToken.create(
      {
        userId: user.id,
        organizationId: user.organizationId,
        tokenHash,
        expiresAt,
        consumedAt: null,
        invalidatedAt: null,
        requestIp,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return {
      created: true,
      rawToken,
      expiresAt,
      resetTokenId: resetToken.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
};

/**
 * Checks whether a raw reset token currently represents an active,
 * unused, unexpired reset request.
 *
 * This does not consume the token.
 */
const validatePasswordResetToken = async ({ rawToken, now = new Date() }) => {
  const normalizedToken = normalizeRawToken(rawToken);

  if (!normalizedToken) {
    return {
      valid: false,
      reason: "missing_token",
    };
  }

  const tokenHash = hashToken(normalizedToken);

  const resetToken = await PasswordResetToken.findOne({
    where: {
      tokenHash,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "email", "isActive", "organizationId"],
      },
    ],
  });

  if (!resetToken) {
    return {
      valid: false,
      reason: "invalid_token",
    };
  }

  if (resetToken.consumedAt) {
    return {
      valid: false,
      reason: "consumed_token",
    };
  }

  if (resetToken.invalidatedAt) {
    return {
      valid: false,
      reason: "invalidated_token",
    };
  }

  if (resetToken.expiresAt.getTime() <= now.getTime()) {
    return {
      valid: false,
      reason: "expired_token",
    };
  }

  if (!resetToken.user || !resetToken.user.isActive) {
    return {
      valid: false,
      reason: "account_unavailable",
    };
  }

  if (resetToken.organizationId !== resetToken.user.organizationId) {
    return {
      valid: false,
      reason: "organization_mismatch",
    };
  }

  return {
    valid: true,
    userId: resetToken.userId,
    organizationId: resetToken.organizationId,
    expiresAt: resetToken.expiresAt,
  };
};

const invalidatePasswordResetToken = async ({
  resetTokenId,
  invalidatedAt = new Date(),
}) => {
  if (!resetTokenId) {
    return false;
  }

  const [updatedCount] = await PasswordResetToken.update(
    {
      invalidatedAt,
    },
    {
      where: {
        id: resetTokenId,
        consumedAt: null,
        invalidatedAt: null,
      },
    },
  );

  return updatedCount > 0;
};

/**
 * Consumes a valid reset token and changes the user's password.
 *
 * The token row and user row are locked inside one transaction so that
 * concurrent attempts cannot successfully consume the same token.
 */
const resetPasswordWithToken = async ({
  rawToken,
  newPassword,
  now = new Date(),
}) => {
  const normalizedToken = normalizeRawToken(rawToken);
  const password = String(newPassword || "");

  if (!normalizedToken) {
    throw new PasswordResetError(
      "The password reset token is invalid or has expired.",
      "INVALID_OR_EXPIRED_TOKEN",
    );
  }

  const passwordValidation = validatePassword(password);

  if (!passwordValidation.valid) {
    throw new PasswordResetError(
      passwordValidation.message,
      "INVALID_PASSWORD",
    );
  }

  const tokenHash = hashToken(normalizedToken);

  const transaction = await PasswordResetToken.sequelize.transaction();

  try {
    const resetToken = await PasswordResetToken.findOne({
      where: {
        tokenHash,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !resetToken ||
      resetToken.consumedAt ||
      resetToken.invalidatedAt ||
      resetToken.expiresAt.getTime() <= now.getTime()
    ) {
      throw new PasswordResetError(
        "The password reset token is invalid or has expired.",
        "INVALID_OR_EXPIRED_TOKEN",
      );
    }

    const user = await User.findByPk(resetToken.userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !user ||
      !user.isActive ||
      user.organizationId !== resetToken.organizationId
    ) {
      throw new PasswordResetError(
        "The password reset token is invalid or has expired.",
        "INVALID_OR_EXPIRED_TOKEN",
      );
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    user.passwordHash = passwordHash;
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;

    await user.save({
      transaction,
    });

    resetToken.consumedAt = now;

    await resetToken.save({
      transaction,
    });

    await invalidateActiveResetTokens({
      userId: user.id,
      invalidatedAt: now,
      transaction,
      excludeTokenId: resetToken.id,
    });

    await transaction.commit();

    return {
      userId: user.id,
      organizationId: user.organizationId,
      tokenVersion: user.tokenVersion,
      consumedAt: resetToken.consumedAt,
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
};

module.exports = {
  PasswordResetError,
  RESET_TOKEN_EXPIRY_MINUTES,
  calculateExpiry,
  createPasswordResetRequest,
  hashToken,
  invalidateActiveResetTokens,
  invalidatePasswordResetToken,
  normalizeEmail,
  resetPasswordWithToken,
  validatePasswordResetToken,
};
