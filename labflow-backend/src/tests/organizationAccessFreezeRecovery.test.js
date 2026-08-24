const bcrypt = require("bcrypt");
const {
  EmailVerificationToken,
  Invitation,
  Organization,
  PasswordResetToken,
  User,
} = require("../models");
const {
  createPasswordResetRequest,
  resetPasswordWithToken,
  validatePasswordResetToken,
} = require("../services/passwordResetService");
const {
  createEmailVerificationRequest,
  verifyEmailWithToken,
} = require("../services/emailVerificationService");
const {
  freezeOrganizationAccess,
} = require("../services/organizationAccessFreezeService");

const { TEST_PASSWORD, createTestUser } = require("./helpers/testHelpers");

const createOrganization = async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return Organization.create({
    name: `Recovery Freeze Lab ${suffix}`,
    slug: `recovery-freeze-${suffix}`,
    type: "demo",
    isActive: true,
  });
};

describe("frozen organization recovery paths", () => {
  let organization;
  let user;

  let neighborOrganization;
  let neighborUser;

  beforeEach(async () => {
    organization = await createOrganization();

    user = await createTestUser({
      name: "Recovery Freeze User",
      email: `recovery-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}@example.com`,
      role: "admin",
      organizationId: organization.id,
    });

    neighborOrganization = await createOrganization();

    neighborUser = await createTestUser({
      name: "Recovery Freeze Neighbor User",
      email: `recovery-neighbor-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}@example.com`,
      role: "admin",
      organizationId: neighborOrganization.id,
    });
  });

  afterEach(async () => {
    const organizationIds = [organization?.id, neighborOrganization?.id].filter(
      Boolean,
    );

    for (const organizationId of organizationIds) {
      await EmailVerificationToken.destroy({
        where: {
          organizationId,
        },
      });

      await PasswordResetToken.destroy({
        where: {
          organizationId,
        },
      });

      await Invitation.destroy({
        where: {
          organizationId,
        },
      });

      await User.destroy({
        where: {
          organizationId,
        },
      });

      await Organization.destroy({
        where: {
          id: organizationId,
        },
      });
    }
  });

  afterAll(async () => {
    await Organization.sequelize.close();
  });

  it("does not create a new password-reset token after freeze", async () => {
    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    const result = await createPasswordResetRequest({
      email: user.email,
    });

    expect(result).toEqual({
      created: false,
      reason: "account_unavailable",
    });

    expect(
      await PasswordResetToken.count({
        where: {
          organizationId: organization.id,
        },
      }),
    ).toBe(0);
  });

  it("treats a password-reset token as invalid after freeze", async () => {
    const resetRequest = await createPasswordResetRequest({
      email: user.email,
    });

    expect(resetRequest.created).toBe(true);

    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    const validation = await validatePasswordResetToken({
      rawToken: resetRequest.rawToken,
    });

    expect(validation.valid).toBe(false);

    await expect(
      resetPasswordWithToken({
        rawToken: resetRequest.rawToken,
        newPassword: "FrozenResetPassword123!",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
    });
  });

  it("invalidates password-reset access only for the frozen organization", async () => {
    const targetResetRequest = await createPasswordResetRequest({
      email: user.email,
    });

    const neighborResetRequest = await createPasswordResetRequest({
      email: neighborUser.email,
    });

    expect(targetResetRequest.created).toBe(true);
    expect(neighborResetRequest.created).toBe(true);

    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    /*
     * The frozen organization's previously issued reset token must stop working.
     */
    expect(
      await PasswordResetToken.count({
        where: {
          organizationId: neighborOrganization.id,
          invalidatedAt: null,
          consumedAt: null,
        },
      }),
    ).toBe(1);

    const targetValidation = await validatePasswordResetToken({
      rawToken: targetResetRequest.rawToken,
    });

    expect(targetValidation.valid).toBe(false);

    await expect(
      resetPasswordWithToken({
        rawToken: targetResetRequest.rawToken,
        newPassword: "FrozenTargetPassword123!",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
    });

    /*
     * The neighboring organization's existing reset token must remain valid.
     */
    const neighborValidation = await validatePasswordResetToken({
      rawToken: neighborResetRequest.rawToken,
    });

    expect(neighborValidation.valid).toBe(true);

    await expect(
      resetPasswordWithToken({
        rawToken: neighborResetRequest.rawToken,
        newPassword: "NeighborResetPassword123!",
      }),
    ).resolves.toBeDefined();

    const neighborOrganizationAfter = await Organization.findByPk(
      neighborOrganization.id,
    );

    expect(neighborOrganizationAfter.isActive).toBe(true);
  });

  it("does not create a new email-verification token after freeze", async () => {
    user.emailVerifiedAt = null;
    await user.save();

    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    const result = await createEmailVerificationRequest({
      userId: user.id,
    });

    expect(result).toEqual({
      created: false,
      reason: "account_unavailable",
    });

    expect(
      await EmailVerificationToken.count({
        where: {
          organizationId: organization.id,
        },
      }),
    ).toBe(0);
  });

  it("does not allow an existing email-verification token after freeze", async () => {
    user.emailVerifiedAt = null;
    await user.save();

    const verificationRequest = await createEmailVerificationRequest({
      userId: user.id,
    });

    expect(verificationRequest.created).toBe(true);

    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    await expect(
      verifyEmailWithToken({
        rawToken: verificationRequest.rawToken,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
    });

    const reloadedUser = await User.findByPk(user.id);

    expect(reloadedUser.emailVerifiedAt).toBeNull();
  });

  it("invalidates email-verification access only for the frozen organization", async () => {
    user.emailVerifiedAt = null;
    await user.save();

    neighborUser.emailVerifiedAt = null;
    await neighborUser.save();

    const targetVerificationRequest = await createEmailVerificationRequest({
      userId: user.id,
    });

    const neighborVerificationRequest = await createEmailVerificationRequest({
      userId: neighborUser.id,
    });

    expect(targetVerificationRequest.created).toBe(true);
    expect(neighborVerificationRequest.created).toBe(true);

    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    /*
     * Frozen organization's existing verification token is unusable.
     */
    expect(
      await EmailVerificationToken.count({
        where: {
          organizationId: neighborOrganization.id,
          invalidatedAt: null,
          consumedAt: null,
        },
      }),
    ).toBe(1);

    await expect(
      verifyEmailWithToken({
        rawToken: targetVerificationRequest.rawToken,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
    });

    const targetUserAfter = await User.findByPk(user.id);

    expect(targetUserAfter.emailVerifiedAt).toBeNull();

    /*
     * Neighboring organization's existing verification token still works.
     */
    await expect(
      verifyEmailWithToken({
        rawToken: neighborVerificationRequest.rawToken,
      }),
    ).resolves.toBeDefined();

    const neighborUserAfter = await User.findByPk(neighborUser.id);

    expect(neighborUserAfter.emailVerifiedAt).not.toBeNull();

    const neighborOrganizationAfter = await Organization.findByPk(
      neighborOrganization.id,
    );

    expect(neighborOrganizationAfter.isActive).toBe(true);
  });
});
