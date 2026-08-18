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
  ProjectMember,
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
  organizationId,
}) => {
  return Experiment.create({
    title: "Experiment awaiting review",
    objective: "Test experiment review workflow.",
    notes: "Created by automated test.",
    status: "needs_review",
    reviewStatus,
    organizationId,
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
  organizationId,
}) => {
  return Protocol.create({
    title: "Protocol awaiting review",
    version: "1.0",
    purpose: "Test protocol review workflow.",
    content: "1. Prepare materials.\n2. Run procedure.\n3. Record results.",
    approvalStatus,
    organizationId,
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

    await ProjectMember.create({
      projectId: supervisedProject.id,
      userId: researcher.id,
      projectRole: "member",
      organizationId: supervisedProject.organizationId,
    });

    await researcher.update({
      canCreateExperiments: true,
      canCreateProtocols: true,
      requiresReview: true,
    });

    adminToken = await loginAndGetToken("admin@test.com");
    supervisorToken = await loginAndGetToken("supervisor@test.com");
    otherSupervisorToken = await loginAndGetToken("other.supervisor@test.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("creates an experiment with review not submitted when researcher review is required", async () => {
    await researcher.update({
      requiresReview: true,
    });

    const researcherToken = await loginAndGetToken("researcher@test.com");

    const response = await request(app)
      .post("/api/experiments")
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        title: "Review-required experiment",
        objective: "Verify the default experiment review policy.",
        projectId: supervisedProject.id,
        researcherId: researcher.id,
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.experiment.reviewStatus).toBe("not_submitted");

    const createdExperiment = await Experiment.findByPk(
      response.body.data.experiment.id,
    );

    expect(createdExperiment).not.toBeNull();
    expect(createdExperiment.reviewStatus).toBe("not_submitted");
  });

  it("creates an experiment with review not required when researcher is exempt", async () => {
    await researcher.update({
      requiresReview: false,
    });

    const researcherToken = await loginAndGetToken("researcher@test.com");

    const response = await request(app)
      .post("/api/experiments")
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        title: "Review-exempt experiment",
        objective: "Verify the exempt experiment review policy.",
        projectId: supervisedProject.id,
        researcherId: researcher.id,
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.experiment.reviewStatus).toBe("not_required");

    const createdExperiment = await Experiment.findByPk(
      response.body.data.experiment.id,
    );

    expect(createdExperiment).not.toBeNull();
    expect(createdExperiment.reviewStatus).toBe("not_required");
  });

  it("creates a protocol with review not submitted when researcher review is required", async () => {
    await researcher.update({
      requiresReview: true,
    });

    const researcherToken = await loginAndGetToken("researcher@test.com");

    const response = await request(app)
      .post("/api/protocols")
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        title: "Review-required protocol",
        version: "1.0",
        purpose: "Verify the default protocol review policy.",
        content: "1. Prepare the sample.\n2. Run the analysis.",
        projectId: supervisedProject.id,
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.protocol.approvalStatus).toBe("draft");
    expect(response.body.data.protocol.reviewStatus).toBe("not_submitted");

    const createdProtocol = await Protocol.findByPk(
      response.body.data.protocol.id,
    );

    expect(createdProtocol).not.toBeNull();
    expect(createdProtocol.approvalStatus).toBe("draft");
    expect(createdProtocol.reviewStatus).toBe("not_submitted");
  });

  it("creates a protocol with review not required when researcher is exempt", async () => {
    await researcher.update({
      requiresReview: false,
    });

    const researcherToken = await loginAndGetToken("researcher@test.com");

    const response = await request(app)
      .post("/api/protocols")
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        title: "Review-exempt protocol",
        version: "1.0",
        purpose: "Verify the exempt protocol review policy.",
        content: "1. Prepare the sample.\n2. Run the analysis.",
        projectId: supervisedProject.id,
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.protocol.approvalStatus).toBe("draft");
    expect(response.body.data.protocol.reviewStatus).toBe("not_required");

    const createdProtocol = await Protocol.findByPk(
      response.body.data.protocol.id,
    );

    expect(createdProtocol).not.toBeNull();
    expect(createdProtocol.approvalStatus).toBe("draft");
    expect(createdProtocol.reviewStatus).toBe("not_required");
  });

  it("allows an admin to approve an experiment", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
      organizationId: supervisedProject.organizationId,
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
      organizationId: supervisedProject.organizationId,
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
      organizationId: supervisedProject.organizationId,
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
      organizationId: otherProject.organizationId,
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
      organizationId: supervisedProject.organizationId,
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
      organizationId: supervisedProject.organizationId,
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
      organizationId: supervisedProject.organizationId,
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
      organizationId: otherProject.organizationId,
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
      organizationId: supervisor.organizationId,
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
      organizationId: supervisedProject.organizationId,
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
      organizationId: supervisedProject.organizationId,
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

  it("rejects a non-string protocol title", async () => {
    const response = await request(app)
      .post("/api/protocols")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: 123,
        content: "Valid protocol content",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Protocol title must be a string.");
  });

  it("rejects a non-string protocol content", async () => {
    const response = await request(app)
      .post("/api/protocols")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Valid protocol title",
        content: 123,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Protocol content must be a string.");
  });

  it("rejects an invalid protocol project ID", async () => {
    const response = await request(app)
      .post("/api/protocols")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Valid protocol title",
        content: "Valid protocol content",
        projectId: "abc",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Protocol project ID must be a positive integer or null.",
    );
  });

  it("rejects an overlong protocol version on create", async () => {
    const response = await request(app)
      .post("/api/protocols")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Valid protocol title",
        content: "Valid protocol content",
        version: "123456789012345678901234567890123456789012345678901",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Protocol version must be 50 characters or fewer.",
    );
  });

  it("rejects an invalid protocol project ID query filter", async () => {
    const response = await request(app)
      .get("/api/protocols?projectId=abc")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Protocol project ID must be a positive integer.",
    );
  });

  it("rejects a non-string protocol version on update", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        version: 123,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Protocol version must be a string or null.",
    );
  });

  it("rejects a blank protocol version on update", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        version: "   ",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Protocol version is required.");
  });

  it("rejects an overlong protocol version on update", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        version: "123456789012345678901234567890123456789012345678901",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Protocol version must be 50 characters or fewer.",
    );
  });

  it("rejects a non-string protocol archive reason", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .delete(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        archiveReason: 123,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Protocol archive reason must be a string or null.",
    );
  });

  it("keeps the existing protocol version when update version is null", async () => {
    const protocol = await createProtocol({
      projectId: supervisedProject.id,
      createdById: researcher.id,
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .patch(`/api/protocols/${protocol.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        version: null,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.protocol.version).toBe("1.0");
  });

  it("rejects a non-string experiment title", async () => {
    const response = await request(app)
      .post("/api/experiments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: 123,
        projectId: supervisedProject.id,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Experiment title must be a string.");
  });

  it("rejects a whitespace-only experiment title", async () => {
    const response = await request(app)
      .post("/api/experiments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "   ",
        projectId: supervisedProject.id,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Experiment title is required.");
  });

  it("rejects an invalid experiment start calendar date", async () => {
    const response = await request(app)
      .post("/api/experiments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Invalid date experiment",
        projectId: supervisedProject.id,
        startedAt: "2026-02-31",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Experiment start date must be a valid calendar date.",
    );
  });

  it("preserves the existing researcher when experiment researcherId is null", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
      reviewStatus: "not_submitted",
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .patch(`/api/experiments/${experiment.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        researcherId: null,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.experiment.researcherId).toBe(researcher.id);
  });

  it("rejects experiment completion before the start date on update", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
      reviewStatus: "not_submitted",
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .patch(`/api/experiments/${experiment.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        startedAt: "2026-08-20",
        completedAt: "2026-08-19",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Experiment completion date cannot be before the start date.",
    );
  });

  it("rejects a non-string experiment archive reason", async () => {
    const experiment = await createExperiment({
      projectId: supervisedProject.id,
      researcherId: researcher.id,
      createdById: researcher.id,
      reviewStatus: "not_submitted",
      organizationId: supervisedProject.organizationId,
    });

    const response = await request(app)
      .delete(`/api/experiments/${experiment.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        archiveReason: 123,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "Experiment archive reason must be a string or null.",
    );
  });
});
