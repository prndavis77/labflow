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

const {
  createEmailVerificationRequest,
} = require("../services/emailVerificationService");

const {
  TEST_PASSWORD,
  createTestUser,
  getOrCreateTestOrganization,
  createSecondTestOrganization,
} = require("./helpers/testHelpers");

const VERIFICATION_REQUEST_PATH = "/api/auth/email-verification/request";

const getVerificationPath = (rawToken) =>
  `/api/auth/email-verification/${rawToken}`;

const loginAndGetToken = async (email) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: TEST_PASSWORD,
  });

  expect(response.statusCode).toBe(200);

  return response.body.data.token;
};

const extractRawTokenFromEmailCall = () => {
  expect(sendEmailVerificationEmail).toHaveBeenCalled();

  const { verificationLink } = sendEmailVerificationEmail.mock.calls.at(-1)[0];

  const parsedUrl = new URL(verificationLink);

  return parsedUrl.pathname.split("/").filter(Boolean).at(-1);
};

const createDirectVerificationToken = async ({
  userId,
  requestIp = "127.0.0.1",
}) => {
  const result = await createEmailVerificationRequest({
    userId,
    requestIp,
  });

  expect(result.created).toBe(true);
  expect(result.rawToken).toEqual(expect.any(String));

  return result;
};

describe("Email verification API", () => {
  let organization;
  let secondOrganization;
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

    organization = await getOrCreateTestOrganization();

    secondOrganization = await createSecondTestOrganization();

    unverifiedUser = await createTestUser({
      name: "Unverified Admin",
      email: "unverified-admin@test.com",
      role: "admin",
      organizationId: organization.id,
      emailVerifiedAt: null,
    });

    verifiedUser = await createTestUser({
      name: "Verified Admin",
      email: "verified-admin@test.com",
      role: "admin",
      organizationId: organization.id,
      emailVerifiedAt: new Date("2026-08-01T12:00:00.000Z"),
    });

    /*
     * Set the values explicitly in case the shared
     * helper does not forward emailVerifiedAt.
     */
    await unverifiedUser.update({
      emailVerifiedAt: null,
    });

    await verifiedUser.update({
      emailVerifiedAt: new Date("2026-08-01T12:00:00.000Z"),
    });

    unverifiedToken = await loginAndGetToken("unverified-admin@test.com");

    verifiedToken = await loginAndGetToken("verified-admin@test.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("requires authentication to request a verification email", async () => {
    const response = await request(app).post(VERIFICATION_REQUEST_PATH);

    expect(response.statusCode).toBe(401);

    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();

    expect(await EmailVerificationToken.count()).toBe(0);
  });

  it("creates a verification token and sends the verification email", async () => {
    sendEmailVerificationEmail.mockResolvedValue({
      provider: "mailgun",
      accepted: true,
      skipped: false,
      messageId: "verification-message-id",
    });

    const response = await request(app)
      .post(VERIFICATION_REQUEST_PATH)
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: "success",
      message: "A verification email has been sent. Please check your inbox.",
      data: {
        alreadyVerified: false,
        deliverySkipped: false,
      },
    });

    expect(sendEmailVerificationEmail).toHaveBeenCalledTimes(1);

    expect(sendEmailVerificationEmail).toHaveBeenCalledWith({
      to: "unverified-admin@test.com",
      userName: "Unverified Admin",
      organizationName: organization.name,
      verificationLink: expect.stringContaining("/verify-email/"),
      expiresAt: expect.any(Date),
    });

    const tokens = await EmailVerificationToken.findAll({
      where: {
        userId: unverifiedUser.id,
      },
    });

    expect(tokens).toHaveLength(1);

    expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(tokens[0].consumedAt).toBeNull();

    expect(tokens[0].invalidatedAt).toBeNull();

    const responseText = JSON.stringify(response.body);

    expect(responseText).not.toMatch(
      /rawToken|tokenHash|verificationTokenId|verificationLink|messageId/,
    );
  });

  it("keeps the token active when email delivery is intentionally skipped", async () => {
    const response = await request(app)
      .post(VERIFICATION_REQUEST_PATH)
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: "success",
      message:
        "Email verification was created, but email delivery is disabled in this environment.",
      data: {
        alreadyVerified: false,
        deliverySkipped: true,
      },
    });

    const token = await EmailVerificationToken.findOne({
      where: {
        userId: unverifiedUser.id,
      },
    });

    expect(token).toBeTruthy();
    expect(token.consumedAt).toBeNull();
    expect(token.invalidatedAt).toBeNull();
  });

  it("invalidates the token when email delivery fails", async () => {
    sendEmailVerificationEmail.mockRejectedValue(
      new Error("Mail provider unavailable."),
    );

    const response = await request(app)
      .post(VERIFICATION_REQUEST_PATH)
      .set("Authorization", `Bearer ${unverifiedToken}`);

    expect(response.statusCode).toBe(503);

    expect(response.body).toEqual({
      status: "error",
      message:
        "The verification email could not be sent. Please try again later.",
    });

    const token = await EmailVerificationToken.findOne({
      where: {
        userId: unverifiedUser.id,
      },
    });

    expect(token).toBeTruthy();
    expect(token.consumedAt).toBeNull();

    expect(token.invalidatedAt).toBeInstanceOf(Date);
  });

  it("does not create another token for an already verified user", async () => {
    const response = await request(app)
      .post(VERIFICATION_REQUEST_PATH)
      .set("Authorization", `Bearer ${verifiedToken}`);

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: "success",
      message: "Your email address is already verified.",
      data: {
        alreadyVerified: true,
      },
    });

    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();

    expect(
      await EmailVerificationToken.count({
        where: {
          userId: verifiedUser.id,
        },
      }),
    ).toBe(0);
  });

  it("invalidates an older active token when a new request is made", async () => {
    await request(app)
      .post(VERIFICATION_REQUEST_PATH)
      .set("Authorization", `Bearer ${unverifiedToken}`);

    const firstToken = await EmailVerificationToken.findOne({
      where: {
        userId: unverifiedUser.id,
      },
    });

    expect(firstToken.invalidatedAt).toBeNull();

    await request(app)
      .post(VERIFICATION_REQUEST_PATH)
      .set("Authorization", `Bearer ${unverifiedToken}`);

    const tokens = await EmailVerificationToken.findAll({
      where: {
        userId: unverifiedUser.id,
      },
      order: [["createdAt", "ASC"]],
    });

    expect(tokens).toHaveLength(2);

    expect(tokens[0].invalidatedAt).toBeInstanceOf(Date);

    expect(tokens[1].invalidatedAt).toBeNull();
  });

  it("validates an active verification token without consuming it", async () => {
    await request(app)
      .post(VERIFICATION_REQUEST_PATH)
      .set("Authorization", `Bearer ${unverifiedToken}`);

    const rawToken = extractRawTokenFromEmailCall();

    const response = await request(app).get(getVerificationPath(rawToken));

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: "success",
      message: "The email verification link is valid.",
      data: {
        alreadyVerified: false,
        expiresAt: expect.any(String),
      },
    });

    const storedToken = await EmailVerificationToken.findOne({
      where: {
        userId: unverifiedUser.id,
      },
    });

    expect(storedToken.consumedAt).toBeNull();

    expect(storedToken.invalidatedAt).toBeNull();

    expect(response.body.data).toEqual({
      alreadyVerified: false,
      expiresAt: expect.any(String),
    });

    expect(response.body.data).not.toHaveProperty("email");

    expect(response.body.data).not.toHaveProperty("userId");

    expect(response.body.data).not.toHaveProperty("organizationId");

    expect(response.body.data).not.toHaveProperty("rawToken");

    expect(response.body.data).not.toHaveProperty("tokenHash");

    expect(response.body.data).not.toHaveProperty("verificationTokenId");
  });

  it("rejects an unknown verification token", async () => {
    const response = await request(app).get(
      getVerificationPath("unknown-verification-token"),
    );

    expect(response.statusCode).toBe(400);

    expect(response.body).toEqual({
      status: "error",
      message: "The email verification link is invalid or has expired.",
    });
  });

  it("rejects an expired verification token", async () => {
    const verificationRequest = await createDirectVerificationToken({
      userId: unverifiedUser.id,
    });

    await EmailVerificationToken.update(
      {
        expiresAt: new Date(Date.now() - 60_000),
      },
      {
        where: {
          id: verificationRequest.verificationTokenId,
        },
      },
    );

    const response = await request(app).get(
      getVerificationPath(verificationRequest.rawToken),
    );

    expect(response.statusCode).toBe(400);

    expect(response.body.message).toBe(
      "The email verification link is invalid or has expired.",
    );
  });

  it("rejects a token whose organization does not match the user", async () => {
    const verificationRequest = await createDirectVerificationToken({
      userId: unverifiedUser.id,
    });

    await EmailVerificationToken.update(
      {
        organizationId: secondOrganization.id,
      },
      {
        where: {
          id: verificationRequest.verificationTokenId,
        },
      },
    );

    const response = await request(app).get(
      getVerificationPath(verificationRequest.rawToken),
    );

    expect(response.statusCode).toBe(400);

    expect(response.body.message).toBe(
      "The email verification link is invalid or has expired.",
    );
  });

  it("verifies the user and consumes the token", async () => {
    const verificationRequest = await createDirectVerificationToken({
      userId: unverifiedUser.id,
    });

    const response = await request(app).post(
      getVerificationPath(verificationRequest.rawToken),
    );

    expect(response.statusCode).toBe(200);

    expect(response.body.status).toBe("success");

    expect(response.body.message).toBe(
      "Your email address has been verified successfully.",
    );

    expect(response.body.data).toEqual({
      alreadyVerified: false,
      verifiedAt: expect.any(String),
    });

    await unverifiedUser.reload();

    expect(unverifiedUser.emailVerifiedAt).toBeInstanceOf(Date);

    const storedToken = await EmailVerificationToken.findByPk(
      verificationRequest.verificationTokenId,
    );

    expect(storedToken.consumedAt).toBeInstanceOf(Date);

    expect(storedToken.invalidatedAt).toBeNull();

    expect(storedToken.consumedAt.getTime()).toBe(
      unverifiedUser.emailVerifiedAt.getTime(),
    );
  });

  it("cannot reuse a consumed verification token", async () => {
    const verificationRequest = await createDirectVerificationToken({
      userId: unverifiedUser.id,
    });

    const firstResponse = await request(app).post(
      getVerificationPath(verificationRequest.rawToken),
    );

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await request(app).post(
      getVerificationPath(verificationRequest.rawToken),
    );

    expect(secondResponse.statusCode).toBe(400);

    expect(secondResponse.body).toEqual({
      status: "error",
      message: "The email verification link is invalid or has expired.",
    });
  });

  it("invalidates other active verification tokens after successful verification", async () => {
    const firstRequest = await createDirectVerificationToken({
      userId: unverifiedUser.id,
    });

    /*
     * The normal creation method invalidates the first
     * token, so reactivate it temporarily to model two
     * concurrent links that existed before verification.
     */
    const secondRequest = await createDirectVerificationToken({
      userId: unverifiedUser.id,
    });

    await EmailVerificationToken.update(
      {
        invalidatedAt: null,
      },
      {
        where: {
          id: firstRequest.verificationTokenId,
        },
      },
    );

    const response = await request(app).post(
      getVerificationPath(secondRequest.rawToken),
    );

    expect(response.statusCode).toBe(200);

    const firstStoredToken = await EmailVerificationToken.findByPk(
      firstRequest.verificationTokenId,
    );

    const secondStoredToken = await EmailVerificationToken.findByPk(
      secondRequest.verificationTokenId,
    );

    expect(firstStoredToken.invalidatedAt).toBeInstanceOf(Date);

    expect(firstStoredToken.consumedAt).toBeNull();

    expect(secondStoredToken.consumedAt).toBeInstanceOf(Date);
  });
});
