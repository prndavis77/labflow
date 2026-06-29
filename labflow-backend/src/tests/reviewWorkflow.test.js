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
  AuditLog,
} = require("../models");

const {
  createTestUser,
  loginAndGetToken,
  createTestProject,
} = require("./helpers/testHelpers");

const { resetTestDatabase } = require("./helpers/dbHelpers");

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
    await resetTestDatabase();

    admin = await createTestUser({
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
    });

    supervisor = await createTestUser({
      name: "Test Supervisor",
      email: "supervisor@test.com",
      role: "supervisor",
    });

    otherSupervisor = await createTestUser({
      name: "Other Supervisor",
      email: "other.supervisor@test.com",
      role: "supervisor",
    });

    researcher = await createTestUser({
      name: "Test Researcher",
      email: "researcher@test.com",
      role: "researcher",
    });

    supervisedProject = await createTestProject({
      title: "Supervised Project",
      supervisorId: supervisor.id,
    });

    otherProject = await createTestProject({
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

  it("archives an experiment instead of permanently deleting it", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
      reviewStatus: "not_submitted",
    });

    const response = await request(app)
      .delete(`/api/experiments/${experiment.id}`)
      .send({
        archiveReason: "No longer needed.",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Experiment archived successfully.");

    const archivedExperiment = await Experiment.findByPk(experiment.id);

    expect(archivedExperiment).not.toBeNull();
    expect(archivedExperiment.isArchived).toBe(true);
    expect(archivedExperiment.archivedAt).not.toBeNull();
    expect(archivedExperiment.archivedById).toBe(admin.id);
    expect(archivedExperiment.archiveReason).toBe("No longer needed.");

    const auditLog = await AuditLog.findOne({
      where: {
        action: "experiment.archived",
        entityType: "experiment",
        entityId: experiment.id,
      },
    });

    expect(auditLog).not.toBeNull();
    expect(auditLog.targetUserId).toBe(researcher.id);

    const listResponse = await request(app)
      .get("/api/experiments")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listResponse.statusCode).toBe(200);

    const returnedExperimentIds = listResponse.body.data.experiments.map(
      (experiment) => experiment.id,
    );

    expect(returnedExperimentIds).not.toContain(experiment.id);
  });

  it("archives a protocol instead of permanently deleting it", async () => {
    const protocol = await Protocol.create({
      title: "Protocol to archive",
      version: "1.0",
      purpose: "Test protocol archive behavior",
      content: "This protocol should be archived, not deleted.",
      approvalStatus: "draft",
      projectId: supervisedProject.id,
      createdById: researcher.id,
    });

    const response = await request(app)
      .delete(`/api/protocols/${protocol.id}`)
      .send({
        archiveReason: "No longer needed.",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Protocol archived successfully.");

    const archivedProtocol = await Protocol.findByPk(protocol.id);

    expect(archivedProtocol).not.toBeNull();
    expect(archivedProtocol.isArchived).toBe(true);
    expect(archivedProtocol.archivedAt).not.toBeNull();
    expect(archivedProtocol.archivedById).toBe(admin.id);
    expect(archivedProtocol.archiveReason).toBe("No longer needed.");

    const auditLog = await AuditLog.findOne({
      where: {
        action: "protocol.archived",
        entityType: "protocol",
        entityId: protocol.id,
      },
    });

    expect(auditLog).not.toBeNull();
    expect(auditLog.targetUserId).toBe(researcher.id);

    const listResponse = await request(app)
      .get("/api/protocols")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listResponse.statusCode).toBe(200);

    const returnedProtocolIds = listResponse.body.data.protocols.map(
      (protocol) => protocol.id,
    );

    expect(returnedProtocolIds).not.toContain(protocol.id);
  });
});
