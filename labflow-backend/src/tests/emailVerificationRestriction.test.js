const request = require("supertest");

jest.mock("../services/emailVerificationEmailService", () => ({
  sendEmailVerificationEmail: jest.fn(),
}));

const {
  sendEmailVerificationEmail,
} = require("../services/emailVerificationEmailService");

const app = require("../server");

const { sequelize } = require("../config/database");

const { User, EmailVerificationToken } = require("../models");

const {
  TEST_PASSWORD,
  createTestUser,
  loginAndGetToken,
} = require("./helpers/testHelpers");

const resetRestrictionTables = async () => {
  await sequelize.query(`
      TRUNCATE TABLE
        password_reset_tokens,
        email_verification_tokens,
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
};

describe("Email verification access restrictions", () => {
  let unverifiedUser;
  let verifiedUser;
  let unverifiedToken;
  let verifiedToken;

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

    await resetRestrictionTables();

    unverifiedUser = await createTestUser({
      name: "Unverified Admin",
      email: "unverified-access@test.com",
      role: "admin",
      emailVerifiedAt: null,
    });

    verifiedUser = await createTestUser({
      name: "Verified Admin",
      email: "verified-access@test.com",
      role: "admin",
    });

    unverifiedToken = await loginAndGetToken(unverifiedUser.email);

    verifiedToken = await loginAndGetToken(verifiedUser.email);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("allows an unverified user to read the current account", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(response.statusCode).toBe(200);

    expect(response.body.data.user.emailVerifiedAt).toBeNull();
  });

  it("allows an unverified user to request another verification email", async () => {
    const response = await request(app)
      .post("/api/auth/email-verification/request")
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(response.statusCode).toBe(200);

    expect(response.body.data.alreadyVerified).toBe(false);

    expect(response.body.data.deliverySkipped).toBe(true);

    expect(sendEmailVerificationEmail).toHaveBeenCalledTimes(1);

    const storedToken = await EmailVerificationToken.findOne({
      where: {
        userId: unverifiedUser.id,
      },
    });

    expect(storedToken).toBeTruthy();
    expect(storedToken.invalidatedAt).toBeNull();
  });

  it("blocks an unverified user from the dashboard API", async () => {
    const response = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(response.statusCode).toBe(403);

    expect(response.body).toEqual({
      status: "error",
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Verify your email address before using this feature.",
    });
  });

  it("blocks an unverified user from a normal resource API", async () => {
    const response = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(response.statusCode).toBe(403);

    expect(response.body).toEqual({
      status: "error",
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Verify your email address before using this feature.",
    });
  });

  it("does not replace authentication errors with verification errors", async () => {
    const response = await request(app).get("/api/dashboard/summary");

    expect(response.statusCode).toBe(401);

    expect(response.body.code).toBeUndefined();
  });

  it("allows a verified user to access normal APIs", async () => {
    const response = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${verifiedToken}`);

    expect(response.statusCode).toBe(200);
  });

  it("allows access after the user becomes verified without issuing a new JWT", async () => {
    const blockedResponse = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(blockedResponse.statusCode).toBe(403);

    await User.update(
      {
        emailVerifiedAt: new Date(),
      },
      {
        where: {
          id: unverifiedUser.id,
        },
      },
    );

    const allowedResponse = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(allowedResponse.statusCode).toBe(200);
  });
});
