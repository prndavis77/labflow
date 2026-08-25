const {
  AuditLog,
  Invitation,
  Organization,
  Project,
  Task,
  User,
} = require("../models");

const {
  exportOrganizationDatabaseData,
} = require("../services/organizationDataExportService");

const { resetTestDatabase } = require("./helpers/dbHelpers");

const { createTestProject, createTestUser } = require("./helpers/testHelpers");

describe("organization data export integration", () => {
  let organizationA;
  let organizationB;
  let adminA;
  let adminB;

  beforeAll(async () => {
    await Organization.sequelize.authenticate();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await Organization.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });

    organizationA = await Organization.create({
      name: "Export Lab A",
      slug: "export-lab-a",
      type: "lab",
      isActive: true,
    });

    organizationB = await Organization.create({
      name: "Export Lab B",
      slug: "export-lab-b",
      type: "lab",
      isActive: true,
    });

    adminA = await createTestUser({
      name: "Admin A",
      email: "admin-a-export@test.com",
      role: "admin",
      organizationId: organizationA.id,
    });

    adminB = await createTestUser({
      name: "Admin B",
      email: "admin-b-export@test.com",
      role: "admin",
      organizationId: organizationB.id,
    });
  });

  afterAll(async () => {
    await Organization.sequelize.close();
  });

  it("exports only the requested organization's PostgreSQL data", async () => {
    const projectA = await createTestProject({
      title: "Organization A Project",
      description: "Customer data for organization A.",
      supervisorId: adminA.id,
      organizationId: organizationA.id,
    });

    const projectB = await createTestProject({
      title: "Organization B Project",
      description: "Customer data for organization B.",
      supervisorId: adminB.id,
      organizationId: organizationB.id,
    });

    await Task.create({
      title: "Organization A Task",
      description: "A-only task.",
      status: "todo",
      priority: "medium",
      projectId: projectA.id,
      assignedToId: adminA.id,
      createdById: adminA.id,
      organizationId: organizationA.id,
    });

    await Task.create({
      title: "Organization B Task",
      description: "B-only task.",
      status: "todo",
      priority: "medium",
      projectId: projectB.id,
      assignedToId: adminB.id,
      createdById: adminB.id,
      organizationId: organizationB.id,
    });

    await Invitation.create({
      organizationId: organizationA.id,
      email: "invite-a@test.com",
      name: "Invite A",
      role: "researcher",
      tokenHash: "a".repeat(64),
      status: "pending",
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      invitedById: adminA.id,
    });

    await Invitation.create({
      organizationId: organizationB.id,
      email: "invite-b@test.com",
      name: "Invite B",
      role: "researcher",
      tokenHash: "b".repeat(64),
      status: "pending",
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      invitedById: adminB.id,
    });

    await AuditLog.create({
      actorUserId: adminA.id,
      organizationId: organizationA.id,
      action: "project.created",
      entityType: "project",
      entityId: projectA.id,
      targetUserId: adminA.id,
      summary: "Organization A audit event.",
      metadata: {
        secretInternalValue: "must-not-export",
      },
      ipAddress: "192.0.2.10",
      userAgent: "Sensitive Test User Agent",
    });

    await AuditLog.create({
      actorUserId: adminB.id,
      organizationId: organizationB.id,
      action: "project.created",
      entityType: "project",
      entityId: projectB.id,
      targetUserId: adminB.id,
      summary: "Organization B audit event.",
    });

    const result = await exportOrganizationDatabaseData({
      organizationId: organizationA.id,
    });

    expect(result.organizationId).toBe(organizationA.id);

    expect(result.organization).toMatchObject({
      id: organizationA.id,
      name: "Export Lab A",
      slug: "export-lab-a",
    });

    expect(result.data.users).toHaveLength(1);
    expect(result.data.users[0]).toMatchObject({
      id: adminA.id,
      email: "admin-a-export@test.com",
      organizationId: organizationA.id,
    });

    expect(result.data.projects).toHaveLength(1);
    expect(result.data.projects[0]).toMatchObject({
      id: projectA.id,
      title: "Organization A Project",
      organizationId: organizationA.id,
    });

    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.tasks[0]).toMatchObject({
      title: "Organization A Task",
      organizationId: organizationA.id,
    });

    expect(result.data.invitations).toHaveLength(1);
    expect(result.data.invitations[0]).toMatchObject({
      email: "invite-a@test.com",
      organizationId: organizationA.id,
    });

    expect(result.data.auditLogs).toHaveLength(1);
    expect(result.data.auditLogs[0]).toMatchObject({
      summary: "Organization A audit event.",
      organizationId: organizationA.id,
    });

    const serializedExport = JSON.stringify(result);

    expect(serializedExport).not.toContain("Organization B Project");
    expect(serializedExport).not.toContain("Organization B Task");
    expect(serializedExport).not.toContain("admin-b-export@test.com");
    expect(serializedExport).not.toContain("invite-b@test.com");
    expect(serializedExport).not.toContain("Organization B audit event.");
  });

  it("does not expose explicitly excluded sensitive fields", async () => {
    const invitation = await Invitation.create({
      organizationId: organizationA.id,
      email: "sensitive-invite@test.com",
      name: "Sensitive Invite",
      role: "researcher",
      tokenHash: "c".repeat(64),
      status: "pending",
      emailProvider: "mailgun",
      emailProviderMessageId: "provider-secret-message-id",
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      invitedById: adminA.id,
    });

    await AuditLog.create({
      actorUserId: adminA.id,
      organizationId: organizationA.id,
      action: "user.updated",
      entityType: "user",
      entityId: adminA.id,
      targetUserId: adminA.id,
      summary: "Sensitive export test.",
      metadata: {
        secretInternalValue: "must-not-export",
      },
      ipAddress: "192.0.2.25",
      userAgent: "Sensitive Test User Agent",
    });

    const exportResult = await exportOrganizationDatabaseData({
      organizationId: organizationA.id,
    });

    const serializedExport = JSON.stringify(exportResult);

    expect(serializedExport).not.toContain(adminA.passwordHash);
    expect(serializedExport).not.toContain('"passwordHash"');
    expect(serializedExport).not.toContain('"tokenVersion"');

    expect(serializedExport).not.toContain(invitation.tokenHash);
    expect(serializedExport).not.toContain('"tokenHash"');
    expect(serializedExport).not.toContain("provider-secret-message-id");
    expect(serializedExport).not.toContain('"emailProvider"');

    expect(serializedExport).not.toContain("must-not-export");
    expect(serializedExport).not.toContain("192.0.2.25");
    expect(serializedExport).not.toContain("Sensitive Test User Agent");
    expect(serializedExport).not.toContain('"metadata"');
    expect(serializedExport).not.toContain('"ipAddress"');
    expect(serializedExport).not.toContain('"userAgent"');
  });
});
