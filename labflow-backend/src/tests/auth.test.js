const request = require("supertest");

jest.mock("../services/emailVerificationEmailService", () => ({
  sendEmailVerificationEmail: jest.fn(),
}));

const {
  sendEmailVerificationEmail,
} = require("../services/emailVerificationEmailService");

const app = require("../server");

const { sequelize } = require("../config/database");

const { User, Organization, EmailVerificationToken } = require("../models");

const { createTestUser } = require("./helpers/testHelpers");

const createRegistrationPayload = (overrides = {}) => ({
  name: "Workspace Admin",
  email: "workspace-admin@test.com",
  password: "password123",
  department: "Analytical Chemistry",
  organizationName: "Authentication Test Laboratory",
  organizationType: "lab",
  ...overrides,
});

describe("Authentication", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    sendEmailVerificationEmail.mockResolvedValue({
      provider: "disabled",
      accepted: false,
      skipped: true,
      messageId: null,
    });

    await User.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });

    await createTestUser({
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
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

  it("rejects login for a deactivated user", async () => {
    await User.update(
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedById: null,
      },
      {
        where: {
          email: "admin@test.com",
        },
      },
    );

    const response = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("This account has been deactivated.");
  });

  it("rejects /me for a deactivated user with an old token", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    const token = loginResponse.body.data.token;

    await User.update(
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedById: null,
      },
      {
        where: {
          email: "admin@test.com",
        },
      },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("This account has been deactivated.");
  });

  it("registers an unverified administrator and creates an active verification token when delivery is skipped", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(createRegistrationPayload());

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");

    expect(response.body.data.emailVerification).toEqual({
      required: true,
      sent: false,
      deliverySkipped: true,
    });

    expect(response.body.data.user.emailVerifiedAt).toBeNull();

    expect(response.body.data).toHaveProperty("token");

    const responseText = JSON.stringify(response.body);

    expect(responseText).not.toMatch(
      /rawToken|tokenHash|verificationTokenId|verificationLink/,
    );

    const registeredUser = await User.findOne({
      where: {
        email: "workspace-admin@test.com",
      },
    });

    expect(registeredUser).toBeTruthy();
    expect(registeredUser.emailVerifiedAt).toBeNull();

    const verificationTokens = await EmailVerificationToken.findAll({
      where: {
        userId: registeredUser.id,
      },
    });

    expect(verificationTokens).toHaveLength(1);

    const [verificationToken] = verificationTokens;

    expect(verificationToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(verificationToken.expiresAt).toBeInstanceOf(Date);

    expect(verificationToken.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(verificationToken.consumedAt).toBeNull();

    expect(verificationToken.invalidatedAt).toBeNull();

    expect(sendEmailVerificationEmail).toHaveBeenCalledTimes(1);

    expect(sendEmailVerificationEmail).toHaveBeenCalledWith({
      to: "workspace-admin@test.com",
      userName: "Workspace Admin",
      organizationName: "Authentication Test Laboratory",
      verificationLink: expect.stringContaining("/verify-email/"),
      expiresAt: expect.any(Date),
    });
  });

  it("keeps the registered workspace but invalidates the verification token when delivery fails", async () => {
    sendEmailVerificationEmail.mockRejectedValue(
      new Error("Mail provider unavailable."),
    );

    const response = await request(app)
      .post("/api/auth/register")
      .send(
        createRegistrationPayload({
          email: "failed-verification@test.com",
          organizationName: "Failed Verification Laboratory",
        }),
      );

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe("success");

    expect(response.body.data.emailVerification).toEqual({
      required: true,
      sent: false,
      deliverySkipped: false,
    });

    expect(response.body.data.user.emailVerifiedAt).toBeNull();

    const registeredUser = await User.findOne({
      where: {
        email: "failed-verification@test.com",
      },
    });

    expect(registeredUser).toBeTruthy();
    expect(registeredUser.emailVerifiedAt).toBeNull();

    const organization = await Organization.findByPk(
      registeredUser.organizationId,
    );

    expect(organization).toBeTruthy();
    expect(organization.isActive).toBe(true);

    const verificationTokens = await EmailVerificationToken.findAll({
      where: {
        userId: registeredUser.id,
      },
    });

    expect(verificationTokens).toHaveLength(1);

    const [verificationToken] = verificationTokens;

    expect(verificationToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(verificationToken.consumedAt).toBeNull();

    expect(verificationToken.invalidatedAt).toBeInstanceOf(Date);

    const responseText = JSON.stringify(response.body);

    expect(responseText).not.toMatch(
      /rawToken|tokenHash|verificationTokenId|verificationLink/,
    );
  });
});
