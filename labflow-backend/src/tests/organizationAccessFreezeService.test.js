const mockTransaction = {
  LOCK: {
    UPDATE: "UPDATE",
  },
};

const mockModels = {
  EmailVerificationToken: {
    update: jest.fn(),
  },

  Organization: {
    findByPk: jest.fn(),
    sequelize: {
      transaction: jest.fn(),
    },
  },

  PasswordResetToken: {
    update: jest.fn(),
  },

  User: {
    count: jest.fn(),
    increment: jest.fn(),
  },
};

jest.mock("../models", () => mockModels);

const {
  OrganizationAccessFreezeError,
  freezeOrganizationAccess,
  getOrganizationAccessFreezeState,
} = require("../services/organizationAccessFreezeService");

describe("organizationAccessFreezeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockModels.Organization.sequelize.transaction.mockImplementation(
      async (callback) => callback(mockTransaction),
    );

    mockModels.PasswordResetToken.update.mockResolvedValue([0]);
    mockModels.EmailVerificationToken.update.mockResolvedValue([0]);
    mockModels.User.increment.mockResolvedValue(undefined);
  });

  describe("getOrganizationAccessFreezeState", () => {
    it("reports an active organization as not frozen", async () => {
      mockModels.Organization.findByPk.mockResolvedValue({
        id: 17,
        isActive: true,
        offboardingFrozenAt: null,
      });

      mockModels.User.count.mockResolvedValue(3);

      await expect(
        getOrganizationAccessFreezeState({
          organizationId: 17,
        }),
      ).resolves.toEqual({
        organizationId: 17,
        organizationActive: true,
        activeUserCount: 3,
        frozen: false,
        offboardingFrozenAt: null,
      });
    });

    it("reports an inactive organization as frozen", async () => {
      const frozenAt = new Date("2026-08-24T09:00:00.000Z");

      mockModels.Organization.findByPk.mockResolvedValue({
        id: 17,
        isActive: false,
        offboardingFrozenAt: frozenAt,
      });

      mockModels.User.count.mockResolvedValue(2);

      await expect(
        getOrganizationAccessFreezeState({
          organizationId: 17,
        }),
      ).resolves.toEqual({
        organizationId: 17,
        organizationActive: false,
        activeUserCount: 2,
        frozen: true,
        offboardingFrozenAt: frozenAt,
      });
    });

    it("rejects an unknown organization", async () => {
      mockModels.Organization.findByPk.mockResolvedValue(null);

      await expect(
        getOrganizationAccessFreezeState({
          organizationId: 17,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_NOT_FOUND",
      });
    });
  });

  describe("freezeOrganizationAccess", () => {
    it("deactivates the organization and invalidates sessions and outstanding tokens", async () => {
      const organization = {
        id: 17,
        isActive: true,
        offboardingFrozenAt: null,
        update: jest.fn(async (values) => {
          Object.assign(organization, values);
        }),
      };

      mockModels.Organization.findByPk.mockResolvedValue(organization);

      mockModels.PasswordResetToken.update.mockResolvedValue([2]);
      mockModels.EmailVerificationToken.update.mockResolvedValue([3]);

      const now = new Date("2026-08-22T14:00:00.000Z");

      const result = await freezeOrganizationAccess({
        organizationId: 17,
        now,
      });

      expect(mockModels.Organization.findByPk).toHaveBeenCalledWith(17, {
        attributes: ["id", "isActive", "offboardingFrozenAt"],
        transaction: mockTransaction,
        lock: "UPDATE",
      });

      expect(organization.update).toHaveBeenCalledWith(
        {
          isActive: false,
          offboardingFrozenAt: now,
        },
        {
          transaction: mockTransaction,
        },
      );

      expect(mockModels.User.increment).toHaveBeenCalledWith(
        {
          tokenVersion: 1,
        },
        {
          where: {
            organizationId: 17,
          },
          transaction: mockTransaction,
        },
      );

      expect(mockModels.PasswordResetToken.update).toHaveBeenCalledWith(
        {
          invalidatedAt: now,
        },
        {
          where: {
            organizationId: 17,
            consumedAt: null,
            invalidatedAt: null,
          },
          transaction: mockTransaction,
        },
      );

      expect(mockModels.EmailVerificationToken.update).toHaveBeenCalledWith(
        {
          invalidatedAt: now,
        },
        {
          where: {
            organizationId: 17,
            consumedAt: null,
            invalidatedAt: null,
          },
          transaction: mockTransaction,
        },
      );

      expect(result).toEqual({
        organizationId: 17,
        organizationActive: false,
        invalidatedPasswordResetTokenCount: 2,
        invalidatedEmailVerificationTokenCount: 3,
        frozenAt: now,
      });
    });

    it("preserves the original freeze timestamp when the organization is already frozen", async () => {
      const originalFrozenAt = new Date("2026-08-24T09:00:00.000Z");

      const organization = {
        id: 17,
        isActive: false,
        offboardingFrozenAt: originalFrozenAt,
        update: jest.fn(),
      };

      mockModels.Organization.findByPk.mockResolvedValue(organization);

      const result = await freezeOrganizationAccess({
        organizationId: 17,
        now: new Date("2026-08-24T09:05:00.000Z"),
      });

      expect(organization.update).not.toHaveBeenCalled();

      /*
       * tokenVersion is deliberately incremented again.
       *
       * This ensures a retry invalidates any session accidentally issued after
       * the original freeze.
       */
      expect(mockModels.User.increment).toHaveBeenCalledTimes(1);

      expect(result.organizationActive).toBe(false);
      expect(result.frozenAt).toEqual(originalFrozenAt);
    });

    it("establishes a freeze timestamp for an inactive organization that does not have one yet", async () => {
      const now = new Date("2026-08-24T10:00:00.000Z");

      const organization = {
        id: 17,
        isActive: false,
        offboardingFrozenAt: null,
        update: jest.fn(async (values) => {
          Object.assign(organization, values);
        }),
      };

      mockModels.Organization.findByPk.mockResolvedValue(organization);

      const result = await freezeOrganizationAccess({
        organizationId: 17,
        now,
      });

      expect(organization.update).toHaveBeenCalledWith(
        {
          isActive: false,
          offboardingFrozenAt: now,
        },
        {
          transaction: mockTransaction,
        },
      );

      expect(result.frozenAt).toEqual(now);
    });

    it("rejects an unknown organization without mutating users or tokens", async () => {
      mockModels.Organization.findByPk.mockResolvedValue(null);

      await expect(
        freezeOrganizationAccess({
          organizationId: 17,
        }),
      ).rejects.toBeInstanceOf(OrganizationAccessFreezeError);

      expect(mockModels.User.increment).not.toHaveBeenCalled();

      expect(mockModels.PasswordResetToken.update).not.toHaveBeenCalled();

      expect(mockModels.EmailVerificationToken.update).not.toHaveBeenCalled();
    });

    it.each([undefined, null, "", 0, -1, 1.5, "abc"])(
      "rejects invalid organization id %p",
      async (organizationId) => {
        await expect(
          freezeOrganizationAccess({
            organizationId,
          }),
        ).rejects.toMatchObject({
          code: "INVALID_ORGANIZATION_ID",
        });
      },
    );
  });
});
