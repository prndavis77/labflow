const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User, Project, Task, AuditLog } = require("../models");

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
});
