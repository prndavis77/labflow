const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User } = require("../models");

const {
  createPasswordResetRequest,
  resetPasswordWithToken,
} = require("../services/passwordResetService");

const {
  TEST_PASSWORD,
  createTestUser,
  loginAndGetToken,
} = require("./helpers/testHelpers");

const { resetTestDatabase } = require("./helpers/dbHelpers");

const SESSION_INVALIDATED_RESPONSE = {
  status: "error",
  code: "SESSION_INVALIDATED",
  message: "Your session is no longer valid. Please log in again.",
};

const createLegacyToken = (user, overrides = {}) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      ...overrides,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

const getCurrentUser = (token) => {
  return request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);
};

describe("JWT session invalidation", () => {
  let admin;
  let researcher;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    admin = await createTestUser({
      name: "Session Admin",
      email: "session-admin@test.com",
      role: "admin",
    });

    researcher = await createTestUser({
      name: "Session Researcher",
      email: "session-researcher@test.com",
      role: "researcher",
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("includes the current tokenVersion in newly issued login tokens", async () => {
    await researcher.update({
      tokenVersion: 3,
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: researcher.email,
      password: TEST_PASSWORD,
    });

    expect(loginResponse.status).toBe(200);

    const decoded = jwt.verify(
      loginResponse.body.data.token,
      process.env.JWT_SECRET,
    );

    expect(decoded.tokenVersion).toBe(3);
  });

  it("allows a token whose version matches the database", async () => {
    const token = await loginAndGetToken(researcher.email);

    const response = await getCurrentUser(token);

    expect(response.status).toBe(200);

    expect(response.body.data.user.id).toBe(researcher.id);
  });

  it("rejects an existing token after a forgotten-password reset", async () => {
    const oldToken = await loginAndGetToken(researcher.email);

    const resetRequest = await createPasswordResetRequest({
      email: researcher.email,
    });

    expect(resetRequest.created).toBe(true);

    await resetPasswordWithToken({
      rawToken: resetRequest.rawToken,
      newPassword: "forgottenResetPassword123",
    });

    const response = await getCurrentUser(oldToken);

    expect(response.status).toBe(401);

    expect(response.body).toEqual(SESSION_INVALIDATED_RESPONSE);
  });

  it("accepts a fresh login token after a forgotten-password reset", async () => {
    const oldToken = await loginAndGetToken(researcher.email);

    const resetRequest = await createPasswordResetRequest({
      email: researcher.email,
    });

    await resetPasswordWithToken({
      rawToken: resetRequest.rawToken,
      newPassword: "forgottenResetPassword123",
    });

    const staleResponse = await getCurrentUser(oldToken);

    expect(staleResponse.status).toBe(401);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: researcher.email,
      password: "forgottenResetPassword123",
    });

    expect(loginResponse.status).toBe(200);

    const freshToken = loginResponse.body.data.token;

    const decoded = jwt.verify(freshToken, process.env.JWT_SECRET);

    expect(decoded.tokenVersion).toBe(1);

    const freshResponse = await getCurrentUser(freshToken);

    expect(freshResponse.status).toBe(200);
  });

  it("rejects an existing user token after an administrator resets the password", async () => {
    const researcherToken = await loginAndGetToken(researcher.email);

    const adminToken = await loginAndGetToken(admin.email);

    const resetResponse = await request(app)
      .patch(`/api/users/${researcher.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newPassword: "adminResetPassword123",
      });

    expect(resetResponse.status).toBe(200);

    await researcher.reload();

    expect(researcher.tokenVersion).toBe(1);

    const response = await getCurrentUser(researcherToken);

    expect(response.status).toBe(401);

    expect(response.body).toEqual(SESSION_INVALIDATED_RESPONSE);
  });

  it("accepts a fresh login token after an administrator password reset", async () => {
    const adminToken = await loginAndGetToken(admin.email);

    await request(app)
      .patch(`/api/users/${researcher.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newPassword: "adminResetPassword123",
      })
      .expect(200);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: researcher.email,
      password: "adminResetPassword123",
    });

    expect(loginResponse.status).toBe(200);

    const decoded = jwt.verify(
      loginResponse.body.data.token,
      process.env.JWT_SECRET,
    );

    expect(decoded.tokenVersion).toBe(1);

    const protectedResponse = await getCurrentUser(
      loginResponse.body.data.token,
    );

    expect(protectedResponse.status).toBe(200);
  });

  it("accepts a legacy token without tokenVersion when the database version is zero", async () => {
    const legacyToken = createLegacyToken(researcher);

    const decoded = jwt.verify(legacyToken, process.env.JWT_SECRET);

    expect(decoded).not.toHaveProperty("tokenVersion");

    const response = await getCurrentUser(legacyToken);

    expect(response.status).toBe(200);
  });

  it("rejects a legacy token without tokenVersion when the database version is greater than zero", async () => {
    const legacyToken = createLegacyToken(researcher);

    await researcher.update({
      tokenVersion: 1,
    });

    const response = await getCurrentUser(legacyToken);

    expect(response.status).toBe(401);

    expect(response.body).toEqual(SESSION_INVALIDATED_RESPONSE);
  });

  it.each([
    ["non-numeric", "invalid"],
    ["fractional", 0.5],
  ])("rejects a %s tokenVersion", async (_, tokenVersion) => {
    const malformedToken = createLegacyToken(researcher, {
      tokenVersion,
    });

    const response = await getCurrentUser(malformedToken);

    expect(response.status).toBe(401);

    expect(response.body).toEqual(SESSION_INVALIDATED_RESPONSE);
  });

  it("checks session invalidation before email-verification restrictions", async () => {
    const unverifiedUser = await createTestUser({
      name: "Unverified Session User",
      email: "unverified-session@test.com",
      role: "admin",
      emailVerifiedAt: null,
    });

    const oldToken = await loginAndGetToken(unverifiedUser.email);

    await unverifiedUser.update({
      tokenVersion: 1,
    });

    const staleResponse = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${oldToken}`);

    expect(staleResponse.status).toBe(401);

    expect(staleResponse.body).toEqual(SESSION_INVALIDATED_RESPONSE);

    const freshLoginResponse = await request(app).post("/api/auth/login").send({
      email: unverifiedUser.email,
      password: TEST_PASSWORD,
    });

    expect(freshLoginResponse.status).toBe(200);

    const freshResponse = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${freshLoginResponse.body.data.token}`);

    expect(freshResponse.status).toBe(403);

    expect(freshResponse.body.code).toBe("EMAIL_VERIFICATION_REQUIRED");
  });
});
