"use strict";

const {
  EmailVerificationToken,
  Organization,
  PasswordResetToken,
  User,
} = require("../models");
const { validateOrganizationId } = require("./organizationDeletionService");

const sequelize = Organization.sequelize;

class OrganizationAccessFreezeError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OrganizationAccessFreezeError";
    this.code = code;
  }
}

const getOrganizationAccessFreezeState = async ({
  organizationId,
  transaction,
} = {}) => {
  const normalizedOrganizationId = validateOrganizationId(organizationId);

  const organization = await Organization.findByPk(normalizedOrganizationId, {
    attributes: ["id", "isActive", "offboardingFrozenAt"],
    transaction,
  });

  if (!organization) {
    throw new OrganizationAccessFreezeError(
      "Organization was not found.",
      "ORGANIZATION_NOT_FOUND",
    );
  }

  const activeUserCount = await User.count({
    where: {
      organizationId: normalizedOrganizationId,
      isActive: true,
    },
    transaction,
  });

  return {
    organizationId: normalizedOrganizationId,
    organizationActive: organization.isActive === true,
    activeUserCount,
    frozen: organization.isActive === false,
    offboardingFrozenAt: organization.offboardingFrozenAt || null,
  };
};

const freezeOrganizationAccess = async ({
  organizationId,
  now = new Date(),
} = {}) => {
  const normalizedOrganizationId = validateOrganizationId(organizationId);

  return sequelize.transaction(async (transaction) => {
    const organization = await Organization.findByPk(normalizedOrganizationId, {
      attributes: ["id", "isActive", "offboardingFrozenAt"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!organization) {
      throw new OrganizationAccessFreezeError(
        "Organization was not found.",
        "ORGANIZATION_NOT_FOUND",
      );
    }

    /*
     * Establish the offboarding freeze timestamp exactly once.
     *
     * Retries must preserve the original timestamp so they do not restart the
     * signed-upload quiescence period.
     *
     * If an organization was previously made inactive without going through the
     * formal offboarding freeze flow, establish the timestamp now.
     */
    if (organization.isActive || !organization.offboardingFrozenAt) {
      await organization.update(
        {
          isActive: false,
          offboardingFrozenAt: organization.offboardingFrozenAt || now,
        },
        {
          transaction,
        },
      );
    }

    /*
     * Increment every user's tokenVersion, including already-inactive users.
     *
     * This invalidates any JWT issued before the organization freeze.
     */
    await User.increment(
      {
        tokenVersion: 1,
      },
      {
        where: {
          organizationId: normalizedOrganizationId,
        },
        transaction,
      },
    );

    /*
     * Outstanding account-recovery tokens must not remain usable after the
     * organization has entered permanent offboarding.
     */
    const [invalidatedPasswordResetTokenCount] =
      await PasswordResetToken.update(
        {
          invalidatedAt: now,
        },
        {
          where: {
            organizationId: normalizedOrganizationId,
            consumedAt: null,
            invalidatedAt: null,
          },
          transaction,
        },
      );

    const [invalidatedEmailVerificationTokenCount] =
      await EmailVerificationToken.update(
        {
          invalidatedAt: now,
        },
        {
          where: {
            organizationId: normalizedOrganizationId,
            consumedAt: null,
            invalidatedAt: null,
          },
          transaction,
        },
      );

    return {
      organizationId: normalizedOrganizationId,
      organizationActive: false,
      invalidatedPasswordResetTokenCount,
      invalidatedEmailVerificationTokenCount,
      frozenAt: organization.offboardingFrozenAt,
    };
  });
};

module.exports = {
  OrganizationAccessFreezeError,
  freezeOrganizationAccess,
  getOrganizationAccessFreezeState,
};
