const {
  shouldIncludeInviteLink,
  getEmailDeliveryMessage,
  getResendEmailDeliveryMessage,
} = require("../controllers/invitationController");

describe("Invitation controller email helpers", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("includes invitation links outside production", () => {
    process.env.NODE_ENV = "development";

    expect(shouldIncludeInviteLink()).toBe(true);

    process.env.NODE_ENV = "test";

    expect(shouldIncludeInviteLink()).toBe(true);
  });

  it("hides invitation links in production", () => {
    process.env.NODE_ENV = "production";

    expect(shouldIncludeInviteLink()).toBe(false);
  });

  it("formats a successful delivery message", () => {
    expect(
      getEmailDeliveryMessage({
        accepted: true,
        skipped: false,
      }),
    ).toBe("Invitation created and email sent.");
  });

  it("formats a disabled-delivery message", () => {
    expect(
      getEmailDeliveryMessage({
        accepted: false,
        skipped: true,
      }),
    ).toBe("Invitation created. Email delivery is disabled.");
  });

  it("formats a failed-delivery message", () => {
    expect(
      getEmailDeliveryMessage({
        accepted: false,
        skipped: false,
      }),
    ).toBe("Invitation created, but the email could not be sent.");
  });

  it("formats a successful resend message", () => {
    expect(
      getResendEmailDeliveryMessage({
        accepted: true,
        skipped: false,
      }),
    ).toBe("Invitation resent and email sent.");
  });

  it("formats a disabled resend message", () => {
    expect(
      getResendEmailDeliveryMessage({
        accepted: false,
        skipped: true,
      }),
    ).toBe("Invitation renewed. Email delivery is disabled.");
  });

  it("formats a failed resend message", () => {
    expect(
      getResendEmailDeliveryMessage({
        accepted: false,
        skipped: false,
      }),
    ).toBe("Invitation renewed, but the email could not be sent.");
  });
});
