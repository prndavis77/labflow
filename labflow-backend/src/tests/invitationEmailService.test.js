jest.mock("../services/emailService", () => ({
  sendEmail: jest.fn(),
}));

const { sendEmail } = require("../services/emailService");

const { sendInvitationEmail } = require("../services/invitationEmailService");

describe("Invitation email service", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    sendEmail.mockResolvedValue({
      provider: "test",
      accepted: true,
      skipped: false,
      messageId: "test-invitation-message",
    });
  });

  it("builds and sends an invitation email", async () => {
    const result = await sendInvitationEmail({
      to: "maria@example.com",

      inviteeName: "Maria Schmidt",

      organizationName: "Analytical Chemistry Lab",

      inviterName: "Admin User",

      role: "researcher",

      inviteLink: "https://labflow.example.com/accept-invite/test-token",

      expiresAt: "2026-08-08T12:00:00.000Z",

      locale: "en-US",
      timeZone: "UTC",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "maria@example.com",

        subject:
          "You have been invited to join " +
          "Analytical Chemistry Lab " +
          "on LabFlow",

        text: expect.stringContaining("Hello Maria Schmidt,"),

        html: expect.stringContaining("Accept invitation"),

        tags: ["labflow", "invitation"],
      }),
    );

    expect(result).toEqual({
      provider: "test",
      accepted: true,
      skipped: false,
      messageId: "test-invitation-message",
    });
  });

  it("propagates email delivery errors", async () => {
    sendEmail.mockRejectedValue(new Error("Email provider unavailable."));

    await expect(
      sendInvitationEmail({
        to: "maria@example.com",

        inviteeName: "Maria Schmidt",

        organizationName: "Analytical Chemistry Lab",

        inviterName: "Admin User",

        role: "researcher",

        inviteLink: "https://labflow.example.com/accept-invite/test-token",

        expiresAt: "2026-08-08T12:00:00.000Z",
      }),
    ).rejects.toThrow("Email provider unavailable.");
  });
});
