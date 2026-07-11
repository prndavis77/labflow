const request = require("supertest");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User } = require("../models");

const {
  createTestUser,
  loginAndGetToken,
  getOrCreateTestOrganization,
} = require("./helpers/testHelpers");
const { resetTestDatabase } = require("./helpers/dbHelpers");

describe("Authorization", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await createTestUser({
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
    });

    await createTestUser({
      name: "Test Researcher",
      email: "researcher@test.com",
      role: "researcher",
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("rejects protected user routes without a token", async () => {
    const response = await request(app).get("/api/users");

    expect(response.statusCode).toBe(401);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Not authorized, no token provided.");
  });

  it("allows authenticated researchers to access the user list", async () => {
    const researcherToken = await loginAndGetToken("researcher@test.com");

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${researcherToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data.users)).toBe(true);
  });

  it("allows admin access to the user list", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data.users)).toBe(true);
  });

  it("rejects researcher role updates", async () => {
    const researcherToken = await loginAndGetToken("researcher@test.com");

    const targetUser = await User.findOne({
      where: { email: "researcher@test.com" },
    });

    const response = await request(app)
      .patch(`/api/users/${targetUser.id}/role`)
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        role: "supervisor",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
  });

  it("allows admin role updates", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const targetUser = await User.findOne({
      where: { email: "researcher@test.com" },
    });

    const response = await request(app)
      .patch(`/api/users/${targetUser.id}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "supervisor",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.user.role).toBe("supervisor");
  });

  it("allows an admin to deactivate another user", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.isActive).toBe(false);

    const updatedResearcher = await User.findByPk(researcher.id);

    expect(updatedResearcher.isActive).toBe(false);
    expect(updatedResearcher.deactivatedAt).not.toBeNull();
    expect(updatedResearcher.deactivatedById).toBeDefined();
  });

  it("allows an admin to reactivate another user", async () => {
    const admin = await User.findOne({
      where: {
        email: "admin@test.com",
      },
    });

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    await researcher.update({
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedById: admin.id,
    });

    const adminToken = await loginAndGetToken("admin@test.com");

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        isActive: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.isActive).toBe(true);

    const updatedResearcher = await User.findByPk(researcher.id);

    expect(updatedResearcher.isActive).toBe(true);
    expect(updatedResearcher.deactivatedAt).toBeNull();
    expect(updatedResearcher.deactivatedById).toBeNull();
  });

  it("rejects admin attempt to deactivate their own account", async () => {
    const admin = await User.findOne({
      where: {
        email: "admin@test.com",
      },
    });

    const adminToken = await loginAndGetToken("admin@test.com");

    const response = await request(app)
      .patch(`/api/users/${admin.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        isActive: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "You cannot deactivate your own account.",
    );

    const updatedAdmin = await User.findByPk(admin.id);

    expect(updatedAdmin.isActive).toBe(true);
  });

  it("rejects account status updates from non-admin users", async () => {
    const researcherToken = await loginAndGetToken("researcher@test.com");

    const admin = await User.findOne({
      where: {
        email: "admin@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${admin.id}/status`)
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        isActive: false,
      });

    expect(response.status).toBe(403);
  });

  it("allows an admin to reset another user's password", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newPassword: "newPassword123",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("User password reset successfully.");
  });

  it("rejects login with the old password after admin password reset", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    await request(app)
      .patch(`/api/users/${researcher.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newPassword: "newPassword123",
      });

    const response = await request(app).post("/api/auth/login").send({
      email: "researcher@test.com",
      password: "password123",
    });

    expect(response.status).toBe(401);
  });

  it("allows login with the new password after admin password reset", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    await request(app)
      .patch(`/api/users/${researcher.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newPassword: "newPassword123",
      });

    const response = await request(app).post("/api/auth/login").send({
      email: "researcher@test.com",
      password: "newPassword123",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeDefined();
  });

  it("rejects password reset from non-admin users", async () => {
    const researcherToken = await loginAndGetToken("researcher@test.com");

    const admin = await User.findOne({
      where: {
        email: "admin@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${admin.id}/password`)
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        newPassword: "newPassword123",
      });

    expect(response.status).toBe(403);
  });

  it("rejects admin attempt to reset their own password from the admin endpoint", async () => {
    const admin = await User.findOne({
      where: {
        email: "admin@test.com",
      },
    });

    const adminToken = await loginAndGetToken("admin@test.com");

    const response = await request(app)
      .patch(`/api/users/${admin.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newPassword: "newPassword123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "You cannot reset your own password from this page.",
    );
  });

  it("rejects admin password reset when the new password is too short", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newPassword: "short",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "New password must be at least 8 characters.",
    );
  });

  it("allows an admin to disable review requirements for a researcher", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        requiresReview: false,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.user.requiresReview).toBe(false);

    const updatedResearcher = await User.findByPk(researcher.id);

    expect(updatedResearcher.requiresReview).toBe(false);
  });

  it("allows an admin to enable review requirements for a researcher", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    await researcher.update({
      requiresReview: false,
    });

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        requiresReview: true,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.user.requiresReview).toBe(true);

    const updatedResearcher = await User.findByPk(researcher.id);

    expect(updatedResearcher.requiresReview).toBe(true);
  });

  it("rejects a non-boolean review requirement value", async () => {
    const adminToken = await loginAndGetToken("admin@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        requiresReview: "false",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe(
      "requiresReview must be a boolean value.",
    );

    const unchangedResearcher = await User.findByPk(researcher.id);

    expect(unchangedResearcher.requiresReview).toBe(true);
  });

  it("rejects review requirement updates from a researcher", async () => {
    const researcherToken = await loginAndGetToken("researcher@test.com");

    const researcher = await User.findOne({
      where: {
        email: "researcher@test.com",
      },
    });

    const response = await request(app)
      .patch(`/api/users/${researcher.id}/permissions`)
      .set("Authorization", `Bearer ${researcherToken}`)
      .send({
        requiresReview: false,
      });

    expect(response.statusCode).toBe(403);

    const unchangedResearcher = await User.findByPk(researcher.id);

    expect(unchangedResearcher.requiresReview).toBe(true);
  });
});
