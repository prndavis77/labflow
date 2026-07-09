const request = require("supertest");

const app = require("../server");
const { sequelize } = require("../config/database");
const { AuditLog, Organization } = require("../models");
const {
  TEST_PASSWORD,
  createTestUser,
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

describe("Organization Settings API", () => {
  let organization;
  let secondOrganization;
  let adminToken;
  let researcherToken;
  let secondAdminToken;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await sequelize.query(`
      TRUNCATE TABLE
        audit_logs,
        invitations,
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

    organization = await getOrCreateTestOrganization();
    secondOrganization = await createSecondTestOrganization();

    await createTestUser({
      name: "Admin User",
      email: "admin@test.com",
      role: "admin",
      organizationId: organization.id,
    });

    await createTestUser({
      name: "Researcher User",
      email: "researcher@test.com",
      role: "researcher",
      organizationId: organization.id,
    });

    await createTestUser({
      name: "Second Admin",
      email: "second-admin@test.com",
      role: "admin",
      organizationId: secondOrganization.id,
    });

    adminToken = await loginAndGetToken("admin@test.com");
    researcherToken = await loginAndGetToken("researcher@test.com");
    secondAdminToken = await loginAndGetToken("second-admin@test.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("allows an authenticated user to view their organization", async () => {
    const response = await request(app)
      .get("/api/organization")
      .set("Authorization", `Bearer ${researcherToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.organization.id).toBe(organization.id);
    expect(response.body.data.organization.name).toBe(organization.name);
    expect(response.body.data.organization.slug).toBe(organization.slug);
  });

  it("prevents unauthenticated users from viewing organization settings", async () => {
    const response = await request(app).get("/api/organization");

    expect(response.statusCode).toBe(401);
  });

  it("allows an admin to update their organization name and type", async () => {
    const response = await request(app)
      .patch("/api/organization")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "DNA Laboratory",
        type: "department",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.organization.id).toBe(organization.id);
    expect(response.body.data.organization.name).toBe("DNA Laboratory");
    expect(response.body.data.organization.type).toBe("department");

    const updatedOrganization = await Organization.findByPk(organization.id);

    expect(updatedOrganization.name).toBe("DNA Laboratory");
    expect(updatedOrganization.type).toBe("department");
  });

  it("prevents researchers from updating organization settings", async () => {
    const response = await request(app)
      .patch("/api/organization")
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        name: "Unauthorized Lab Name",
        type: "department",
      });

    expect(response.statusCode).toBe(403);

    const unchangedOrganization = await Organization.findByPk(organization.id);

    expect(unchangedOrganization.name).toBe(organization.name);
  });

  it("rejects an empty organization name", async () => {
    const response = await request(app)
      .patch("/api/organization")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "   ",
        type: "department",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Organization name is required.");
  });

  it("updates only the authenticated admin's organization", async () => {
    await request(app)
      .patch("/api/organization")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "DNA Laboratory",
        type: "department",
      });

    const firstOrganization = await Organization.findByPk(organization.id);
    const otherOrganization = await Organization.findByPk(
      secondOrganization.id,
    );

    expect(firstOrganization.name).toBe("DNA Laboratory");
    expect(otherOrganization.name).toBe(secondOrganization.name);
  });

  it("allows another organization admin to update only their own organization", async () => {
    const response = await request(app)
      .patch("/api/organization")
      .set("Authorization", `Bearer ${secondAdminToken}`)
      .send({
        name: "Toxicology Laboratory",
        type: "lab",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.organization.id).toBe(secondOrganization.id);
    expect(response.body.data.organization.name).toBe("Toxicology Laboratory");

    const firstOrganization = await Organization.findByPk(organization.id);
    const otherOrganization = await Organization.findByPk(
      secondOrganization.id,
    );

    expect(firstOrganization.name).toBe(organization.name);
    expect(otherOrganization.name).toBe("Toxicology Laboratory");
  });

  it("writes an audit log when organization settings are updated", async () => {
    await request(app)
      .patch("/api/organization")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "DNA Laboratory",
        type: "department",
      });

    const auditLog = await AuditLog.findOne({
      where: {
        action: "organization.updated",
        entityType: "organization",
        entityId: organization.id,
        organizationId: organization.id,
      },
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog.summary).toBe(
      "Updated organization settings for DNA Laboratory.",
    );
    expect(auditLog.metadata.previousValues.name).toBe(organization.name);
    expect(auditLog.metadata.newValues.name).toBe("DNA Laboratory");
  });
});
