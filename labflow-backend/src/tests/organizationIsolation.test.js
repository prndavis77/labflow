const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const {
  User,
  Project,
  Task,
  Experiment,
  Protocol,
  Equipment,
  EquipmentBooking,
  NotebookEntry,
  AuditLog,
} = require("../models");

const {
  TEST_PASSWORD,
  createTestUser,
  createTestProject,
  getOrCreateTestOrganization,
  createSecondTestOrganization,
} = require("./helpers/testHelpers");

const loginAndGetToken = async (email) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: TEST_PASSWORD,
  });

  return response.body.data.token;
};

describe("Organization isolation", () => {
  let primaryOrganization;
  let secondOrganization;
  let primaryAdmin;
  let secondAdmin;
  let primaryToken;
  let secondToken;
  let secondProject;
  let secondTask;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await sequelize.query(`
      TRUNCATE TABLE
        audit_logs,
        review_events,
        equipment_bookings,
        notebook_entries,
        project_members,
        protocols,
        experiments,
        tasks,
        equipment,
        projects,
        users,
        organizations
      RESTART IDENTITY CASCADE;
    `);

    primaryOrganization = await getOrCreateTestOrganization();
    secondOrganization = await createSecondTestOrganization();

    primaryAdmin = await createTestUser({
      name: "Primary Admin",
      email: "primary-admin@test.com",
      role: "admin",
      organizationId: primaryOrganization.id,
    });

    secondAdmin = await createTestUser({
      name: "Second Admin",
      email: "second-admin@test.com",
      role: "admin",
      organizationId: secondOrganization.id,
    });

    primaryToken = await loginAndGetToken("primary-admin@test.com");
    secondToken = await loginAndGetToken("second-admin@test.com");

    secondProject = await Project.create({
      title: "Second Org Project",
      description: "This project belongs to another organization.",
      status: "active",
      supervisorId: secondAdmin.id,
      organizationId: secondOrganization.id,
    });

    secondTask = await Task.create({
      title: "Second Org Task",
      description: "This task belongs to another organization.",
      status: "todo",
      priority: "medium",
      projectId: secondProject.id,
      assignedToId: secondAdmin.id,
      createdById: secondAdmin.id,
      organizationId: secondOrganization.id,
    });

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);

    // Optional extra user in second org, useful for user-management isolation tests later.
    await User.create({
      name: "Second Researcher",
      email: "second-researcher@test.com",
      passwordHash,
      role: "researcher",
      department: "Testing",
      organizationId: secondOrganization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("prevents an admin from fetching a project in another organization", async () => {
    const response = await request(app)
      .get(`/api/projects/${secondProject.id}`)
      .set("Authorization", `Bearer ${primaryToken}`);

    expect(response.statusCode).toBe(404);
  });

  it("prevents an admin from seeing another organization project in the project list", async () => {
    const response = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${primaryToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");

    const projects = response.body.data.projects;
    expect(projects.some((project) => project.id === secondProject.id)).toBe(
      false,
    );
  });

  it("prevents an admin from fetching a task in another organization", async () => {
    const response = await request(app)
      .get(`/api/tasks/${secondTask.id}`)
      .set("Authorization", `Bearer ${primaryToken}`);

    expect(response.statusCode).toBe(404);
  });

  it("prevents an admin from seeing another organization task in the task list", async () => {
    const response = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${primaryToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");

    const tasks = response.body.data.tasks;
    expect(tasks.some((task) => task.id === secondTask.id)).toBe(false);
  });

  it("prevents an admin from seeing audit logs from another organization", async () => {
    await AuditLog.create({
      actorUserId: secondAdmin.id,
      organizationId: secondOrganization.id,
      action: "project.created",
      entityType: "project",
      entityId: secondProject.id,
      targetUserId: secondAdmin.id,
      summary: "Second organization audit log.",
      metadata: {
        organizationIsolationTest: true,
      },
    });

    const response = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${primaryToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");

    const auditLogs = response.body.data.auditLogs;
    expect(
      auditLogs.some((log) => log.summary === "Second organization audit log."),
    ).toBe(false);
  });

  describe("Dashboard organization isolation", () => {
    it("does not expose another organization's dashboard data to an admin", async () => {
      const equipment = await Equipment.create({
        name: "Second Org HPLC",
        type: "HPLC",
        location: "Second Org Lab",
        status: "maintenance",
        notes: "Belongs only to the second organization.",
        organizationId: secondOrganization.id,
      });

      const protocol = await Protocol.create({
        title: "Second Org General SOP",
        version: "1.0",
        purpose: "Test cross-organization protocol isolation.",
        content: "Second organization protocol content.",
        approvalStatus: "pending_review",
        reviewStatus: "pending",
        projectId: null,
        equipmentId: null,
        createdById: secondAdmin.id,
        organizationId: secondOrganization.id,
      });

      const experiment = await Experiment.create({
        title: "Second Org Experiment",
        objective: "Test dashboard organization isolation.",
        notes: "This experiment must not appear in the primary dashboard.",
        status: "needs_review",
        reviewStatus: "pending",
        projectId: secondProject.id,
        researcherId: secondAdmin.id,
        createdById: secondAdmin.id,
        organizationId: secondOrganization.id,
      });

      const now = new Date();
      const bookingStart = new Date(now.getTime() + 60 * 60 * 1000);
      const bookingEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      await EquipmentBooking.create({
        title: "Second Org Booking",
        purpose: "Test booking isolation.",
        status: "confirmed",
        startTime: bookingStart,
        endTime: bookingEnd,
        equipmentId: equipment.id,
        userId: secondAdmin.id,
        projectId: secondProject.id,
        experimentId: experiment.id,
        organizationId: secondOrganization.id,
      });

      await NotebookEntry.create({
        title: "Second Org Notebook Entry",
        entryType: "observation",
        content: "This entry belongs only to the second organization.",
        contentFormat: "plain_text",
        experimentId: experiment.id,
        projectId: secondProject.id,
        authorId: secondAdmin.id,
        organizationId: secondOrganization.id,
      });

      const response = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${primaryToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe("success");

      expect(response.body.data.accessScope).toMatchObject({
        role: "admin",
        isProjectScoped: false,
        accessibleProjectIds: "all_in_organization",
      });

      expect(response.body.data.metrics).toMatchObject({
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        openTasks: 0,
        overdueTasks: 0,
        experimentsNeedingReview: 0,
        tasksAwaitingCompletionReview: 0,
        protocolsNeedingReview: 0,
        totalEquipment: 0,
        unavailableEquipment: 0,
        equipmentInUseNow: 0,
        upcomingBookings: 0,
      });

      expect(response.body.data.lists).toEqual({
        tasksDueSoon: [],
        experimentsNeedingReview: [],
        tasksAwaitingCompletionReview: [],
        protocolsNeedingReview: [],
        upcomingBookings: [],
        recentProjects: [],
        recentTasks: [],
        recentExperiments: [],
        recentNotebookEntries: [],
      });

      // Confirm the test data really is visible inside its own organization.
      const secondResponse = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${secondToken}`);

      expect(secondResponse.statusCode).toBe(200);
      expect(secondResponse.body.status).toBe("success");

      expect(secondResponse.body.data.metrics).toMatchObject({
        totalProjects: 1,
        activeProjects: 1,
        openTasks: 1,
        experimentsNeedingReview: 1,
        protocolsNeedingReview: 1,
        totalEquipment: 1,
        unavailableEquipment: 1,
        upcomingBookings: 1,
      });

      expect(secondResponse.body.data.lists.recentProjects).toHaveLength(1);
      expect(secondResponse.body.data.lists.recentTasks).toHaveLength(1);
      expect(
        secondResponse.body.data.lists.experimentsNeedingReview,
      ).toHaveLength(1);
      expect(
        secondResponse.body.data.lists.protocolsNeedingReview,
      ).toHaveLength(1);
      expect(secondResponse.body.data.lists.upcomingBookings).toHaveLength(1);
      expect(secondResponse.body.data.lists.recentNotebookEntries).toHaveLength(
        1,
      );
    });

    it("does not expose another organization's general protocols", async () => {
      await Protocol.create({
        title: "Second Org Unlinked Protocol",
        version: "1.0",
        purpose: "Test isolation for a protocol without a project.",
        content: "This protocol must remain inside the second organization.",
        approvalStatus: "pending_review",
        reviewStatus: "pending",
        projectId: null,
        equipmentId: null,
        createdById: secondAdmin.id,
        organizationId: secondOrganization.id,
      });

      const response = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${primaryToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe("success");

      expect(response.body.data.metrics.protocolsNeedingReview).toBe(0);
      expect(response.body.data.lists.protocolsNeedingReview).toEqual([]);
    });
  });
});
