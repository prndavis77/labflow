const { Invitation } = require("../models");

const {
  buildInvitationEmailTracking,
  persistInvitationEmailTracking,
} = require("../controllers/invitationController");

describe("Invitation email delivery tracking", () => {
  const attemptedAt = new Date("2026-08-01T18:00:00.000Z");

  it("maps accepted delivery to sent", () => {
    const result = buildInvitationEmailTracking({
      emailDelivery: {
        provider: "mailgun",
        accepted: true,
        skipped: false,
        messageId: "<mailgun-message-id>",
      },
      attemptedAt,
    });

    expect(result).toEqual({
      emailDeliveryStatus: "sent",
      emailProvider: "mailgun",
      emailProviderMessageId: "<mailgun-message-id>",
      emailLastAttemptedAt: attemptedAt,
      emailSentAt: attemptedAt,
    });
  });

  it("maps disabled delivery to skipped", () => {
    const result = buildInvitationEmailTracking({
      emailDelivery: {
        provider: "disabled",
        accepted: false,
        skipped: true,
        messageId: null,
      },
      attemptedAt,
    });

    expect(result).toEqual({
      emailDeliveryStatus: "skipped",
      emailProvider: "disabled",
      emailProviderMessageId: null,
      emailLastAttemptedAt: attemptedAt,
      emailSentAt: null,
    });
  });

  it("maps provider rejection to failed", () => {
    const result = buildInvitationEmailTracking({
      emailDelivery: {
        provider: "mailgun",
        accepted: false,
        skipped: false,
        messageId: null,
      },
      attemptedAt,
    });

    expect(result.emailDeliveryStatus).toBe("failed");

    expect(result.emailSentAt).toBeNull();
    expect(result.emailProviderMessageId).toBeNull();
  });

  it("does not retain a message ID for unsuccessful delivery", () => {
    const result = buildInvitationEmailTracking({
      emailDelivery: {
        provider: "mailgun",
        accepted: false,
        skipped: false,
        messageId: "unexpected-message-id",
      },
      attemptedAt,
    });

    expect(result.emailProviderMessageId).toBeNull();
  });

  it("persists delivery tracking", async () => {
    const invitation = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    const result = await persistInvitationEmailTracking({
      invitation,

      emailDelivery: {
        provider: "mailgun",
        accepted: true,
        skipped: false,
        messageId: "message-id",
      },

      attemptedAt,
    });

    expect(invitation.update).toHaveBeenCalledWith({
      emailDeliveryStatus: "sent",
      emailProvider: "mailgun",
      emailProviderMessageId: "message-id",
      emailLastAttemptedAt: attemptedAt,
      emailSentAt: attemptedAt,
    });

    expect(result.persisted).toBe(true);
  });

  it("does not throw when tracking persistence fails", async () => {
    const invitation = {
      update: jest
        .fn()
        .mockRejectedValue(new Error("Simulated tracking failure")),
    };

    await expect(
      persistInvitationEmailTracking({
        invitation,

        emailDelivery: {
          provider: "mailgun",
          accepted: true,
          skipped: false,
          messageId: "message-id",
        },

        attemptedAt,
      }),
    ).resolves.toMatchObject({
      persisted: false,
    });
  });

  it("rejects an unsupported delivery status", async () => {
    const invitation = Invitation.build({
      email: "validation@example.com",

      name: "Validation User",

      role: "researcher",

      tokenHash: "test-token-hash",

      status: "pending",

      expiresAt: new Date("2026-08-08T12:00:00.000Z"),

      emailDeliveryStatus: "unknown_status",
    });

    await expect(invitation.validate()).rejects.toThrow();
  });
});
