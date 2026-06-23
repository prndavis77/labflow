const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User } = require("../models");

describe("Authentication", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await User.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });

    const passwordHash = await bcrypt.hash("password123", 12);

    await User.create({
      name: "Test Admin",
      email: "admin@test.com",
      passwordHash,
      role: "admin",
      department: "Testing",
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("logs in with valid credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("Login successful.");
    expect(response.body.data).toHaveProperty("token");
    expect(response.body.data.user.email).toBe("admin@test.com");
    expect(response.body.data.user.role).toBe("admin");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects login with invalid password", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "wrongpassword",
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      status: "error",
      message: "Invalid email or password.",
    });
  });

  it("rejects /me without a token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      status: "error",
      message: "Not authorized, no token provided.",
    });
  });

  it("returns the current user with a valid token", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    const token = loginResponse.body.data.token;

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.user.email).toBe("admin@test.com");
    expect(response.body.data.user.role).toBe("admin");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });
});
