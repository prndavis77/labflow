const {
  AuditLog,
  EmailVerificationToken,
  Equipment,
  EquipmentBooking,
  Experiment,
  Invitation,
  NotebookEntry,
  Organization,
  PasswordResetToken,
  Project,
  ProjectMember,
  Protocol,
  ReviewEvent,
  Task,
  User,
} = require("../models");

const {
  deleteOrganizationDatabaseData,
  getOrganizationDeletionInventory,
} = require("../services/organizationDeletionService");

const { sequelize } = require("../config/database");

const TEST_PASSWORD_HASH =
  "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

const createUniqueSuffix = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createOrganizationDeletionFixture = async () => {
  const suffix = createUniqueSuffix();

  const organization = await Organization.create({
    name: `Deletion Integration Lab ${suffix}`,
    slug: `deletion-integration-${suffix}`,
    type: "lab",
    isActive: false,
  });

  const supervisor = await User.create({
    name: "Deletion Test Supervisor",
    email: `deletion-supervisor-${suffix}@example.com`,
    passwordHash: TEST_PASSWORD_HASH,
    role: "supervisor",
    organizationId: organization.id,
    emailVerifiedAt: new Date(),
  });

  const researcher = await User.create({
    name: "Deletion Test Researcher",
    email: `deletion-researcher-${suffix}@example.com`,
    passwordHash: TEST_PASSWORD_HASH,
    role: "researcher",
    organizationId: organization.id,
    emailVerifiedAt: new Date(),
  });

  const project = await Project.create({
    title: "Deletion Integration Project",
    status: "active",
    supervisorId: supervisor.id,
    organizationId: organization.id,
  });

  await ProjectMember.create({
    projectId: project.id,
    userId: researcher.id,
    projectRole: "member",
    organizationId: organization.id,
  });

  const task = await Task.create({
    title: "Deletion Integration Task",
    status: "todo",
    priority: "medium",
    projectId: project.id,
    assignedToId: researcher.id,
    createdById: supervisor.id,
    organizationId: organization.id,
  });

  const equipment = await Equipment.create({
    name: "Deletion Integration HPLC",
    type: "HPLC",
    location: "Integration Test Lab",
    status: "available",
    organizationId: organization.id,
  });

  const protocol = await Protocol.create({
    title: "Deletion Integration Protocol",
    version: "1.0",
    content: "Integration-test protocol content.",
    approvalStatus: "draft",
    reviewStatus: "not_submitted",
    projectId: project.id,
    equipmentId: equipment.id,
    createdById: supervisor.id,
    organizationId: organization.id,
  });

  const experiment = await Experiment.create({
    title: "Deletion Integration Experiment",
    status: "planned",
    reviewStatus: "not_submitted",
    projectId: project.id,
    researcherId: researcher.id,
    taskId: task.id,
    protocolId: protocol.id,
    createdById: supervisor.id,
    organizationId: organization.id,
  });

  await NotebookEntry.create({
    title: "Deletion Integration Notebook Entry",
    entryType: "observation",
    content: "Integration-test notebook content.",
    contentFormat: "plain_text",
    experimentId: experiment.id,
    projectId: project.id,
    authorId: researcher.id,
    organizationId: organization.id,
  });

  await EquipmentBooking.create({
    title: "Deletion Integration Booking",
    startTime: new Date("2035-01-01T09:00:00.000Z"),
    endTime: new Date("2035-01-01T10:00:00.000Z"),
    status: "confirmed",
    equipmentId: equipment.id,
    userId: researcher.id,
    projectId: project.id,
    experimentId: experiment.id,
    organizationId: organization.id,
  });

  await ReviewEvent.create({
    targetType: "experiment",
    targetId: experiment.id,
    action: "submitted",
    reviewerId: supervisor.id,
    organizationId: organization.id,
  });

  await Invitation.create({
    organizationId: organization.id,
    email: `deletion-invite-${suffix}@example.com`,
    name: "Deletion Test Invitee",
    role: "researcher",
    tokenHash: `deletion-integration-token-${suffix}`,
    status: "pending",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    invitedById: supervisor.id,
  });

  await PasswordResetToken.create({
    userId: researcher.id,
    organizationId: organization.id,
    tokenHash: "a".repeat(64),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  await EmailVerificationToken.create({
    userId: researcher.id,
    organizationId: organization.id,
    tokenHash: "b".repeat(64),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  await AuditLog.create({
    actorUserId: supervisor.id,
    action: "organization_deletion_integration_test",
    entityType: "organization",
    entityId: organization.id,
    targetUserId: researcher.id,
    summary: "Integration-test audit record.",
    organizationId: organization.id,
  });

  return {
    organization,
    supervisor,
    researcher,
    project,
    task,
    equipment,
    protocol,
    experiment,
  };
};

const countOrganizationRows = async (organizationId) => {
  const where = {
    organizationId,
  };

  const [
    organizations,
    users,
    projects,
    tasks,
    experiments,
    protocols,
    equipment,
    equipmentBookings,
    notebookEntries,
    projectMembers,
    reviewEvents,
    auditLogs,
    invitations,
    passwordResetTokens,
    emailVerificationTokens,
  ] = await Promise.all([
    Organization.count({
      where: {
        id: organizationId,
      },
    }),
    User.count({ where }),
    Project.count({ where }),
    Task.count({ where }),
    Experiment.count({ where }),
    Protocol.count({ where }),
    Equipment.count({ where }),
    EquipmentBooking.count({ where }),
    NotebookEntry.count({ where }),
    ProjectMember.count({ where }),
    ReviewEvent.count({ where }),
    AuditLog.count({ where }),
    Invitation.count({ where }),
    PasswordResetToken.count({ where }),
    EmailVerificationToken.count({ where }),
  ]);

  return {
    organizations,
    users,
    projects,
    tasks,
    experiments,
    protocols,
    equipment,
    equipmentBookings,
    notebookEntries,
    projectMembers,
    reviewEvents,
    auditLogs,
    invitations,
    passwordResetTokens,
    emailVerificationTokens,
  };
};

describe("organization deletion PostgreSQL integration", () => {
  const createdOrganizationIds = new Set();

  beforeAll(async () => {
    if (process.env.NODE_ENV !== "test") {
      throw new Error(
        "Organization deletion integration tests may run only with NODE_ENV=test.",
      );
    }

    await sequelize.authenticate();
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    for (const organizationId of createdOrganizationIds) {
      const organization = await Organization.findByPk(organizationId);

      if (!organization) {
        createdOrganizationIds.delete(organizationId);
        continue;
      }

      await deleteOrganizationDatabaseData({
        organizationId,
        attachmentStorageDeletionConfirmed: true,
      });

      createdOrganizationIds.delete(organizationId);
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("deletes a realistic organization dependency graph without FK violations", async () => {
    const fixture = await createOrganizationDeletionFixture();

    createdOrganizationIds.add(fixture.organization.id);

    const inventory = await getOrganizationDeletionInventory({
      organizationId: fixture.organization.id,
    });

    expect(inventory.counts).toMatchObject({
      reviewEvents: 1,
      notebookEntries: 1,
      equipmentBookings: 1,
      projectMembers: 1,
      attachments: 0,
      invitations: 1,
      experiments: 1,
      tasks: 1,
      protocols: 1,
      equipment: 1,
      projects: 1,
      passwordResetTokens: 1,
      emailVerificationTokens: 1,
      auditLogs: 1,
      users: 2,
    });

    const result = await deleteOrganizationDatabaseData({
      organizationId: fixture.organization.id,
    });

    expect(result.organizationId).toBe(fixture.organization.id);

    expect(result.deleted).toMatchObject({
      reviewEvents: 1,
      notebookEntries: 1,
      equipmentBookings: 1,
      projectMembers: 1,
      attachments: 0,
      invitations: 1,
      experiments: 1,
      tasks: 1,
      protocols: 1,
      equipment: 1,
      projects: 1,
      passwordResetTokens: 1,
      emailVerificationTokens: 1,
      auditLogs: 1,
      users: 2,
      organizations: 1,
    });

    const remaining = await countOrganizationRows(fixture.organization.id);

    expect(remaining).toEqual({
      organizations: 0,
      users: 0,
      projects: 0,
      tasks: 0,
      experiments: 0,
      protocols: 0,
      equipment: 0,
      equipmentBookings: 0,
      notebookEntries: 0,
      projectMembers: 0,
      reviewEvents: 0,
      auditLogs: 0,
      invitations: 0,
      passwordResetTokens: 0,
      emailVerificationTokens: 0,
    });

    createdOrganizationIds.delete(fixture.organization.id);
  });

  it("rolls back every deletion when a late database step fails", async () => {
    const fixture = await createOrganizationDeletionFixture();

    createdOrganizationIds.add(fixture.organization.id);

    const before = await countOrganizationRows(fixture.organization.id);

    const userDestroySpy = jest
      .spyOn(User, "destroy")
      .mockRejectedValueOnce(new Error("forced user deletion failure"));

    await expect(
      deleteOrganizationDatabaseData({
        organizationId: fixture.organization.id,
      }),
    ).rejects.toThrow("forced user deletion failure");

    expect(userDestroySpy).toHaveBeenCalledTimes(1);

    userDestroySpy.mockRestore();

    const after = await countOrganizationRows(fixture.organization.id);

    expect(after).toEqual(before);

    expect(after).toMatchObject({
      organizations: 1,
      users: 2,
      projects: 1,
      tasks: 1,
      experiments: 1,
      protocols: 1,
      equipment: 1,
      equipmentBookings: 1,
      notebookEntries: 1,
      projectMembers: 1,
      reviewEvents: 1,
      auditLogs: 1,
      invitations: 1,
      passwordResetTokens: 1,
      emailVerificationTokens: 1,
    });
  });
});
