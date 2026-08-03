const crypto = require("crypto");
const bcrypt = require("bcrypt");
const request = require("supertest");

const originalRandomBytes = crypto.randomBytes;

jest.mock("../services/emailService", () => ({
  sendEmail: jest.fn(),
}));

const app = require("../server");
const { sequelize } = require("../config/database");

const { User, Organization, PasswordResetToken } = require("../models");

const { sendEmail } = require("../services/emailService");

const { hashToken } = require("../services/passwordResetService");

const {
  buildPasswordResetEmail,
} = require("../email/templates/passwordResetEmail");

const {
  createTestUser,
  getOrCreateTestOrganization,
} = require("./helpers/testHelpers");

const GENERIC_MESSAGE =
  "If an account exists for that email address, password reset instructions have been sent.";

const INVALID_LINK_MESSAGE =
  "The password reset link is invalid or has expired.";

const TEST_RAW_TOKEN = "01".repeat(32);
const TEST_TOKEN_BUFFER = Buffer.alloc(32, 1);

const createResetRequest = async ({ email = "reset@test.com" } = {}) => {
  return request(app).post("/api/auth/forgot-password").send({ email });
};

const getStoredResetToken = async () => {
  return PasswordResetToken.findOne({
    order: [["id", "DESC"]],
  });
};

describe("Password reset", () => {
  let randomBytesSpy;

  beforeAll(async () => {
    await sequelize.authenticate();

    randomBytesSpy = jest
      .spyOn(crypto, "randomBytes")
      .mockImplementation((size, callback) => {
        /*
         * bcrypt requests random bytes asynchronously.
         * Preserve the real implementation for callback-based calls.
         */
        if (typeof callback === "function") {
          return originalRandomBytes(size, callback);
        }

        /*
         * passwordResetService requests 32 bytes synchronously.
         * Make only that call deterministic.
         */
        if (size === 32) {
          return Buffer.from(TEST_TOKEN_BUFFER);
        }

        return originalRandomBytes(size);
      });
  });

  beforeEach(async () => {
    await PasswordResetToken.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });

    await User.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });

    await Organization.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });

    sendEmail.mockReset();

    sendEmail.mockResolvedValue({
      accepted: true,
      skipped: false,
      provider: "test",
      messageId: "test-message-id",
    });

    await createTestUser({
      name: "Reset User",
      email: "reset@test.com",
      role: "admin",
    });
  });

  afterAll(async () => {
    randomBytesSpy.mockRestore();
    await sequelize.close();
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns the generic response for an existing account", async () => {
      const response = await createResetRequest();

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        status: "success",
        message: GENERIC_MESSAGE,
      });
    });

    it("returns the same response for an unknown account", async () => {
      const response = await createResetRequest({
        email: "unknown@test.com",
      });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        status: "success",
        message: GENERIC_MESSAGE,
      });

      expect(await PasswordResetToken.count()).toBe(0);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("returns the same response when the email is missing", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({});

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        status: "success",
        message: GENERIC_MESSAGE,
      });

      expect(await PasswordResetToken.count()).toBe(0);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("normalizes the submitted email address", async () => {
      const response = await createResetRequest({
        email: "  RESET@TEST.COM  ",
      });

      expect(response.status).toBe(200);

      expect(await PasswordResetToken.count()).toBe(1);

      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("stores only the SHA-256 token hash", async () => {
      const response = await createResetRequest();

      expect(response.status).toBe(200);

      const storedToken = await getStoredResetToken();

      expect(storedToken).not.toBeNull();

      expect(storedToken.tokenHash).toBe(hashToken(TEST_RAW_TOKEN));

      expect(storedToken.tokenHash).toHaveLength(64);

      expect(storedToken.tokenHash).not.toBe(TEST_RAW_TOKEN);

      expect(JSON.stringify(response.body)).not.toContain(TEST_RAW_TOKEN);
    });

    it("sends the reset link through the email service", async () => {
      await createResetRequest();

      expect(sendEmail).toHaveBeenCalledTimes(1);

      const emailCall = sendEmail.mock.calls[0][0];

      expect(emailCall.to).toBe("reset@test.com");

      expect(emailCall.subject).toBe("Reset your LabFlow password");

      expect(emailCall.text).toContain(`/reset-password/${TEST_RAW_TOKEN}`);

      expect(emailCall.html).toContain(`/reset-password/${TEST_RAW_TOKEN}`);

      expect(emailCall.tags).toEqual(["labflow", "password-reset"]);
    });

    it("does not create a token for an inactive account", async () => {
      await User.update(
        {
          isActive: false,
          deactivatedAt: new Date(),
        },
        {
          where: {
            email: "reset@test.com",
          },
        },
      );

      const response = await createResetRequest();

      expect(response.status).toBe(200);

      expect(response.body.message).toBe(GENERIC_MESSAGE);

      expect(await PasswordResetToken.count()).toBe(0);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("does not create a token for an inactive organization", async () => {
      const user = await User.findOne({
        where: {
          email: "reset@test.com",
        },
      });

      await Organization.update(
        {
          isActive: false,
        },
        {
          where: {
            id: user.organizationId,
          },
        },
      );

      const response = await createResetRequest();

      expect(response.status).toBe(200);

      expect(response.body.message).toBe(GENERIC_MESSAGE);

      expect(await PasswordResetToken.count()).toBe(0);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("invalidates an older unused reset token", async () => {
      await createResetRequest();

      const firstToken = await getStoredResetToken();

      expect(firstToken.invalidatedAt).toBeNull();

      randomBytesSpy.mockReturnValueOnce(Buffer.alloc(32, 2));

      await createResetRequest();

      await firstToken.reload();

      expect(firstToken.invalidatedAt).not.toBeNull();

      const activeTokenCount = await PasswordResetToken.count({
        where: {
          consumedAt: null,
          invalidatedAt: null,
        },
      });

      expect(activeTokenCount).toBe(1);
    });

    it("invalidates the token after a genuine delivery failure", async () => {
      sendEmail.mockRejectedValueOnce(new Error("Mail provider unavailable"));

      const response = await createResetRequest();

      expect(response.status).toBe(200);

      expect(response.body.message).toBe(GENERIC_MESSAGE);

      const storedToken = await getStoredResetToken();

      expect(storedToken).not.toBeNull();
      expect(storedToken.invalidatedAt).not.toBeNull();
    });

    it("keeps the token active when delivery is intentionally skipped", async () => {
      sendEmail.mockResolvedValueOnce({
        accepted: false,
        skipped: true,
        provider: "disabled",
        messageId: null,
      });

      const response = await createResetRequest();

      expect(response.status).toBe(200);

      const storedToken = await getStoredResetToken();

      expect(storedToken).not.toBeNull();
      expect(storedToken.invalidatedAt).toBeNull();
    });
  });

  describe("GET /api/auth/password-reset/:token", () => {
    it("accepts an active reset token", async () => {
      await createResetRequest();

      const response = await request(app).get(
        `/api/auth/password-reset/${TEST_RAW_TOKEN}`,
      );

      expect(response.status).toBe(200);

      expect(response.body.status).toBe("success");

      expect(response.body.message).toBe("The password reset link is valid.");

      expect(response.body.data.expiresAt).toBeDefined();

      expect(response.body.data).not.toHaveProperty("userId");

      expect(response.body.data).not.toHaveProperty("organizationId");

      expect(response.body.data).not.toHaveProperty("email");
    });

    it("rejects an unknown token", async () => {
      const response = await request(app).get(
        "/api/auth/password-reset/not-a-real-token",
      );

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        status: "error",
        message: INVALID_LINK_MESSAGE,
      });
    });

    it("rejects an expired token", async () => {
      await createResetRequest();

      await PasswordResetToken.update(
        {
          expiresAt: new Date(Date.now() - 60_000),
        },
        {
          where: {},
        },
      );

      const response = await request(app).get(
        `/api/auth/password-reset/${TEST_RAW_TOKEN}`,
      );

      expect(response.status).toBe(400);

      expect(response.body.message).toBe(INVALID_LINK_MESSAGE);
    });

    it("rejects an invalidated token", async () => {
      await createResetRequest();

      await PasswordResetToken.update(
        {
          invalidatedAt: new Date(),
        },
        {
          where: {},
        },
      );

      const response = await request(app).get(
        `/api/auth/password-reset/${TEST_RAW_TOKEN}`,
      );

      expect(response.status).toBe(400);

      expect(response.body.message).toBe(INVALID_LINK_MESSAGE);
    });

    it("rejects a consumed token", async () => {
      await createResetRequest();

      await PasswordResetToken.update(
        {
          consumedAt: new Date(),
        },
        {
          where: {},
        },
      );

      const response = await request(app).get(
        `/api/auth/password-reset/${TEST_RAW_TOKEN}`,
      );

      expect(response.status).toBe(400);

      expect(response.body.message).toBe(INVALID_LINK_MESSAGE);
    });

    it("rejects a token whose organization no longer matches the user", async () => {
      await createResetRequest();

      const secondOrganization = await Organization.create({
        name: "Second Test Lab",
        slug: "second-test-lab",
        type: "demo",
        isActive: true,
      });

      await PasswordResetToken.update(
        {
          organizationId: secondOrganization.id,
        },
        {
          where: {},
        },
      );

      const response = await request(app).get(
        `/api/auth/password-reset/${TEST_RAW_TOKEN}`,
      );

      expect(response.status).toBe(400);

      expect(response.body.message).toBe(INVALID_LINK_MESSAGE);
    });
  });

  describe("POST /api/auth/password-reset/:token", () => {
    it("resets the password and consumes the token", async () => {
      await createResetRequest();

      const userBefore = await User.findOne({
        where: {
          email: "reset@test.com",
        },
      });

      const previousPasswordHash = userBefore.passwordHash;

      const response = await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "newPassword123",
          passwordConfirmation: "newPassword123",
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        status: "success",
        message:
          "Your password has been reset successfully. You can now log in with your new password.",
      });

      const userAfter = await User.findByPk(userBefore.id);

      expect(userAfter.passwordHash).not.toBe(previousPasswordHash);

      expect(
        await bcrypt.compare("newPassword123", userAfter.passwordHash),
      ).toBe(true);

      expect(userAfter.tokenVersion).toBe(1);

      const storedToken = await getStoredResetToken();

      expect(storedToken.consumedAt).not.toBeNull();
    });

    it("allows login with the new password", async () => {
      await createResetRequest();

      await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "newPassword123",
          passwordConfirmation: "newPassword123",
        });

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "reset@test.com",
        password: "newPassword123",
      });

      expect(loginResponse.status).toBe(200);

      expect(loginResponse.body.status).toBe("success");
    });

    it("rejects the previous password after reset", async () => {
      await createResetRequest();

      await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "newPassword123",
          passwordConfirmation: "newPassword123",
        });

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "reset@test.com",
        password: "password123",
      });

      expect(loginResponse.status).toBe(401);
    });

    it("prevents reuse of a consumed reset token", async () => {
      await createResetRequest();

      const firstResponse = await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "newPassword123",
          passwordConfirmation: "newPassword123",
        });

      expect(firstResponse.status).toBe(200);

      const secondResponse = await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "anotherPassword123",
          passwordConfirmation: "anotherPassword123",
        });

      expect(secondResponse.status).toBe(400);

      expect(secondResponse.body.message).toBe(INVALID_LINK_MESSAGE);
    });

    it("rejects passwords shorter than eight characters", async () => {
      await createResetRequest();

      const response = await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "short",
          passwordConfirmation: "short",
        });

      expect(response.status).toBe(400);

      expect(response.body.message).toBe(
        "Password must be at least 8 characters long.",
      );

      const storedToken = await getStoredResetToken();

      expect(storedToken.consumedAt).toBeNull();
    });

    it("rejects a mismatched password confirmation", async () => {
      await createResetRequest();

      const response = await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "newPassword123",
          passwordConfirmation: "differentPassword123",
        });

      expect(response.status).toBe(400);

      expect(response.body.message).toBe(
        "Password confirmation does not match.",
      );

      const storedToken = await getStoredResetToken();

      expect(storedToken.consumedAt).toBeNull();
    });

    it("rejects an expired reset token", async () => {
      await createResetRequest();

      await PasswordResetToken.update(
        {
          expiresAt: new Date(Date.now() - 60_000),
        },
        {
          where: {},
        },
      );

      const response = await request(app)
        .post(`/api/auth/password-reset/${TEST_RAW_TOKEN}`)
        .send({
          password: "newPassword123",
          passwordConfirmation: "newPassword123",
        });

      expect(response.status).toBe(400);

      expect(response.body.message).toBe(INVALID_LINK_MESSAGE);
    });
  });

  describe("Password-reset email template", () => {
    const templateData = {
      userName: "Reset User",
      organizationName: "Test Lab",
      resetLink: "https://labflow.example.com/reset-password/test-token",
      expiresAt: "2026-08-03T21:00:00.000Z",
      locale: "en-US",
      timeZone: "UTC",
    };

    it("builds the expected subject and text", () => {
      const result = buildPasswordResetEmail(templateData);

      expect(result.subject).toBe("Reset your LabFlow password");

      expect(result.text).toContain("Hello Reset User,");

      expect(result.text).toContain(templateData.resetLink);

      expect(result.text).toContain("This link expires on");
    });

    it("builds an HTML reset button", () => {
      const result = buildPasswordResetEmail(templateData);

      expect(result.html).toContain("Reset password");

      expect(result.html).toContain(templateData.resetLink);
    });

    it("escapes user-controlled HTML content", () => {
      const result = buildPasswordResetEmail({
        ...templateData,
        userName: '<script>alert("user")</script>',
        organizationName: "<Test & Research>",
      });

      expect(result.html).not.toContain("<script>");

      expect(result.html).toContain("&lt;script&gt;");

      expect(result.html).toContain("&lt;Test &amp; Research&gt;");
    });

    it("rejects an unsafe reset-link protocol", () => {
      expect(() =>
        buildPasswordResetEmail({
          ...templateData,
          resetLink: "javascript:alert(1)",
        }),
      ).toThrow("Password reset link must use HTTP or HTTPS.");
    });

    it("rejects an invalid expiration date", () => {
      expect(() =>
        buildPasswordResetEmail({
          ...templateData,
          expiresAt: "invalid-date",
        }),
      ).toThrow("Password reset expiration date is invalid.");
    });
  });
});
