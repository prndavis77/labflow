const crypto = require("crypto");

const { Op } = require("sequelize");

const { User, Organization, EmailVerificationToken } = require("../models");

const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

class EmailVerificationError extends Error {
  constructor(message, code) {
    super(message);

    this.name = "EmailVerificationError";
    this.code = code;
  }
}

const normalizeRawToken = (token) => {
  return String(token || "").trim();
};

const hashVerificationToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const createRawVerificationToken = () => {
  return crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");
};

const calculateVerificationExpiry = (
  now = new Date(),
  expiryHours = VERIFICATION_TOKEN_EXPIRY_HOURS,
) => {
  return new Date(now.getTime() + expiryHours * 60 * 60 * 1000);
};

const invalidateActiveVerificationTokens = async ({
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

  await EmailVerificationToken.update(
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
 * Creates a single-use verification token for an active,
 * currently unverified user.
 *
 * The raw token may be passed only to the email-delivery layer.
 * It must not be stored, logged, or included in a production API
 * response.
 */
const createEmailVerificationRequest = async ({
  userId,
  requestIp = null,
  now = new Date(),
  expiryHours = VERIFICATION_TOKEN_EXPIRY_HOURS,
}) => {
  if (!userId) {
    return {
      created: false,
      reason: "missing_user",
    };
  }

  const transaction = await EmailVerificationToken.sequelize.transaction();

  try {
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Organization,
          as: "organization",
          required: true,
          attributes: ["id", "name", "isActive"],
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !user ||
      !user.isActive ||
      !user.organization ||
      !user.organization.isActive
    ) {
      await transaction.commit();

      return {
        created: false,
        reason: "account_unavailable",
      };
    }

    if (user.emailVerifiedAt) {
      await transaction.commit();

      return {
        created: false,
        reason: "already_verified",
        alreadyVerified: true,
      };
    }

    await invalidateActiveVerificationTokens({
      userId: user.id,
      invalidatedAt: now,
      transaction,
    });

    const rawToken = createRawVerificationToken();

    const tokenHash = hashVerificationToken(rawToken);

    const expiresAt = calculateVerificationExpiry(now, expiryHours);

    const verificationToken = await EmailVerificationToken.create(
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
      verificationTokenId: verificationToken.id,
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
 * Checks an email-verification token without consuming it.
 */
const validateEmailVerificationToken = async ({
  rawToken,
  now = new Date(),
}) => {
  const normalizedToken = normalizeRawToken(rawToken);

  if (!normalizedToken) {
    return {
      valid: false,
      reason: "missing_token",
    };
  }

  const tokenHash = hashVerificationToken(normalizedToken);

  const verificationToken = await EmailVerificationToken.findOne({
    where: {
      tokenHash,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "id",
          "email",
          "isActive",
          "organizationId",
          "emailVerifiedAt",
        ],
        include: [
          {
            model: Organization,
            as: "organization",
            attributes: ["id", "name", "isActive"],
          },
        ],
      },
    ],
  });

  if (!verificationToken) {
    return {
      valid: false,
      reason: "invalid_token",
    };
  }

  if (verificationToken.consumedAt) {
    return {
      valid: false,
      reason: "consumed_token",
    };
  }

  if (verificationToken.invalidatedAt) {
    return {
      valid: false,
      reason: "invalidated_token",
    };
  }

  if (verificationToken.expiresAt.getTime() <= now.getTime()) {
    return {
      valid: false,
      reason: "expired_token",
    };
  }

  const user = verificationToken.user;

  if (
    !user ||
    !user.isActive ||
    !user.organization ||
    !user.organization.isActive
  ) {
    return {
      valid: false,
      reason: "account_unavailable",
    };
  }

  if (verificationToken.organizationId !== user.organizationId) {
    return {
      valid: false,
      reason: "organization_mismatch",
    };
  }

  if (user.emailVerifiedAt) {
    return {
      valid: false,
      reason: "already_verified",
      alreadyVerified: true,
      verifiedAt: user.emailVerifiedAt,
    };
  }

  return {
    valid: true,
    userId: user.id,
    organizationId: verificationToken.organizationId,
    email: user.email,
    expiresAt: verificationToken.expiresAt,
  };
};

/**
 * Marks one token as invalid when an email could not be
 * delivered.
 */
const invalidateEmailVerificationToken = async ({
  verificationTokenId,
  invalidatedAt = new Date(),
}) => {
  if (!verificationTokenId) {
    return false;
  }

  const [updatedCount] = await EmailVerificationToken.update(
    {
      invalidatedAt,
    },
    {
      where: {
        id: verificationTokenId,
        consumedAt: null,
        invalidatedAt: null,
      },
    },
  );

  return updatedCount > 0;
};

/**
 * Consumes a verification token and marks the user's email
 * address as verified.
 *
 * Both the token and user rows are locked so concurrent
 * requests cannot consume the same token successfully.
 */
const verifyEmailWithToken = async ({ rawToken, now = new Date() }) => {
  const normalizedToken = normalizeRawToken(rawToken);

  if (!normalizedToken) {
    throw new EmailVerificationError(
      "The email verification token is invalid or has expired.",
      "INVALID_OR_EXPIRED_TOKEN",
    );
  }

  const tokenHash = hashVerificationToken(normalizedToken);

  const transaction = await EmailVerificationToken.sequelize.transaction();

  try {
    const verificationToken = await EmailVerificationToken.findOne({
      where: {
        tokenHash,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !verificationToken ||
      verificationToken.consumedAt ||
      verificationToken.invalidatedAt ||
      verificationToken.expiresAt.getTime() <= now.getTime()
    ) {
      throw new EmailVerificationError(
        "The email verification token is invalid or has expired.",
        "INVALID_OR_EXPIRED_TOKEN",
      );
    }

    const user = await User.findByPk(verificationToken.userId, {
      include: [
        {
          model: Organization,
          as: "organization",
          required: true,
          attributes: ["id", "name", "isActive"],
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !user ||
      !user.isActive ||
      !user.organization ||
      !user.organization.isActive ||
      user.organizationId !== verificationToken.organizationId
    ) {
      throw new EmailVerificationError(
        "The email verification token is invalid or has expired.",
        "INVALID_OR_EXPIRED_TOKEN",
      );
    }

    /*
     * The account could have been verified through another
     * request after this token was issued. Consume this token
     * safely instead of changing the original verification time.
     */
    const alreadyVerified = Boolean(user.emailVerifiedAt);

    if (!alreadyVerified) {
      user.emailVerifiedAt = now;

      await user.save({
        transaction,
      });
    }

    verificationToken.consumedAt = now;

    await verificationToken.save({
      transaction,
    });

    await invalidateActiveVerificationTokens({
      userId: user.id,
      invalidatedAt: now,
      transaction,
      excludeTokenId: verificationToken.id,
    });

    await transaction.commit();

    return {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      verifiedAt: user.emailVerifiedAt,
      alreadyVerified,
      consumedAt: verificationToken.consumedAt,
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
};

module.exports = {
  EmailVerificationError,
  VERIFICATION_TOKEN_EXPIRY_HOURS,
  calculateVerificationExpiry,
  createEmailVerificationRequest,
  hashVerificationToken,
  invalidateActiveVerificationTokens,
  invalidateEmailVerificationToken,
  normalizeRawToken,
  validateEmailVerificationToken,
  verifyEmailWithToken,
};
