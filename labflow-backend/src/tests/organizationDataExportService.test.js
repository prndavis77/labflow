const mockTransaction = {};

const createExportModelMock = () => ({
  findAll: jest.fn(),
});

const mockModels = {
  Attachment: createExportModelMock(),
  AuditLog: createExportModelMock(),
  Equipment: createExportModelMock(),
  EquipmentBooking: createExportModelMock(),
  Experiment: createExportModelMock(),
  Invitation: createExportModelMock(),
  NotebookEntry: createExportModelMock(),
  Organization: {
    findByPk: jest.fn(),
    sequelize: {
      transaction: jest.fn(),
    },
  },
  Project: createExportModelMock(),
  ProjectMember: createExportModelMock(),
  Protocol: createExportModelMock(),
  ReviewEvent: createExportModelMock(),
  Task: createExportModelMock(),
  User: createExportModelMock(),
};

jest.mock("../models", () => mockModels);

const {
  ORGANIZATION_EXPORT_ATTRIBUTES,
} = require("../config/organizationDataExportPolicy");

const {
  EXPORT_DATASETS,
  OrganizationDataExportError,
  exportOrganizationDatabaseData,
  validateOrganizationId,
} = require("../services/organizationDataExportService");

const ORGANIZATION_ID = 17;

const mockOrganization = {
  id: ORGANIZATION_ID,
  name: "Pilot Chemistry Lab",
  slug: "pilot-chemistry-lab",
  type: "lab",
  isActive: true,
  offboardingFrozenAt: null,
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  updatedAt: new Date("2026-08-01T10:00:00.000Z"),
};

describe("organizationDataExportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockModels.Organization.sequelize.transaction.mockImplementation(
      async (options, callback) => callback(mockTransaction),
    );

    mockModels.Organization.findByPk.mockResolvedValue(mockOrganization);

    for (const { model } of EXPORT_DATASETS) {
      model.findAll.mockResolvedValue([]);
    }
  });

  describe("validateOrganizationId", () => {
    it("accepts a positive integer or numeric string", () => {
      expect(validateOrganizationId(17)).toBe(17);
      expect(validateOrganizationId("17")).toBe(17);
    });

    it.each([undefined, null, "", 0, -1, 1.5, "abc"])(
      "rejects invalid organization id %p",
      (value) => {
        expect(() => validateOrganizationId(value)).toThrow(
          OrganizationDataExportError,
        );
      },
    );
  });

  it("rejects an unknown organization", async () => {
    mockModels.Organization.findByPk.mockResolvedValue(null);

    await expect(
      exportOrganizationDatabaseData({
        organizationId: ORGANIZATION_ID,
      }),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_NOT_FOUND",
    });
  });

  it("queries every exported dataset using the organization scope and explicit attributes", async () => {
    await exportOrganizationDatabaseData({
      organizationId: ORGANIZATION_ID,
    });

    expect(mockModels.Organization.findByPk).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      {
        attributes: ORGANIZATION_EXPORT_ATTRIBUTES.organization,
        transaction: mockTransaction,
        raw: true,
      },
    );

    for (const { key, model } of EXPORT_DATASETS) {
      expect(model.findAll).toHaveBeenCalledWith({
        attributes: ORGANIZATION_EXPORT_ATTRIBUTES[key],
        where: {
          organizationId: ORGANIZATION_ID,
        },
        order: [["id", "ASC"]],
        transaction: mockTransaction,
        raw: true,
      });
    }
  });

  it("returns organization data, dataset rows, and record counts", async () => {
    mockModels.User.findAll.mockResolvedValue([
      {
        id: 1,
        name: "Admin User",
        organizationId: ORGANIZATION_ID,
      },
      {
        id: 2,
        name: "Researcher User",
        organizationId: ORGANIZATION_ID,
      },
    ]);

    mockModels.Project.findAll.mockResolvedValue([
      {
        id: 9,
        title: "Method Validation",
        organizationId: ORGANIZATION_ID,
      },
    ]);

    const result = await exportOrganizationDatabaseData({
      organizationId: ORGANIZATION_ID,
    });

    expect(result).toMatchObject({
      exportVersion: 1,
      organizationId: ORGANIZATION_ID,
      organization: mockOrganization,
      recordCounts: {
        users: 2,
        projects: 1,
      },
    });

    expect(result.exportedAt).toEqual(expect.any(String));

    expect(result.data.users).toHaveLength(2);
    expect(result.data.projects).toHaveLength(1);
  });

  it("does not include authentication-token datasets", () => {
    const exportedKeys = EXPORT_DATASETS.map(({ key }) => key);

    expect(exportedKeys).not.toContain("passwordResetTokens");
    expect(exportedKeys).not.toContain("emailVerificationTokens");
  });
});
