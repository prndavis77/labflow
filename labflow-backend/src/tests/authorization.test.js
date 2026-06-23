const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User } = require("../models");

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

describe("Authorization", () => {
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

    await createUser({
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
    });

    await createUser({
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
