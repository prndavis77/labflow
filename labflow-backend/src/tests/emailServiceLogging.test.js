const logger = require("../config/logger");
const { logError } = require("../utils/errorLogger");

const {
  sendEmail,
  setEmailProviderForTests,
  resetEmailProviderForTests,
} = require("../services/emailService");

jest.mock("../config/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../utils/errorLogger", () => ({
  logError: jest.fn(),
}));

describe("Email service logging", () => {
  afterEach(() => {
    resetEmailProviderForTests();
    jest.clearAllMocks();
  });

  test("logs successful email delivery without sensitive content", async () => {
    const provider = {
      provider: "mailgun",
      sendMessage: jest.fn().mockResolvedValue({
        provider: "mailgun",
        accepted: true,
        skipped: false,
        messageId: "provider-message-id",
      }),
    };

    setEmailProviderForTests(provider);

    const result = await sendEmail({
      to: "sensitive@example.com",
      subject: "Password reset for sensitive account",
      text: "Use https://example.com/reset/secret-token",
      html: "<a href='https://example.com/reset/secret-token'>Reset</a>",
      tags: ["labflow", "password-reset"],
    });

    expect(result).toEqual({
      provider: "mailgun",
      accepted: true,
      skipped: false,
      messageId: "provider-message-id",
    });

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: "email_delivery_succeeded",
        provider: "mailgun",
        tags: ["labflow", "password-reset"],
      },
      "Email delivered to provider",
    );

    const serializedLogs = JSON.stringify(logger.info.mock.calls);

    expect(serializedLogs).not.toContain("sensitive@example.com");
    expect(serializedLogs).not.toContain(
      "Password reset for sensitive account",
    );
    expect(serializedLogs).not.toContain("secret-token");
    expect(serializedLogs).not.toContain("provider-message-id");
  });

  test("logs skipped email delivery as a warning", async () => {
    const provider = {
      provider: "disabled",
      sendMessage: jest.fn().mockResolvedValue({
        provider: "disabled",
        accepted: false,
        skipped: true,
        messageId: null,
      }),
    };

    setEmailProviderForTests(provider);

    await sendEmail({
      to: "user@example.com",
      subject: "Test subject",
      text: "Test content",
      tags: ["labflow", "test"],
    });

    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: "email_delivery_skipped",
        provider: "disabled",
        tags: ["labflow", "test"],
      },
      "Email delivery skipped",
    );

    expect(logger.info).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  test("logs provider failures and rethrows the original error", async () => {
    const providerError = new Error("Mailgun API failure");

    const provider = {
      provider: "mailgun",
      sendMessage: jest.fn().mockRejectedValue(providerError),
    };

    setEmailProviderForTests(provider);

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Verification email",
        text: "Verification link: https://example.com/verify/secret-token",
        tags: ["labflow", "email-verification"],
      }),
    ).rejects.toBe(providerError);

    expect(logError).toHaveBeenCalledWith(providerError, {
      event: "email_delivery_failed",
      message: "Email delivery failed",
      context: {
        provider: "mailgun",
        tags: ["labflow", "email-verification"],
      },
    });

    const serializedLogCall = JSON.stringify(logError.mock.calls);

    expect(serializedLogCall).not.toContain("user@example.com");
    expect(serializedLogCall).not.toContain("Verification email");
    expect(serializedLogCall).not.toContain("secret-token");
  });
});
