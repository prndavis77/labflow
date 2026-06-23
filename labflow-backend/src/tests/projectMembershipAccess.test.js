const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User, Project, ProjectMember } = require("../models");

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

const createProject = async ({ title, supervisorId }) => {
  return Project.create({
    title,
    description: "Project used for membership access tests.",
    status: "active",
    startDate: "2030-01-01",
    targetEndDate: "2030-12-31",
    supervisorId,
  });
};

const getProjectsFromResponse = (response) => {
  return response.body.data.projects;
};

describe("Project membership access", () => {
  let admin;
  let supervisor;
  let otherSupervisor;
  let memberResearcher;
  let viewerResearcher;
  let nonMemberResearcher;
  let memberProject;
  let viewerProject;
  let nonMemberProject;

  let adminToken;
  let supervisorToken;
  let memberToken;
  let viewerToken;
  let nonMemberToken;

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

    otherSupervisor = await createUser({
      name: "Other Supervisor",
      email: "other.supervisor@test.com",
      role: "supervisor",
    });

    memberResearcher = await createUser({
      name: "Member Researcher",
      email: "member@test.com",
      role: "researcher",
    });

    viewerResearcher = await createUser({
      name: "Viewer Researcher",
      email: "viewer@test.com",
      role: "researcher",
    });

    nonMemberResearcher = await createUser({
      name: "Non Member Researcher",
      email: "nonmember@test.com",
      role: "researcher",
    });

    memberProject = await createProject({
      title: "Member Project",
      supervisorId: supervisor.id,
    });

    viewerProject = await createProject({
      title: "Viewer Project",
      supervisorId: supervisor.id,
    });

    nonMemberProject = await createProject({
      title: "Non Member Project",
      supervisorId: otherSupervisor.id,
    });

    await ProjectMember.create({
      projectId: memberProject.id,
      userId: memberResearcher.id,
      projectRole: "lead",
    });

    await ProjectMember.create({
      projectId: viewerProject.id,
      userId: viewerResearcher.id,
      projectRole: "viewer",
    });

    adminToken = await loginAndGetToken("admin@test.com");
    supervisorToken = await loginAndGetToken("supervisor@test.com");
    memberToken = await loginAndGetToken("member@test.com");
    viewerToken = await loginAndGetToken("viewer@test.com");
    nonMemberToken = await loginAndGetToken("nonmember@test.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("allows admin to view all projects", async () => {
    const response = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");

    const projects = getProjectsFromResponse(response);
    const projectTitles = projects.map((project) => project.title);

    expect(projectTitles).toContain("Member Project");
    expect(projectTitles).toContain("Viewer Project");
    expect(projectTitles).toContain("Non Member Project");
  });

  it("allows a supervisor to view only supervised projects", async () => {
    const response = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");

    const projects = getProjectsFromResponse(response);
    const projectTitles = projects.map((project) => project.title);

    expect(projectTitles).toContain("Member Project");
    expect(projectTitles).toContain("Viewer Project");
    expect(projectTitles).not.toContain("Non Member Project");
  });

  it("allows a researcher to view only projects where they are a member", async () => {
    const response = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");

    const projects = getProjectsFromResponse(response);
    const projectTitles = projects.map((project) => project.title);

    expect(projectTitles).toContain("Member Project");
    expect(projectTitles).not.toContain("Viewer Project");
    expect(projectTitles).not.toContain("Non Member Project");
  });

  it("rejects researcher direct access to a non-member project", async () => {
    const response = await request(app)
      .get(`/api/projects/${nonMemberProject.id}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect([403, 404]).toContain(response.statusCode);
    expect(response.body.status).toBe("error");
  });

  it("rejects supervisor direct access to a non-supervised project", async () => {
    const response = await request(app)
      .get(`/api/projects/${nonMemberProject.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect([403, 404]).toContain(response.statusCode);
    expect(response.body.status).toBe("error");
  });

  it("allows a project lead researcher to create a project-linked task", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        title: "Lead-created project task",
        description: "A project-linked task created by a project lead.",
        status: "todo",
        priority: "medium",
        dueDate: null,
        projectId: memberProject.id,
        assignedToId: memberResearcher.id,
      });

    expect([200, 201]).toContain(response.statusCode);
    expect(response.body.status).toBe("success");
    expect(response.body.data.task.projectId).toBe(memberProject.id);
  });

  it("rejects project-linked task creation by a project viewer", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        title: "Viewer-created project task",
        description: "A viewer should not be able to create this task.",
        status: "todo",
        priority: "medium",
        dueDate: null,
        projectId: viewerProject.id,
        assignedToId: viewerResearcher.id,
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
  });

  it("rejects project-linked task creation by a non-member researcher", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${nonMemberToken}`)
      .send({
        title: "Non-member project task",
        description: "A non-member should not be able to create this task.",
        status: "todo",
        priority: "medium",
        dueDate: null,
        projectId: memberProject.id,
        assignedToId: nonMemberResearcher.id,
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
  });
});
