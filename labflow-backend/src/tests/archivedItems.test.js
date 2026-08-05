jest.mock("../storage/attachmentStorage", () => ({
  getAttachmentStorage: jest.fn(),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");

const {
  Attachment,
  AuditLog,
  Experiment,
  Organization,
  Project,
  Protocol,
  Task,
  User,
} = require("../models");

const { resetTestDatabase } = require("./helpers/dbHelpers");

const { getOrCreateTestOrganization } = require("./helpers/testHelpers");

const { getAttachmentStorage } = require("../storage/attachmentStorage");

const PASSWORD = "password123";
const ARCHIVED_ITEMS_URL = "/api/admin/archived-items";

const mockAttachmentStorage = {
  getObjectMetadata: jest.fn(),
};

const createUser = async ({ name, email, role, organizationId }) => {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);

  return User.create({
    name,
    email,
    passwordHash,
    role,
    department: "Testing",
    organizationId,
    isActive: true,
    canCreateExperiments: true,
    canEditExperiments: true,
    canCreateProtocols: true,
    canEditProtocols: true,
    requiresReview: true,
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
};

const loginAndGetToken = async (email) => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email,
      password: PASSWORD,
    })
    .expect(200);

  return response.body.data.token;
};

const getArchivedItems = ({ token, query = "" }) =>
  request(app)
    .get(`${ARCHIVED_ITEMS_URL}${query}`)
    .set("Authorization", `Bearer ${token}`);

const restoreArchivedItem = ({ token, entityType, id }) =>
  request(app)
    .post(`${ARCHIVED_ITEMS_URL}/${entityType}/${id}/restore`)
    .set("Authorization", `Bearer ${token}`);

const createArchivedAttachment = async ({
  organizationId,
  uploadedById,
  entityType,
  entityId,
  archivedById,
  originalFileName = "restorable-results.csv",
  uploadStatus = "available",
  storageKey,
}) =>
  Attachment.create({
    organizationId,
    uploadedById,
    originalFileName,
    fileName: originalFileName,
    fileExtension: ".csv",
    mimeType: "text/csv",
    fileSize: 256,
    verifiedFileSize: uploadStatus === "available" ? 256 : null,
    storageProvider: "r2",
    storageKey:
      storageKey ||
      `organizations/${organizationId}/archived/${originalFileName}`,
    checksum: uploadStatus === "available" ? "test-attachment-checksum" : null,
    etag: uploadStatus === "available" ? "test-attachment-etag" : null,
    entityType,
    entityId,
    category: "raw_data",
    description: "Archived attachment restoration test.",
    uploadStatus,
    uploadExpiresAt:
      uploadStatus === "pending" ? new Date("2026-08-01T10:00:00.000Z") : null,
    isArchived: true,
    archivedAt: new Date("2026-07-15T10:00:00.000Z"),
    archivedById,
  });

describe("Archived Items API", () => {
  let organization;
  let otherOrganization;

  let admin;
  let secondAdmin;
  let researcher;

  let adminToken;
  let researcherToken;

  let project;
  let activeProject;
  let otherOrganizationProject;

  let archivedTask;
  let archivedExperiment;
  let archivedProtocol;
  let archivedAttachment;

  let archivedStandaloneTask;
  let archivedGeneralProtocol;

  const archivedAt = new Date("2026-07-15T10:00:00.000Z");

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    jest.clearAllMocks();

    mockAttachmentStorage.getObjectMetadata.mockResolvedValue({
      contentLength: 256,
      contentType: "text/csv",
      etag: "verified-etag",
    });

    getAttachmentStorage.mockReturnValue(mockAttachmentStorage);

    organization = await getOrCreateTestOrganization();

    [otherOrganization] = await Organization.findOrCreate({
      where: {
        slug: "other-archived-items-lab",
      },
      defaults: {
        name: "Other Archived Items Lab",
        type: "lab",
      },
    });

    admin = await createUser({
      name: "Archived Items Admin",
      email: "admin.archived-items@example.com",
      role: "admin",
      organizationId: organization.id,
    });

    secondAdmin = await createUser({
      name: "Second Archive Admin",
      email: "second-admin.archived-items@example.com",
      role: "admin",
      organizationId: organization.id,
    });

    researcher = await createUser({
      name: "Archived Items Researcher",
      email: "researcher.archived-items@example.com",
      role: "researcher",
      organizationId: organization.id,
    });

    const otherOrganizationAdmin = await createUser({
      name: "Other Organization Admin",
      email: "other-admin.archived-items@example.com",
      role: "admin",
      organizationId: otherOrganization.id,
    });

    project = await Project.create({
      title: "Archived Stability Project",
      description: "Archived project used by the listing tests.",
      status: "active",
      supervisorId: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt,
      archivedById: admin.id,
      archiveReason: "Test archive reason",
    });

    activeProject = await Project.create({
      title: "Active Stability Project",
      description: "This project must not appear in archived results.",
      status: "active",
      supervisorId: admin.id,
      organizationId: organization.id,
      isArchived: false,
    });

    otherOrganizationProject = await Project.create({
      title: "Other Organization Archived Project",
      status: "active",
      supervisorId: otherOrganizationAdmin.id,
      organizationId: otherOrganization.id,
      isArchived: true,
      archivedAt,
      archivedById: otherOrganizationAdmin.id,
      archiveReason: "Other organization",
    });

    archivedTask = await Task.create({
      title: "Archived Calibration Task",
      description: "Prepare archived calibration standards.",
      status: "todo",
      priority: "high",
      projectId: project.id,
      assignedToId: researcher.id,
      createdById: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt,
      archivedById: admin.id,
      archiveReason: "Task no longer required",
    });

    await Task.create({
      title: "Active Calibration Task",
      status: "todo",
      priority: "medium",
      projectId: activeProject.id,
      assignedToId: researcher.id,
      createdById: admin.id,
      organizationId: organization.id,
      isArchived: false,
    });

    archivedStandaloneTask = await Task.create({
      title: "Archived Standalone Cleanup Task",
      status: "todo",
      priority: "low",
      projectId: null,
      assignedToId: researcher.id,
      createdById: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt: new Date("2026-07-20T10:00:00.000Z"),
      archivedById: secondAdmin.id,
      archiveReason: "Standalone test record",
    });

    archivedProtocol = await Protocol.create({
      title: "Archived HPLC Protocol",
      version: "1.0",
      purpose: "Archived protocol listing test.",
      content: "Archived protocol content.",
      approvalStatus: "draft",
      reviewStatus: "not_submitted",
      projectId: project.id,
      equipmentId: null,
      createdById: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt,
      archivedById: admin.id,
      archiveReason: "Protocol replaced",
    });

    archivedGeneralProtocol = await Protocol.create({
      title: "Archived General Laboratory SOP",
      version: "2.0",
      purpose: "General archived protocol restoration test.",
      content: "General archived protocol content.",
      approvalStatus: "approved",
      reviewStatus: "approved",
      projectId: null,
      equipmentId: null,
      createdById: admin.id,
      approvedById: admin.id,
      approvedAt: new Date("2026-07-10T10:00:00.000Z"),
      organizationId: organization.id,
      isArchived: true,
      archivedAt,
      archivedById: admin.id,
      archiveReason: "Temporarily withdrawn",
    });

    archivedExperiment = await Experiment.create({
      title: "Archived HPLC Experiment",
      objective: "Verify archived experiment listing.",
      notes: "Archived experiment notes.",
      status: "planned",
      reviewStatus: "not_submitted",
      projectId: project.id,
      researcherId: researcher.id,
      taskId: archivedTask.id,
      protocolId: archivedProtocol.id,
      createdById: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt,
      archivedById: admin.id,
      archiveReason: "Experiment cancelled",
    });

    archivedAttachment = await Attachment.create({
      organizationId: organization.id,
      uploadedById: researcher.id,
      originalFileName: "archived-results.csv",
      fileName: "archived-results.csv",
      fileExtension: ".csv",
      mimeType: "text/csv",
      fileSize: 256,
      verifiedFileSize: 256,
      storageProvider: "r2",
      storageKey:
        `organizations/${organization.id}/projects/` +
        `${project.id}/archived-results.csv`,
      checksum: "private-test-checksum",
      etag: "private-test-etag",
      entityType: "project",
      entityId: project.id,
      category: "raw_data",
      description: "Archived attachment listing test.",
      uploadStatus: "available",
      uploadExpiresAt: null,
      isArchived: true,
      archivedAt,
      archivedById: admin.id,
    });

    await Attachment.create({
      organizationId: organization.id,
      uploadedById: researcher.id,
      originalFileName: "active-results.csv",
      fileName: "active-results.csv",
      fileExtension: ".csv",
      mimeType: "text/csv",
      fileSize: 128,
      verifiedFileSize: 128,
      storageProvider: "r2",
      storageKey:
        `organizations/${organization.id}/projects/` +
        `${activeProject.id}/active-results.csv`,
      entityType: "project",
      entityId: activeProject.id,
      category: "raw_data",
      uploadStatus: "available",
      isArchived: false,
    });

    const createArchivedAttachment = async ({
      organizationId,
      uploadedById,
      entityType,
      entityId,
      archivedById,
      originalFileName = "restorable-results.csv",
      uploadStatus = "available",
      storageKey,
    }) =>
      Attachment.create({
        organizationId,
        uploadedById,
        originalFileName,
        fileName: originalFileName,
        fileExtension: ".csv",
        mimeType: "text/csv",
        fileSize: 256,
        verifiedFileSize: uploadStatus === "available" ? 256 : null,
        storageProvider: "r2",
        storageKey:
          storageKey ||
          `organizations/${organizationId}/archived/` + `${originalFileName}`,
        checksum:
          uploadStatus === "available" ? "test-attachment-checksum" : null,
        etag: uploadStatus === "available" ? "test-attachment-etag" : null,
        entityType,
        entityId,
        category: "raw_data",
        description: "Archived attachment restoration test.",
        uploadStatus,
        uploadExpiresAt:
          uploadStatus === "pending"
            ? new Date("2026-08-01T10:00:00.000Z")
            : null,
        isArchived: true,
        archivedAt: new Date("2026-07-15T10:00:00.000Z"),
        archivedById,
      });

    adminToken = await loginAndGetToken("admin.archived-items@example.com");

    researcherToken = await loginAndGetToken(
      "researcher.archived-items@example.com",
    );
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .get(`${ARCHIVED_ITEMS_URL}?entityType=project`)
      .expect(401);

    expect(response.body.status).toBe("error");
  });

  it("allows admins to list archived projects", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=project",
    }).expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.data.entityType).toBe("project");
    expect(response.body.data.items).toHaveLength(1);

    expect(response.body.data.items[0]).toMatchObject({
      id: project.id,
      title: "Archived Stability Project",
      isArchived: true,
      archivedById: admin.id,
    });

    expect(response.body.data.items[0].supervisor).toMatchObject({
      id: admin.id,
      name: "Archived Items Admin",
    });

    expect(response.body.data.items[0].archivedBy).toMatchObject({
      id: admin.id,
      name: "Archived Items Admin",
    });
  });

  it("blocks non-admin users", async () => {
    const response = await getArchivedItems({
      token: researcherToken,
      query: "?entityType=project",
    }).expect(403);

    expect(response.body.status).toBe("error");
  });

  it("returns records only from the authenticated admin's organization", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=project",
    }).expect(200);

    const returnedIds = response.body.data.items.map((item) => item.id);

    expect(returnedIds).toContain(project.id);
    expect(returnedIds).not.toContain(otherOrganizationProject.id);
  });

  it("does not return active records", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=project",
    }).expect(200);

    const returnedIds = response.body.data.items.map((item) => item.id);

    expect(returnedIds).toContain(project.id);
    expect(returnedIds).not.toContain(activeProject.id);
  });

  it.each([
    {
      entityType: "project",
      expectedId: () => project.id,
      expectedLabel: "Archived Stability Project",
      labelField: "title",
    },
    {
      entityType: "task",
      expectedId: () => archivedTask.id,
      expectedLabel: "Archived Calibration Task",
      labelField: "title",
    },
    {
      entityType: "experiment",
      expectedId: () => archivedExperiment.id,
      expectedLabel: "Archived HPLC Experiment",
      labelField: "title",
    },
    {
      entityType: "protocol",
      expectedId: () => archivedProtocol.id,
      expectedLabel: "Archived HPLC Protocol",
      labelField: "title",
    },
    {
      entityType: "attachment",
      expectedId: () => archivedAttachment.id,
      expectedLabel: "archived-results.csv",
      labelField: "originalFileName",
    },
  ])(
    "lists archived $entityType records",
    async ({ entityType, expectedId, expectedLabel, labelField }) => {
      const response = await getArchivedItems({
        token: adminToken,
        query: `?entityType=${entityType}`,
      }).expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.entityType).toBe(entityType);

      const matchingItem = response.body.data.items.find(
        (item) => String(item.id) === String(expectedId()),
      );

      expect(matchingItem).toBeDefined();
      expect(matchingItem[labelField]).toBe(expectedLabel);
      expect(matchingItem.isArchived).toBe(true);
    },
  );

  it("filters archived records by search text", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=task&search=Calibration",
    }).expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(archivedTask.id);
  });

  it("returns no records when search text does not match", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=experiment&search=DoesNotExist",
    }).expect(200);

    expect(response.body.data.items).toHaveLength(0);
    expect(response.body.data.pagination.total).toBe(0);
  });

  it("filters supported child entities by projectId", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: `?entityType=task&projectId=${project.id}`,
    }).expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: archivedTask.id,
      projectId: project.id,
    });
  });

  it("filters archived records by archivedById", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: `?entityType=task&archivedById=${secondAdmin.id}`,
    }).expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      title: "Archived Standalone Cleanup Task",
      archivedById: secondAdmin.id,
    });
  });

  it("filters archived records by archived date range", async () => {
    const includedResponse = await getArchivedItems({
      token: adminToken,
      query:
        "?entityType=project" +
        "&archivedFrom=2026-07-15" +
        "&archivedTo=2026-07-15",
    }).expect(200);

    expect(includedResponse.body.data.items).toHaveLength(1);
    expect(includedResponse.body.data.items[0].id).toBe(project.id);

    const excludedResponse = await getArchivedItems({
      token: adminToken,
      query:
        "?entityType=project" +
        "&archivedFrom=2026-07-16" +
        "&archivedTo=2026-07-31",
    }).expect(200);

    expect(excludedResponse.body.data.items).toHaveLength(0);
  });

  it("returns pagination metadata", async () => {
    await Project.create({
      title: "Second Archived Project",
      status: "planning",
      supervisorId: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt: new Date("2026-07-16T10:00:00.000Z"),
      archivedById: admin.id,
    });

    await Project.create({
      title: "Third Archived Project",
      status: "planning",
      supervisorId: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt: new Date("2026-07-17T10:00:00.000Z"),
      archivedById: admin.id,
    });

    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=project&page=1&limit=2",
    }).expect(200);

    expect(response.body.data.items).toHaveLength(2);

    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("orders archived records by archivedAt descending", async () => {
    const newerProject = await Project.create({
      title: "More Recently Archived Project",
      status: "active",
      supervisorId: admin.id,
      organizationId: organization.id,
      isArchived: true,
      archivedAt: new Date("2026-07-25T10:00:00.000Z"),
      archivedById: admin.id,
    });

    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=project",
    }).expect(200);

    expect(response.body.data.items[0].id).toBe(newerProject.id);

    expect(response.body.data.items[1].id).toBe(project.id);
  });

  it("does not expose private attachment storage fields", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=attachment",
    }).expect(200);

    expect(response.body.data.items).toHaveLength(1);

    const attachment = response.body.data.items[0];

    expect(attachment.id).toBe(archivedAttachment.id);
    expect(attachment.originalFileName).toBe("archived-results.csv");

    expect(attachment).not.toHaveProperty("storageKey");
    expect(attachment).not.toHaveProperty("checksum");
    expect(attachment).not.toHaveProperty("etag");
    expect(attachment).not.toHaveProperty("uploadExpiresAt");
  });

  it("requires entityType", async () => {
    const response = await getArchivedItems({
      token: adminToken,
    }).expect(400);

    expect(response.body).toMatchObject({
      status: "error",
      message: "entityType is required.",
      code: "ENTITY_TYPE_REQUIRED",
    });
  });

  it("rejects unsupported entity types", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: "?entityType=equipment",
    }).expect(400);

    expect(response.body).toMatchObject({
      status: "error",
      message: "Unsupported archived item type.",
      code: "INVALID_ENTITY_TYPE",
    });
  });

  it.each([
    {
      query: "?entityType=project&page=0",
      code: "INVALID_PAGE",
    },
    {
      query: "?entityType=project&page=abc",
      code: "INVALID_PAGE",
    },
    {
      query: "?entityType=project&limit=0",
      code: "INVALID_LIMIT",
    },
    {
      query: "?entityType=project&limit=101",
      code: "INVALID_LIMIT",
    },
    {
      query: "?entityType=project&archivedById=invalid",
      code: "INVALID_ARCHIVED_BY_ID",
    },
    {
      query: "?entityType=task&projectId=invalid",
      code: "INVALID_PROJECT_ID",
    },
    {
      query: "?entityType=project&archivedFrom=07-01-2026",
      code: "INVALID_ARCHIVED_FROM",
    },
    {
      query: "?entityType=project&archivedTo=07-31-2026",
      code: "INVALID_ARCHIVED_TO",
    },
  ])("rejects invalid query values: $query", async ({ query, code }) => {
    const response = await getArchivedItems({
      token: adminToken,
      query,
    }).expect(400);

    expect(response.body.status).toBe("error");
    expect(response.body.code).toBe(code);
  });

  it("rejects projectId for unsupported entity types", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query: `?entityType=project&projectId=${project.id}`,
    }).expect(400);

    expect(response.body).toMatchObject({
      status: "error",
      code: "PROJECT_FILTER_NOT_SUPPORTED",
    });
  });

  it("rejects an inverted archived date range", async () => {
    const response = await getArchivedItems({
      token: adminToken,
      query:
        "?entityType=project" +
        "&archivedFrom=2026-07-20" +
        "&archivedTo=2026-07-10",
    }).expect(400);

    expect(response.body).toMatchObject({
      status: "error",
      code: "INVALID_ARCHIVED_DATE_RANGE",
    });
  });

  it("returns a safe error response when the query fails", async () => {
    const querySpy = jest
      .spyOn(Project, "findAndCountAll")
      .mockRejectedValueOnce(
        new Error("Simulated archived-item query failure"),
      );

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await getArchivedItems({
        token: adminToken,
        query: "?entityType=project",
      }).expect(500);

      expect(response.body).toEqual({
        status: "error",
        message: "An error occurred while fetching archived items.",
      });
    } finally {
      querySpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  describe("Archived item restoration", () => {
    it("requires authentication to restore an item", async () => {
      const response = await request(app)
        .post(`${ARCHIVED_ITEMS_URL}/project/${project.id}/restore`)
        .expect(401);

      expect(response.body.status).toBe("error");
    });

    it("blocks non-admin users from restoring an item", async () => {
      const response = await restoreArchivedItem({
        token: researcherToken,
        entityType: "project",
        id: project.id,
      }).expect(403);

      expect(response.body.status).toBe("error");

      const unchangedProject = await Project.findByPk(project.id);

      expect(unchangedProject.isArchived).toBe(true);
    });

    it("restores an archived project without changing its business status", async () => {
      const originalStatus = project.status;

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      expect(response.body).toMatchObject({
        status: "success",
        message: "Project restored successfully.",
        data: {
          restored: true,
          entityType: "project",
        },
      });

      const restoredProject = await Project.findByPk(project.id);

      expect(restoredProject.isArchived).toBe(false);
      expect(restoredProject.archivedAt).toBeNull();
      expect(restoredProject.archivedById).toBeNull();
      expect(restoredProject.archiveReason).toBeNull();
      expect(restoredProject.status).toBe(originalStatus);
    });

    it("does not automatically restore archived child records when restoring a project", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const [
        unchangedTask,
        unchangedExperiment,
        unchangedProtocol,
        unchangedAttachment,
      ] = await Promise.all([
        Task.findByPk(archivedTask.id),
        Experiment.findByPk(archivedExperiment.id),
        Protocol.findByPk(archivedProtocol.id),
        Attachment.findByPk(archivedAttachment.id),
      ]);

      expect(unchangedTask.isArchived).toBe(true);
      expect(unchangedExperiment.isArchived).toBe(true);
      expect(unchangedProtocol.isArchived).toBe(true);
      expect(unchangedAttachment.isArchived).toBe(true);
    });

    it("creates a project restoration audit event", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const auditLog = await AuditLog.findOne({
        where: {
          action: "project.restored",
          entityType: "project",
          entityId: project.id,
          organizationId: organization.id,
        },
      });

      expect(auditLog).not.toBeNull();

      expect(auditLog).toMatchObject({
        actorUserId: admin.id,
        organizationId: organization.id,
        action: "project.restored",
        entityType: "project",
        entityId: project.id,
        summary: 'Restored project "Archived Stability Project".',
      });

      expect(auditLog.metadata).toMatchObject({
        title: "Archived Stability Project",
        previousArchivedById: admin.id,
        previousArchiveReason: "Test archive reason",
        supervisorId: admin.id,
      });

      expect(auditLog.metadata.previousArchivedAt).toBeTruthy();
    });

    it("rejects restoring a project-linked task while its project is archived", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(409);

      expect(response.body).toMatchObject({
        status: "error",
        code: "ARCHIVED_PARENT",
      });

      const unchangedTask = await Task.findByPk(archivedTask.id);

      expect(unchangedTask.isArchived).toBe(true);

      const auditCount = await AuditLog.count({
        where: {
          action: "task.restored",
          entityId: archivedTask.id,
        },
      });

      expect(auditCount).toBe(0);
    });

    it("restores a project-linked task after its parent project is active", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const originalStatus = archivedTask.status;
      const originalAssignedToId = archivedTask.assignedToId;

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(200);

      expect(response.body.data).toMatchObject({
        restored: true,
        entityType: "task",
      });

      const restoredTask = await Task.findByPk(archivedTask.id);

      expect(restoredTask.isArchived).toBe(false);
      expect(restoredTask.archivedAt).toBeNull();
      expect(restoredTask.archivedById).toBeNull();
      expect(restoredTask.archiveReason).toBeNull();
      expect(restoredTask.status).toBe(originalStatus);
      expect(restoredTask.assignedToId).toBe(originalAssignedToId);

      const auditLog = await AuditLog.findOne({
        where: {
          action: "task.restored",
          entityType: "task",
          entityId: archivedTask.id,
        },
      });

      expect(auditLog).not.toBeNull();

      expect(auditLog.metadata).toMatchObject({
        projectId: project.id,
        assignedToId: researcher.id,
        createdById: admin.id,
      });
    });

    it("restores an archived standalone task without a project check", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedStandaloneTask.id,
      }).expect(200);

      expect(response.body.data).toMatchObject({
        restored: true,
        entityType: "task",
      });

      const restoredTask = await Task.findByPk(archivedStandaloneTask.id);

      expect(restoredTask.isArchived).toBe(false);
      expect(restoredTask.projectId).toBeNull();
      expect(restoredTask.assignedToId).toBe(researcher.id);
    });

    it("rejects restoring an experiment while its project is archived", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "experiment",
        id: archivedExperiment.id,
      }).expect(409);

      expect(response.body).toMatchObject({
        status: "error",
        code: "ARCHIVED_PARENT",
      });

      const unchangedExperiment = await Experiment.findByPk(
        archivedExperiment.id,
      );

      expect(unchangedExperiment.isArchived).toBe(true);
    });

    it("restores an experiment after its project is active and preserves workflow fields", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const originalStatus = archivedExperiment.status;
      const originalReviewStatus = archivedExperiment.reviewStatus;
      const originalResearcherId = archivedExperiment.researcherId;

      await restoreArchivedItem({
        token: adminToken,
        entityType: "experiment",
        id: archivedExperiment.id,
      }).expect(200);

      const restoredExperiment = await Experiment.findByPk(
        archivedExperiment.id,
      );

      expect(restoredExperiment.isArchived).toBe(false);
      expect(restoredExperiment.status).toBe(originalStatus);
      expect(restoredExperiment.reviewStatus).toBe(originalReviewStatus);
      expect(restoredExperiment.researcherId).toBe(originalResearcherId);
      expect(restoredExperiment.projectId).toBe(project.id);

      const auditLog = await AuditLog.findOne({
        where: {
          action: "experiment.restored",
          entityType: "experiment",
          entityId: archivedExperiment.id,
        },
      });

      expect(auditLog).not.toBeNull();
    });

    it("rejects restoring a project-linked protocol while its project is archived", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "protocol",
        id: archivedProtocol.id,
      }).expect(409);

      expect(response.body).toMatchObject({
        status: "error",
        code: "ARCHIVED_PARENT",
      });

      const unchangedProtocol = await Protocol.findByPk(archivedProtocol.id);

      expect(unchangedProtocol.isArchived).toBe(true);
    });

    it("restores an archived general protocol without a parent project", async () => {
      const originalApprovalStatus = archivedGeneralProtocol.approvalStatus;
      const originalReviewStatus = archivedGeneralProtocol.reviewStatus;
      const originalApprovedById = archivedGeneralProtocol.approvedById;

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "protocol",
        id: archivedGeneralProtocol.id,
      }).expect(200);

      expect(response.body.data).toMatchObject({
        restored: true,
        entityType: "protocol",
      });

      const restoredProtocol = await Protocol.findByPk(
        archivedGeneralProtocol.id,
      );

      expect(restoredProtocol.isArchived).toBe(false);
      expect(restoredProtocol.projectId).toBeNull();
      expect(restoredProtocol.approvalStatus).toBe(originalApprovalStatus);
      expect(restoredProtocol.reviewStatus).toBe(originalReviewStatus);
      expect(restoredProtocol.approvedById).toBe(originalApprovedById);

      const auditLog = await AuditLog.findOne({
        where: {
          action: "protocol.restored",
          entityType: "protocol",
          entityId: archivedGeneralProtocol.id,
        },
      });

      expect(auditLog).not.toBeNull();
    });

    it("does not reveal or restore a record from another organization", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: otherOrganizationProject.id,
      }).expect(404);

      expect(response.body).toMatchObject({
        status: "error",
        code: "ARCHIVED_ITEM_NOT_FOUND",
      });

      const unchangedProject = await Project.findByPk(
        otherOrganizationProject.id,
      );

      expect(unchangedProject.isArchived).toBe(true);
    });

    it("rejects an unsupported restoration entity type", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "equipment",
        id: project.id,
      }).expect(400);

      expect(response.body).toMatchObject({
        status: "error",
        message: "Unsupported archived item type for restoration.",
        code: "INVALID_ENTITY_TYPE",
      });
    });

    it.each(["0", "-1", "abc", "1.5"])(
      "rejects invalid archived item ID %s",
      async (invalidId) => {
        const response = await restoreArchivedItem({
          token: adminToken,
          entityType: "project",
          id: invalidId,
        }).expect(400);

        expect(response.body).toMatchObject({
          status: "error",
          code: "INVALID_ENTITY_ID",
        });
      },
    );

    it("returns 404 when the requested record does not exist", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: 999999,
      }).expect(404);

      expect(response.body).toMatchObject({
        status: "error",
        message: "Project not found.",
        code: "ARCHIVED_ITEM_NOT_FOUND",
      });
    });

    it("returns an idempotent response for an already-active record without creating an audit event", async () => {
      const auditCountBefore = await AuditLog.count({
        where: {
          action: "project.restored",
          entityType: "project",
          entityId: activeProject.id,
        },
      });

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: activeProject.id,
      }).expect(200);

      expect(response.body).toMatchObject({
        status: "success",
        message: "The project is already active.",
        data: {
          restored: false,
          entityType: "project",
        },
      });

      const auditCountAfter = await AuditLog.count({
        where: {
          action: "project.restored",
          entityType: "project",
          entityId: activeProject.id,
        },
      });

      expect(auditCountAfter).toBe(auditCountBefore);
    });

    it("rolls back restoration when audit log creation fails", async () => {
      const auditSpy = jest
        .spyOn(AuditLog, "create")
        .mockRejectedValueOnce(new Error("Simulated restore audit failure"));

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const response = await restoreArchivedItem({
          token: adminToken,
          entityType: "project",
          id: project.id,
        }).expect(500);

        expect(response.body).toEqual({
          status: "error",
          message: "An error occurred while restoring the archived item.",
        });

        const unchangedProject = await Project.findByPk(project.id);

        expect(unchangedProject.isArchived).toBe(true);
        expect(unchangedProject.archivedAt).not.toBeNull();
        expect(unchangedProject.archivedById).toBe(admin.id);
        expect(unchangedProject.archiveReason).toBe("Test archive reason");

        const auditCount = await AuditLog.count({
          where: {
            action: "project.restored",
            entityType: "project",
            entityId: project.id,
          },
        });

        expect(auditCount).toBe(0);
      } finally {
        auditSpy.mockRestore();
        consoleSpy.mockRestore();
      }
    });
  });

  describe("Attachment restoration", () => {
    it("restores an available attachment when its linked record and R2 object exist", async () => {
      /*
       * The main attachment is linked to the archived project.
       * Restore the project first so the attachment is eligible.
       */
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: archivedAttachment.id,
      }).expect(200);

      expect(response.body).toMatchObject({
        status: "success",
        message: "Attachment restored successfully.",
        data: {
          restored: true,
          entityType: "attachment",
          item: {
            id: archivedAttachment.id,
            originalFileName: "archived-results.csv",
            entityType: "project",
            entityId: project.id,
            isArchived: false,
          },
        },
      });

      expect(mockAttachmentStorage.getObjectMetadata).toHaveBeenCalledTimes(1);

      expect(mockAttachmentStorage.getObjectMetadata).toHaveBeenCalledWith({
        storageKey: archivedAttachment.storageKey,
      });

      const restoredAttachment = await Attachment.findByPk(
        archivedAttachment.id,
      );

      expect(restoredAttachment.isArchived).toBe(false);
      expect(restoredAttachment.archivedAt).toBeNull();
      expect(restoredAttachment.archivedById).toBeNull();

      /*
       * Restoration must not change storage or linkage fields.
       */
      expect(restoredAttachment.storageKey).toBe(archivedAttachment.storageKey);

      expect(restoredAttachment.entityType).toBe("project");

      expect(restoredAttachment.entityId).toBe(project.id);
    });

    it("does not expose private storage fields in a successful restore response", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: archivedAttachment.id,
      }).expect(200);

      const returnedAttachment = response.body.data.item;

      expect(returnedAttachment).not.toHaveProperty("storageKey");

      expect(returnedAttachment).not.toHaveProperty("checksum");

      expect(returnedAttachment).not.toHaveProperty("etag");

      expect(returnedAttachment.uploadExpiresAt).toBeNull();
    });

    it("creates an attachment restoration audit event", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: archivedAttachment.id,
      }).expect(200);

      const auditLog = await AuditLog.findOne({
        where: {
          action: "attachment.restored",
          entityType: "attachment",
          organizationId: organization.id,
        },
      });

      expect(auditLog).not.toBeNull();

      expect(auditLog).toMatchObject({
        actorUserId: admin.id,
        organizationId: organization.id,
        action: "attachment.restored",
        entityType: "attachment",
        entityId: null,
        summary: 'Restored attachment "archived-results.csv".',
      });

      expect(auditLog.metadata).toMatchObject({
        attachmentId: archivedAttachment.id,
        originalFileName: "archived-results.csv",
        attachmentEntityType: "project",
        attachmentEntityId: project.id,
        uploadedById: researcher.id,
        storageProvider: "r2",
        previousArchivedById: admin.id,
      });

      expect(auditLog.metadata.previousArchivedAt).toBeTruthy();

      expect(auditLog.metadata).not.toHaveProperty("storageKey");

      expect(auditLog.metadata).not.toHaveProperty("checksum");

      expect(auditLog.metadata).not.toHaveProperty("etag");
    });

    it("rejects attachment restoration while its linked record is archived", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: archivedAttachment.id,
      }).expect(409);

      expect(response.body).toMatchObject({
        status: "error",
        message: "Restore the linked record before restoring this attachment.",
        code: "ARCHIVED_PARENT",
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();

      const unchangedAttachment = await Attachment.findByPk(
        archivedAttachment.id,
      );

      expect(unchangedAttachment.isArchived).toBe(true);

      const auditCount = await AuditLog.count({
        where: {
          action: "attachment.restored",
        },
      });

      expect(auditCount).toBe(0);
    });

    it("rejects restoration when an active child record belongs to an archived project", async () => {
      /*
       * activeProject is normally active, so archive it without
       * archiving its task. This represents the non-cascading archive
       * behavior used by LabFlow.
       */
      activeProject.isArchived = true;
      activeProject.archivedAt = new Date("2026-07-20T10:00:00.000Z");
      activeProject.archivedById = admin.id;

      await activeProject.save();

      const activeTask = await Task.create({
        title: "Active Child of Archived Project",
        status: "todo",
        priority: "medium",
        projectId: activeProject.id,
        assignedToId: researcher.id,
        createdById: admin.id,
        organizationId: organization.id,
        isArchived: false,
      });

      const attachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "task",
        entityId: activeTask.id,
        archivedById: admin.id,
        originalFileName: "active-child-archived-project.csv",
      });

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: attachment.id,
      }).expect(409);

      expect(response.body).toMatchObject({
        status: "error",
        code: "ARCHIVED_PARENT",
        message:
          "Restore the linked record's project before restoring this attachment.",
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();
    });

    it("restores an attachment linked to an active standalone task", async () => {
      /*
       * archivedStandaloneTask is archived in the common fixture.
       * Activate it directly for this attachment-specific test.
       */
      archivedStandaloneTask.isArchived = false;
      archivedStandaloneTask.archivedAt = null;
      archivedStandaloneTask.archivedById = null;
      archivedStandaloneTask.archiveReason = null;

      await archivedStandaloneTask.save();

      const attachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "task",
        entityId: archivedStandaloneTask.id,
        archivedById: admin.id,
        originalFileName: "standalone-task-results.csv",
      });

      await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: attachment.id,
      }).expect(200);

      const restoredAttachment = await Attachment.findByPk(attachment.id);

      expect(restoredAttachment.isArchived).toBe(false);

      expect(mockAttachmentStorage.getObjectMetadata).toHaveBeenCalledWith({
        storageKey: attachment.storageKey,
      });
    });

    it("rejects restoration when the attachment upload is not available", async () => {
      const pendingAttachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "project",
        entityId: activeProject.id,
        archivedById: admin.id,
        originalFileName: "pending-results.csv",
        uploadStatus: "pending",
      });

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: pendingAttachment.id,
      }).expect(409);

      expect(response.body).toMatchObject({
        status: "error",
        message: "Only completed attachments can be restored.",
        code: "ATTACHMENT_NOT_AVAILABLE",
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();

      const unchangedAttachment = await Attachment.findByPk(
        pendingAttachment.id,
      );

      expect(unchangedAttachment.isArchived).toBe(true);
    });

    it("rejects restoration when the R2 object does not exist", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const storageError = new Error("The specified key does not exist.");

      storageError.name = "NoSuchKey";
      storageError.$metadata = {
        httpStatusCode: 404,
      };

      mockAttachmentStorage.getObjectMetadata.mockRejectedValueOnce(
        storageError,
      );

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const response = await restoreArchivedItem({
          token: adminToken,
          entityType: "attachment",
          id: archivedAttachment.id,
        }).expect(409);

        expect(response.body).toMatchObject({
          status: "error",
          message:
            "The stored file could not be found, so this attachment cannot be restored.",
          code: "STORAGE_OBJECT_MISSING",
        });

        const unchangedAttachment = await Attachment.findByPk(
          archivedAttachment.id,
        );

        expect(unchangedAttachment.isArchived).toBe(true);

        const auditCount = await AuditLog.count({
          where: {
            action: "attachment.restored",
          },
        });

        expect(auditCount).toBe(0);
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("returns 503 when R2 verification is temporarily unavailable", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      mockAttachmentStorage.getObjectMetadata.mockRejectedValueOnce(
        new Error("Temporary R2 connection failure"),
      );

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const response = await restoreArchivedItem({
          token: adminToken,
          entityType: "attachment",
          id: archivedAttachment.id,
        }).expect(503);

        expect(response.body).toEqual({
          status: "error",
          message: "File storage is temporarily unavailable.",
          code: "STORAGE_UNAVAILABLE",
        });

        const unchangedAttachment = await Attachment.findByPk(
          archivedAttachment.id,
        );

        expect(unchangedAttachment.isArchived).toBe(true);
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("rejects restoration when the linked record does not exist", async () => {
      const temporaryProject = await Project.create({
        title: "Temporary Attachment Target",
        status: "active",
        supervisorId: admin.id,
        organizationId: organization.id,
        isArchived: false,
      });

      const attachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "project",
        entityId: temporaryProject.id,
        archivedById: admin.id,
        originalFileName: "missing-target-results.csv",
      });

      await temporaryProject.destroy();

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: attachment.id,
      }).expect(409);

      expect(response.body).toMatchObject({
        status: "error",
        code: "ATTACHMENT_TARGET_NOT_FOUND",
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();
    });

    it("rejects attachment restoration for another organization without revealing the record", async () => {
      const otherOrganizationAdmin = await User.findOne({
        where: {
          email: "other-admin.archived-items@example.com",
        },
      });

      const otherAttachment = await createArchivedAttachment({
        organizationId: otherOrganization.id,
        uploadedById: otherOrganizationAdmin.id,
        entityType: "project",
        entityId: otherOrganizationProject.id,
        archivedById: otherOrganizationAdmin.id,
        originalFileName: "other-organization-results.csv",
      });

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: otherAttachment.id,
      }).expect(404);

      expect(response.body).toMatchObject({
        status: "error",
        message: "Attachment not found.",
        code: "ARCHIVED_ITEM_NOT_FOUND",
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();

      const unchangedAttachment = await Attachment.findByPk(otherAttachment.id);

      expect(unchangedAttachment.isArchived).toBe(true);
    });

    it("rejects an invalid attachment UUID", async () => {
      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: "not-a-valid-uuid",
      }).expect(400);

      expect(response.body).toMatchObject({
        status: "error",
        message: "The attachment ID is invalid.",
        code: "INVALID_ENTITY_ID",
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();
    });

    it("returns an idempotent response for an already-active attachment without checking R2", async () => {
      const activeAttachment = await Attachment.findOne({
        where: {
          originalFileName: "active-results.csv",
          organizationId: organization.id,
        },
      });

      const auditCountBefore = await AuditLog.count({
        where: {
          action: "attachment.restored",
        },
      });

      const response = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: activeAttachment.id,
      }).expect(200);

      expect(response.body).toMatchObject({
        status: "success",
        message: "The attachment is already active.",
        data: {
          restored: false,
          entityType: "attachment",
          item: {
            id: activeAttachment.id,
            isArchived: false,
          },
        },
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();

      const auditCountAfter = await AuditLog.count({
        where: {
          action: "attachment.restored",
        },
      });

      expect(auditCountAfter).toBe(auditCountBefore);

      expect(response.body.data.item).not.toHaveProperty("storageKey");
    });

    it("rolls back attachment restoration when audit creation fails", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const auditSpy = jest
        .spyOn(AuditLog, "create")
        .mockRejectedValueOnce(
          new Error("Simulated attachment restore audit failure"),
        );

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const response = await restoreArchivedItem({
          token: adminToken,
          entityType: "attachment",
          id: archivedAttachment.id,
        }).expect(500);

        expect(response.body).toEqual({
          status: "error",
          message: "An error occurred while restoring the archived attachment.",
        });

        expect(mockAttachmentStorage.getObjectMetadata).toHaveBeenCalledTimes(
          1,
        );

        const unchangedAttachment = await Attachment.findByPk(
          archivedAttachment.id,
        );

        expect(unchangedAttachment.isArchived).toBe(true);
        expect(unchangedAttachment.archivedAt).not.toBeNull();
        expect(unchangedAttachment.archivedById).toBe(admin.id);

        const auditCount = await AuditLog.count({
          where: {
            action: "attachment.restored",
          },
        });

        expect(auditCount).toBe(0);
      } finally {
        auditSpy.mockRestore();
        consoleSpy.mockRestore();
      }
    });
  });

  describe("Cross-entity restoration workflows", () => {
    it("restores a complete project hierarchy in parent-first order", async () => {
      const taskAttachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "task",
        entityId: archivedTask.id,
        archivedById: admin.id,
        originalFileName: "task-restoration-chain.csv",
      });

      const experimentAttachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "experiment",
        entityId: archivedExperiment.id,
        archivedById: admin.id,
        originalFileName: "experiment-restoration-chain.csv",
      });

      const protocolAttachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "protocol",
        entityId: archivedProtocol.id,
        archivedById: admin.id,
        originalFileName: "protocol-restoration-chain.csv",
      });

      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "experiment",
        id: archivedExperiment.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "protocol",
        id: archivedProtocol.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: taskAttachment.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: experimentAttachment.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: protocolAttachment.id,
      }).expect(200);

      const [
        restoredProject,
        restoredTask,
        restoredExperiment,
        restoredProtocol,
        restoredTaskAttachment,
        restoredExperimentAttachment,
        restoredProtocolAttachment,
      ] = await Promise.all([
        Project.findByPk(project.id),
        Task.findByPk(archivedTask.id),
        Experiment.findByPk(archivedExperiment.id),
        Protocol.findByPk(archivedProtocol.id),
        Attachment.findByPk(taskAttachment.id),
        Attachment.findByPk(experimentAttachment.id),
        Attachment.findByPk(protocolAttachment.id),
      ]);

      expect(restoredProject.isArchived).toBe(false);
      expect(restoredTask.isArchived).toBe(false);
      expect(restoredExperiment.isArchived).toBe(false);
      expect(restoredProtocol.isArchived).toBe(false);
      expect(restoredTaskAttachment.isArchived).toBe(false);
      expect(restoredExperimentAttachment.isArchived).toBe(false);
      expect(restoredProtocolAttachment.isArchived).toBe(false);

      expect(mockAttachmentStorage.getObjectMetadata).toHaveBeenCalledTimes(3);

      const auditLogs = await AuditLog.findAll({
        where: {
          organizationId: organization.id,
          action: [
            "project.restored",
            "task.restored",
            "experiment.restored",
            "protocol.restored",
            "attachment.restored",
          ],
        },
      });

      const actionCounts = auditLogs.reduce((counts, auditLog) => {
        counts[auditLog.action] = (counts[auditLog.action] || 0) + 1;

        return counts;
      }, {});

      expect(actionCounts).toMatchObject({
        "project.restored": 1,
        "task.restored": 1,
        "experiment.restored": 1,
        "protocol.restored": 1,
        "attachment.restored": 3,
      });
    });

    it("requires both the project and direct child record to be restored before restoring a child attachment", async () => {
      const taskAttachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "task",
        entityId: archivedTask.id,
        archivedById: admin.id,
        originalFileName: "task-parent-order-results.csv",
      });

      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const blockedResponse = await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: taskAttachment.id,
      }).expect(409);

      expect(blockedResponse.body).toMatchObject({
        status: "error",
        code: "ARCHIVED_PARENT",
        message: "Restore the linked record before restoring this attachment.",
      });

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();

      await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "attachment",
        id: taskAttachment.id,
      }).expect(200);

      const restoredAttachment = await Attachment.findByPk(taskAttachment.id);

      expect(restoredAttachment.isArchived).toBe(false);

      expect(mockAttachmentStorage.getObjectMetadata).toHaveBeenCalledTimes(1);
    });

    it("restoring one child record does not restore sibling records or their attachments", async () => {
      const experimentAttachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "experiment",
        entityId: archivedExperiment.id,
        archivedById: admin.id,
        originalFileName: "sibling-experiment-results.csv",
      });

      const protocolAttachment = await createArchivedAttachment({
        organizationId: organization.id,
        uploadedById: researcher.id,
        entityType: "protocol",
        entityId: archivedProtocol.id,
        archivedById: admin.id,
        originalFileName: "sibling-protocol-results.csv",
      });

      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(200);

      const [
        restoredTask,
        unchangedExperiment,
        unchangedProtocol,
        unchangedExperimentAttachment,
        unchangedProtocolAttachment,
      ] = await Promise.all([
        Task.findByPk(archivedTask.id),
        Experiment.findByPk(archivedExperiment.id),
        Protocol.findByPk(archivedProtocol.id),
        Attachment.findByPk(experimentAttachment.id),
        Attachment.findByPk(protocolAttachment.id),
      ]);

      expect(restoredTask.isArchived).toBe(false);

      expect(unchangedExperiment.isArchived).toBe(true);
      expect(unchangedProtocol.isArchived).toBe(true);

      expect(unchangedExperimentAttachment.isArchived).toBe(true);

      expect(unchangedProtocolAttachment.isArchived).toBe(true);

      expect(mockAttachmentStorage.getObjectMetadata).not.toHaveBeenCalled();
    });

    it("removes only successfully restored records from their archived listings", async () => {
      const projectsBefore = await getArchivedItems({
        token: adminToken,
        query: "?entityType=project",
      }).expect(200);

      const tasksBefore = await getArchivedItems({
        token: adminToken,
        query: "?entityType=task",
      }).expect(200);

      expect(
        projectsBefore.body.data.items.some((item) => item.id === project.id),
      ).toBe(true);

      expect(
        tasksBefore.body.data.items.some((item) => item.id === archivedTask.id),
      ).toBe(true);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const projectsAfterProjectRestore = await getArchivedItems({
        token: adminToken,
        query: "?entityType=project",
      }).expect(200);

      const tasksAfterProjectRestore = await getArchivedItems({
        token: adminToken,
        query: "?entityType=task",
      }).expect(200);

      expect(
        projectsAfterProjectRestore.body.data.items.some(
          (item) => item.id === project.id,
        ),
      ).toBe(false);

      expect(
        tasksAfterProjectRestore.body.data.items.some(
          (item) => item.id === archivedTask.id,
        ),
      ).toBe(true);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(200);

      const tasksAfterTaskRestore = await getArchivedItems({
        token: adminToken,
        query: "?entityType=task",
      }).expect(200);

      expect(
        tasksAfterTaskRestore.body.data.items.some(
          (item) => item.id === archivedTask.id,
        ),
      ).toBe(false);

      expect(
        tasksAfterTaskRestore.body.data.items.some(
          (item) => item.id === archivedStandaloneTask.id,
        ),
      ).toBe(true);
    });

    it("keeps a restored parent active when restoration of its attachment fails", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const storageError = new Error("The specified object does not exist.");

      storageError.name = "NoSuchKey";
      storageError.$metadata = {
        httpStatusCode: 404,
      };

      mockAttachmentStorage.getObjectMetadata.mockRejectedValueOnce(
        storageError,
      );

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        await restoreArchivedItem({
          token: adminToken,
          entityType: "attachment",
          id: archivedAttachment.id,
        }).expect(409);

        const [restoredProject, unchangedAttachment] = await Promise.all([
          Project.findByPk(project.id),
          Attachment.findByPk(archivedAttachment.id),
        ]);

        expect(restoredProject.isArchived).toBe(false);
        expect(unchangedAttachment.isArchived).toBe(true);

        const projectAuditCount = await AuditLog.count({
          where: {
            action: "project.restored",
            entityType: "project",
            entityId: project.id,
          },
        });

        const attachmentAuditCount = await AuditLog.count({
          where: {
            action: "attachment.restored",
          },
        });

        expect(projectAuditCount).toBe(1);
        expect(attachmentAuditCount).toBe(0);
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("creates only one audit event per entity when restoration requests are repeated", async () => {
      await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      const repeatedProjectResponse = await restoreArchivedItem({
        token: adminToken,
        entityType: "project",
        id: project.id,
      }).expect(200);

      expect(repeatedProjectResponse.body.data.restored).toBe(false);

      await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(200);

      const repeatedTaskResponse = await restoreArchivedItem({
        token: adminToken,
        entityType: "task",
        id: archivedTask.id,
      }).expect(200);

      expect(repeatedTaskResponse.body.data.restored).toBe(false);

      const projectAuditCount = await AuditLog.count({
        where: {
          action: "project.restored",
          entityType: "project",
          entityId: project.id,
        },
      });

      const taskAuditCount = await AuditLog.count({
        where: {
          action: "task.restored",
          entityType: "task",
          entityId: archivedTask.id,
        },
      });

      expect(projectAuditCount).toBe(1);
      expect(taskAuditCount).toBe(1);
    });
  });
});
