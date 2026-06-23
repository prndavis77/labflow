const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const {
  User,
  Project,
  Experiment,
  Protocol,
  ReviewEvent,
} = require("../models");

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
    description: "Project used for review workflow tests.",
    status: "active",
    startDate: "2030-01-01",
    targetEndDate: "2030-12-31",
    supervisorId,
  });
};

const createExperiment = async ({
  projectId,
  researcherId,
  createdById,
  reviewStatus = "pending",
}) => {
  return Experiment.create({
    title: "Experiment awaiting review",
    objective: "Test experiment review workflow.",
    notes: "Created by automated test.",
    status: "needs_review",
    reviewStatus,
    reviewComment: null,
    startedAt: "2030-01-01",
    completedAt: null,
    projectId,
    researcherId,
    taskId: null,
    protocolId: null,
    createdById,
  });
};

const createProtocol = async ({
  projectId = null,
  createdById,
  approvalStatus = "pending_review",
}) => {
  return Protocol.create({
    title: "Protocol awaiting review",
    version: "1.0",
    purpose: "Test protocol review workflow.",
    content: "1. Prepare materials.\n2. Run procedure.\n3. Record results.",
    approvalStatus,
    reviewComment: null,
    projectId,
    equipmentId: null,
    createdById,
    approvedById: null,
    approvedAt: null,
  });
};

describe("Experiment and protocol review workflows", () => {
  let admin;
  let supervisor;
  let otherSupervisor;
  let researcher;
  let supervisedProject;
  let otherProject;

  let adminToken;
  let supervisorToken;
  let otherSupervisorToken;

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

    researcher = await createUser({
      name: "Test Researcher",
      email: "researcher@test.com",
      role: "researcher",
    });

    supervisedProject = await createProject({
      title: "Supervised Project",
      supervisorId: supervisor.id,
    });

    otherProject = await createProject({
      title: "Other Supervisor Project",
      supervisorId: otherSupervisor.id,
    });

    adminToken = await loginAndGetToken("admin@test.com");
    supervisorToken = await loginAndGetToken("supervisor@test.com");
    otherSupervisorToken = await loginAndGetToken("other.supervisor@test.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("allows an admin to approve an experiment", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/experiments/${experiment.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reviewStatus: "approved",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.experiment.reviewStatus).toBe("approved");

    const reviewEvent = await ReviewEvent.findOne({
      where: {
        targetType: "experiment",
        targetId: experiment.id,
        action: "approved",
      },
    });

    expect(reviewEvent).not.toBeNull();
  });

  it("allows a supervisor to request changes on a supervised experiment", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/experiments/${experiment.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        reviewStatus: "changes_requested",
        reviewComment: "Please clarify the sample preparation details.",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.experiment.reviewStatus).toBe(
      "changes_requested",
    );
    expect(response.body.data.experiment.reviewComment).toBe(
      "Please clarify the sample preparation details.",
    );

    const reviewEvent = await ReviewEvent.findOne({
      where: {
        targetType: "experiment",
        targetId: experiment.id,
        action: "changes_requested",
      },
    });

    expect(reviewEvent).not.toBeNull();
    expect(reviewEvent.comment).toBe(
      "Please clarify the sample preparation details.",
    );
  });

  it("rejects an experiment change request without a review comment", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/experiments/${experiment.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        reviewStatus: "changes_requested",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "A review comment is required when requesting changes.",
    );
  });

  it("rejects supervisor review of an experiment from a non-supervised project", async () => {
    const experiment = await createExperiment({
      projectId: otherProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/experiments/${experiment.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        reviewStatus: "approved",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
  });

  it("allows an admin to approve a protocol", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        approvalStatus: "approved",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.protocol.approvalStatus).toBe("approved");
    expect(response.body.data.protocol.approvedById).toBe(admin.id);
    expect(response.body.data.protocol.approvedAt).not.toBeNull();

    const reviewEvent = await ReviewEvent.findOne({
      where: {
        targetType: "protocol",
        targetId: protocol.id,
        action: "approved",
      },
    });

    expect(reviewEvent).not.toBeNull();
  });

  it("allows a supervisor to request changes on a supervised project protocol", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        approvalStatus: "changes_requested",
        reviewComment: "Please add acceptance criteria before approval.",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.protocol.approvalStatus).toBe(
      "changes_requested",
    );
    expect(response.body.data.protocol.reviewComment).toBe(
      "Please add acceptance criteria before approval.",
    );

    const reviewEvent = await ReviewEvent.findOne({
      where: {
        targetType: "protocol",
        targetId: protocol.id,
        action: "changes_requested",
      },
    });

    expect(reviewEvent).not.toBeNull();
    expect(reviewEvent.comment).toBe(
      "Please add acceptance criteria before approval.",
    );
  });

  it("rejects a protocol change request without a review comment", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        approvalStatus: "changes_requested",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "A review comment is required when requesting changes.",
    );
  });

  it("rejects supervisor review of a protocol from a non-supervised project", async () => {
    const protocol = await createProtocol({
      projectId: otherProject.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        approvalStatus: "approved",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
  });

  it("allows a supervisor to review a general non-project-linked protocol", async () => {
    const protocol = await createProtocol({
      projectId: null,
      createdById: supervisor.id,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        approvalStatus: "approved",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.protocol.approvalStatus).toBe("approved");
    expect(response.body.data.protocol.approvedById).toBe(supervisor.id);
  });
});
