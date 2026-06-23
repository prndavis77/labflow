const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User, Project, Task, ReviewEvent } = require("../models");

const createUser = async ({ name, email, role }) => {
  const passwordHash = await bcrypt.hash("password123", 12);

  return User.create({
    name,
    email,
    passwordHash,
    role,
    department: "Testing",
    canCreateExperiments: true,
    canEditExperiments: true,
    canCreateProtocols: true,
    canEditProtocols: true,
  });
};

const loginAndGetToken = async (email) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: "password123",
  });

  return response.body.data.token;
};

const createProject = async ({ supervisorId }) => {
  return Project.create({
    title: "Test Project",
    description: "Project used for task completion review tests.",
    status: "active",
    startDate: "2030-01-01",
    targetEndDate: "2030-12-31",
    supervisorId,
  });
};

const createTask = async ({
  title,
  status = "todo",
  projectId = null,
  assignedToId,
  createdById,
}) => {
  return Task.create({
    title,
    description: "Task used for completion review tests.",
    status,
    priority: "medium",
    dueDate: null,
    projectId,
    assignedToId,
    createdById,
  });
};

describe("Task completion review", () => {
  let admin;
  let supervisor;
  let researcher;
  let otherResearcher;
  let project;

  let adminToken;
  let supervisorToken;
  let researcherToken;
  let otherResearcherToken;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await sequelize.query(`
      TRUNCATE TABLE
        equipment_bookings,
        notebook_entries,
        review_events,
        project_members,
        protocols,
        experiments,
        tasks,
        equipment,
        projects,
        users
      RESTART IDENTITY CASCADE;
    `);

    admin = await createUser({
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
    });

    supervisor = await createUser({
      name: "Test Supervisor",
      email: "supervisor@test.com",
      role: "supervisor",
    });

    researcher = await createUser({
      name: "Test Researcher",
      email: "researcher@test.com",
      role: "researcher",
    });

    otherResearcher = await createUser({
      name: "Other Researcher",
      email: "other@test.com",
      role: "researcher",
    });

    project = await createProject({
      supervisorId: supervisor.id,
    });

    adminToken = await loginAndGetToken("admin@test.com");
    supervisorToken = await loginAndGetToken("supervisor@test.com");
    researcherToken = await loginAndGetToken("researcher@test.com");
    otherResearcherToken = await loginAndGetToken("other@test.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("allows an assigned researcher to request task completion review", async () => {
    const task = await createTask({
      title: "Assigned standalone task",
      assignedToId: researcher.id,
      createdById: supervisor.id,
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        status: "completion_requested",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.task.status).toBe("completion_requested");

    const reviewEvent = await ReviewEvent.findOne({
      where: {
        targetType: "task",
        targetId: task.id,
        action: "submitted",
      },
    });

    expect(reviewEvent).not.toBeNull();
  });

  it("rejects task completion request from a researcher who is not assigned to the task", async () => {
    const task = await createTask({
      title: "Task assigned to someone else",
      assignedToId: researcher.id,
      createdById: supervisor.id,
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${otherResearcherToken}`)
      .send({
        status: "completion_requested",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
  });

  it("allows an admin to confirm a standalone task completion request", async () => {
    const task = await createTask({
      title: "Standalone task awaiting admin confirmation",
      status: "completion_requested",
      projectId: null,
      assignedToId: researcher.id,
      createdById: supervisor.id,
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "done",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.task.status).toBe("done");
  });

  it("rejects supervisor confirmation of a standalone task completion request", async () => {
    const task = await createTask({
      title: "Standalone task awaiting supervisor confirmation",
      status: "completion_requested",
      projectId: null,
      assignedToId: researcher.id,
      createdById: supervisor.id,
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        status: "done",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
  });

  it("allows a supervisor to confirm a supervised project-linked task completion request", async () => {
    const task = await createTask({
      title: "Project task awaiting supervisor confirmation",
      status: "completion_requested",
      projectId: project.id,
      assignedToId: researcher.id,
      createdById: supervisor.id,
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        status: "done",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.task.status).toBe("done");
  });

  it("allows a supervisor to reopen a supervised project-linked task completion request", async () => {
    const task = await createTask({
      title: "Project task awaiting reopen decision",
      status: "completion_requested",
      projectId: project.id,
      assignedToId: researcher.id,
      createdById: supervisor.id,
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        status: "in_progress",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.task.status).toBe("in_progress");
  });
});
