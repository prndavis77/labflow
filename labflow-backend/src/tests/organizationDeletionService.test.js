const mockTransaction = {
  LOCK: {
    UPDATE: "UPDATE",
  },
};

const mockModels = {
  Attachment: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  AuditLog: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  EmailVerificationToken: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Equipment: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  EquipmentBooking: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Experiment: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Invitation: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  NotebookEntry: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Organization: {
    findByPk: jest.fn(),
    destroy: jest.fn(),
    sequelize: {
      transaction: jest.fn(),
    },
  },
  PasswordResetToken: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Project: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  ProjectMember: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Protocol: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  ReviewEvent: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  Task: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
  User: {
    count: jest.fn(),
    destroy: jest.fn(),
  },
};

jest.mock("../models", () => mockModels);

const {
  OrganizationDeletionError,
  deleteOrganizationDatabaseData,
  getOrganizationDeletionInventory,
  validateOrganizationId,
} = require("../services/organizationDeletionService");

const ORGANIZATION_ID = 17;

const mockOrganization = {
  id: ORGANIZATION_ID,
  name: "Pilot Chemistry Lab",
  slug: "pilot-chemistry-lab",
  isActive: false,
};

const destroyModelsInOrder = [
  mockModels.ReviewEvent,
  mockModels.NotebookEntry,
  mockModels.EquipmentBooking,
  mockModels.ProjectMember,
  mockModels.Attachment,
  mockModels.Invitation,
  mockModels.Experiment,
  mockModels.Task,
  mockModels.Protocol,
  mockModels.Equipment,
  mockModels.Project,
  mockModels.PasswordResetToken,
  mockModels.EmailVerificationToken,
  mockModels.AuditLog,
  mockModels.User,
];

describe("organizationDeletionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockModels.Organization.sequelize.transaction.mockImplementation(
      async (callback) => callback(mockTransaction),
    );

    mockModels.Organization.findByPk.mockResolvedValue(mockOrganization);
    mockModels.Organization.destroy.mockResolvedValue(1);

    for (const model of Object.values(mockModels)) {
      if (model.count) {
        model.count.mockResolvedValue(0);
      }

      if (model.destroy) {
        model.destroy.mockResolvedValue(1);
      }
    }
  });

  describe("validateOrganizationId", () => {
    it("accepts a positive integer", () => {
      expect(validateOrganizationId("17")).toBe(17);
    });

    it.each([undefined, null, "", 0, -1, 1.5, "abc"])(
      "rejects invalid organization id %p",
      (value) => {
        expect(() => validateOrganizationId(value)).toThrow(
          OrganizationDeletionError,
        );
      },
    );
  });

  describe("getOrganizationDeletionInventory", () => {
    it("returns organization metadata and organization-scoped counts", async () => {
      mockModels.User.count.mockResolvedValue(4);
      mockModels.Project.count.mockResolvedValue(3);
      mockModels.Attachment.count.mockResolvedValue(2);

      const result = await getOrganizationDeletionInventory({
        organizationId: ORGANIZATION_ID,
      });

      expect(result.organization).toEqual({
        id: ORGANIZATION_ID,
        name: "Pilot Chemistry Lab",
        slug: "pilot-chemistry-lab",
        isActive: false,
      });

      expect(result.counts.users).toBe(4);
      expect(result.counts.projects).toBe(3);
      expect(result.counts.attachments).toBe(2);

      expect(mockModels.User.count).toHaveBeenCalledWith({
        where: {
          organizationId: ORGANIZATION_ID,
        },
        transaction: undefined,
      });
    });

    it("rejects an unknown organization", async () => {
      mockModels.Organization.findByPk.mockResolvedValue(null);

      await expect(
        getOrganizationDeletionInventory({
          organizationId: ORGANIZATION_ID,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_NOT_FOUND",
      });
    });
  });

  describe("deleteOrganizationDatabaseData", () => {
    it("refuses to delete attachment metadata before storage deletion is confirmed", async () => {
      mockModels.Attachment.count.mockResolvedValue(2);

      await expect(
        deleteOrganizationDatabaseData({
          organizationId: ORGANIZATION_ID,
        }),
      ).rejects.toMatchObject({
        code: "ATTACHMENT_STORAGE_DELETION_NOT_CONFIRMED",
      });

      expect(mockModels.Attachment.destroy).not.toHaveBeenCalled();
      expect(mockModels.Organization.destroy).not.toHaveBeenCalled();
    });

    it("deletes organization-owned rows and the organization in one transaction", async () => {
      mockModels.Attachment.count.mockResolvedValue(2);

      const result = await deleteOrganizationDatabaseData({
        organizationId: ORGANIZATION_ID,
        attachmentStorageDeletionConfirmed: true,
      });

      expect(
        mockModels.Organization.sequelize.transaction,
      ).toHaveBeenCalledTimes(1);

      expect(mockModels.Organization.findByPk).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        {
          attributes: ["id", "name", "slug", "isActive"],
          transaction: mockTransaction,
          lock: mockTransaction.LOCK.UPDATE,
        },
      );

      for (const model of destroyModelsInOrder) {
        expect(model.destroy).toHaveBeenCalledWith({
          where: {
            organizationId: ORGANIZATION_ID,
          },
          transaction: mockTransaction,
        });
      }

      expect(mockModels.Organization.destroy).toHaveBeenCalledWith({
        where: {
          id: ORGANIZATION_ID,
        },
        transaction: mockTransaction,
      });

      expect(result).toEqual({
        organizationId: ORGANIZATION_ID,
        organizationName: "Pilot Chemistry Lab",
        organizationSlug: "pilot-chemistry-lab",
        deleted: {
          reviewEvents: 1,
          notebookEntries: 1,
          equipmentBookings: 1,
          projectMembers: 1,
          attachments: 1,
          invitations: 1,
          experiments: 1,
          tasks: 1,
          protocols: 1,
          equipment: 1,
          projects: 1,
          passwordResetTokens: 1,
          emailVerificationTokens: 1,
          auditLogs: 1,
          users: 1,
          organizations: 1,
        },
      });
    });

    it("allows database deletion with no attachment confirmation when the organization has no attachments", async () => {
      mockModels.Attachment.count.mockResolvedValue(0);

      await expect(
        deleteOrganizationDatabaseData({
          organizationId: ORGANIZATION_ID,
        }),
      ).resolves.toMatchObject({
        organizationId: ORGANIZATION_ID,
      });

      expect(mockModels.Organization.destroy).toHaveBeenCalledTimes(1);
    });

    it("rejects an unknown organization", async () => {
      mockModels.Organization.findByPk.mockResolvedValue(null);

      await expect(
        deleteOrganizationDatabaseData({
          organizationId: ORGANIZATION_ID,
          attachmentStorageDeletionConfirmed: true,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_NOT_FOUND",
      });

      expect(mockModels.Organization.destroy).not.toHaveBeenCalled();
    });

    it("fails if the organization row is not deleted exactly once", async () => {
      mockModels.Organization.destroy.mockResolvedValue(0);

      await expect(
        deleteOrganizationDatabaseData({
          organizationId: ORGANIZATION_ID,
          attachmentStorageDeletionConfirmed: true,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_DELETE_COUNT_MISMATCH",
      });
    });
  });
});
