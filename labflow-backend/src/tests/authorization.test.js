const request = require("supertest");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User } = require("../models");

const { createTestUser, loginAndGetToken } = require("./helpers/testHelpers");
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
});
