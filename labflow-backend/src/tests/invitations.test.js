const request = require("supertest");

const app = require("../server");
const { sequelize } = require("../config/database");
const { Invitation, User } = require("../models");
const {
  TEST_PASSWORD,
  createTestUser,
  getOrCreateTestOrganization,
  createSecondTestOrganization,
} = require("./helpers/testHelpers");
const { hashInvitationToken } = require("../utils/invitationTokens");

const loginAndGetToken = async (email) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: TEST_PASSWORD,
  });

  return response.body.data.token;
};

const createInvitationPayload = (overrides = {}) => ({
  name: "Invited Researcher",
  email: "invited.researcher@test.com",
  role: "researcher",
  department: "Analytical Chemistry",
  canCreateExperiments: true,
  canEditExperiments: true,
  canCreateProtocols: false,
  canEditProtocols: false,
  ...overrides,
});

describe("Invitations API", () => {
  let organization;
  let secondOrganization;
  let admin;
  let researcher;
  let secondAdmin;
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

    admin = await createTestUser({
      name: "Admin User",
      email: "admin@test.com",
      role: "admin",
      organizationId: organization.id,
    });

    researcher = await createTestUser({
      name: "Researcher User",
      email: "researcher@test.com",
      role: "researcher",
      organizationId: organization.id,
    });

    secondAdmin = await createTestUser({
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

  it("allows an admin to create an invitation for their organization", async () => {
    const response = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload());

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.invitation.email).toBe(
      "invited.researcher@test.com",
    );
    expect(response.body.data.invitation.organizationId).toBe(organization.id);
    expect(response.body.data.invitation.department).toBe(
      "Analytical Chemistry",
    );
    expect(response.body.data.inviteLink).toContain("/accept-invite/");

    const invitation = await Invitation.findOne({
      where: { email: "invited.researcher@test.com" },
    });

    expect(invitation).toBeTruthy();
    expect(invitation.organizationId).toBe(organization.id);
    expect(invitation.status).toBe("pending");
    expect(invitation.tokenHash).toBeTruthy();
    expect(response.body.data.inviteLink).not.toContain(invitation.tokenHash);
  });

  it("prevents a researcher from creating an invitation", async () => {
    const response = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${researcherToken}`)
      .send(createInvitationPayload({ email: "blocked@test.com" }));

    expect(response.statusCode).toBe(403);
  });

  it("prevents duplicate pending invitations for the same email in the same organization", async () => {
    await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload());

    const response = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload());

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe(
      "A pending invitation already exists for this email.",
    );
  });

  it("prevents inviting an existing user in the same organization", async () => {
    const response = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(
        createInvitationPayload({
          email: "researcher@test.com",
        }),
      );

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe(
      "A user with this email already exists in this organization.",
    );
  });

  it("allows an invited user to inspect a valid invitation", async () => {
    const createResponse = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload());

    const inviteLink = createResponse.body.data.inviteLink;
    const token = inviteLink.split("/accept-invite/")[1];

    const response = await request(app).get(`/api/invitations/accept/${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.invitation.email).toBe(
      "invited.researcher@test.com",
    );
    expect(response.body.data.invitation.organization.name).toBe(
      organization.name,
    );
    expect(response.body.data.invitation.department).toBe(
      "Analytical Chemistry",
    );
  });

  it("accepts an invitation and creates a user in the invitation organization", async () => {
    const createResponse = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload());

    const inviteLink = createResponse.body.data.inviteLink;
    const token = inviteLink.split("/accept-invite/")[1];

    const response = await request(app)
      .post(`/api/invitations/accept/${token}`)
      .send({
        password: "password123",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");

    const user = await User.findOne({
      where: {
        email: "invited.researcher@test.com",
        organizationId: organization.id,
      },
    });

    expect(user).toBeTruthy();
    expect(user.name).toBe("Invited Researcher");
    expect(user.role).toBe("researcher");
    expect(user.department).toBe("Analytical Chemistry");
    expect(user.canCreateExperiments).toBe(true);
    expect(user.canEditExperiments).toBe(true);
    expect(user.canCreateProtocols).toBe(false);
    expect(user.canEditProtocols).toBe(false);

    const invitation = await Invitation.findOne({
      where: { email: "invited.researcher@test.com" },
    });

    expect(invitation.status).toBe("accepted");
    expect(invitation.acceptedUserId).toBe(user.id);
    expect(invitation.acceptedAt).toBeTruthy();
  });

  it("prevents an accepted invitation from being reused", async () => {
    const createResponse = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload());

    const inviteLink = createResponse.body.data.inviteLink;
    const token = inviteLink.split("/accept-invite/")[1];

    await request(app).post(`/api/invitations/accept/${token}`).send({
      password: "password123",
    });

    const response = await request(app)
      .post(`/api/invitations/accept/${token}`)
      .send({
        password: "password123",
      });

    expect(response.statusCode).toBe(404);
  });

  it("rejects an expired invitation", async () => {
    const rawToken = "expired-token";
    const tokenHash = hashInvitationToken(rawToken);

    await Invitation.create({
      organizationId: organization.id,
      email: "expired@test.com",
      name: "Expired User",
      role: "researcher",
      department: "Chemistry",
      tokenHash,
      status: "pending",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      invitedById: admin.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: false,
      canEditProtocols: false,
    });

    const response = await request(app).get(
      `/api/invitations/accept/${rawToken}`,
    );

    expect(response.statusCode).toBe(410);

    const invitation = await Invitation.findOne({
      where: { email: "expired@test.com" },
    });

    expect(invitation.status).toBe("expired");
  });

  it("prevents an admin from revoking another organization's invitation", async () => {
    const rawToken = "other-org-token";
    const tokenHash = hashInvitationToken(rawToken);

    const invitation = await Invitation.create({
      organizationId: secondOrganization.id,
      email: "other-org-invite@test.com",
      name: "Other Org Invite",
      role: "researcher",
      department: "Other Department",
      tokenHash,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedById: secondAdmin.id,
      canCreateExperiments: false,
      canEditExperiments: false,
      canCreateProtocols: false,
      canEditProtocols: false,
    });

    const response = await request(app)
      .patch(`/api/invitations/${invitation.id}/revoke`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(404);
  });

  it("allows an admin to revoke a pending invitation in their organization", async () => {
    const createResponse = await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload({ email: "revoke@test.com" }));

    const invitationId = createResponse.body.data.invitation.id;

    const response = await request(app)
      .patch(`/api/invitations/${invitationId}/revoke`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.invitation.status).toBe("revoked");
  });

  it("lists only invitations from the admin's organization", async () => {
    await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(createInvitationPayload({ email: "own-org@test.com" }));

    await request(app)
      .post("/api/invitations")
      .set("Authorization", `Bearer ${secondAdminToken}`)
      .send(
        createInvitationPayload({
          email: "second-org@test.com",
          name: "Second Org Invite",
        }),
      );

    const response = await request(app)
      .get("/api/invitations")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);

    const emails = response.body.data.invitations.map(
      (invitation) => invitation.email,
    );

    expect(emails).toContain("own-org@test.com");
    expect(emails).not.toContain("second-org@test.com");
  });
});
