const {
  sendEmail,
  setEmailProviderForTests,
  resetEmailProviderForTests,
} = require("../services/emailService");

describe("Email service", () => {
  let emailProvider;

  beforeEach(() => {
    emailProvider = {
      provider: "test",

      sendMessage: jest.fn().mockResolvedValue({
        provider: "test",
        accepted: true,
        skipped: false,
        messageId: "test-message-id",
      }),
    };

    setEmailProviderForTests(emailProvider);
  });

  afterEach(() => {
    resetEmailProviderForTests();
    jest.clearAllMocks();
  });

  it("sends a provider-neutral message", async () => {
    const result = await sendEmail({
      to: "researcher@example.com",
      subject: "LabFlow invitation",
      text: "Invitation text",
      html: "<p>Invitation HTML</p>",
      tags: ["invitation"],
    });

    expect(emailProvider.sendMessage).toHaveBeenCalledWith({
      to: "researcher@example.com",
      subject: "LabFlow invitation",
      text: "Invitation text",
      html: "<p>Invitation HTML</p>",
      tags: ["invitation"],
    });

    expect(result).toEqual({
      provider: "test",
      accepted: true,
      skipped: false,
      messageId: "test-message-id",
    });
  });

  it("requires a recipient", async () => {
    await expect(
      sendEmail({
        to: "",
        subject: "Invitation",
        text: "Message",
      }),
    ).rejects.toThrow("Email recipient is required.");

    expect(emailProvider.sendMessage).not.toHaveBeenCalled();
  });

  it("requires a subject", async () => {
    await expect(
      sendEmail({
        to: "researcher@example.com",
        subject: "",
        text: "Message",
      }),
    ).rejects.toThrow("Email subject is required.");

    expect(emailProvider.sendMessage).not.toHaveBeenCalled();
  });

  it("requires text or HTML content", async () => {
    await expect(
      sendEmail({
        to: "researcher@example.com",
        subject: "Invitation",
      }),
    ).rejects.toThrow("Email text or HTML content is required.");

    expect(emailProvider.sendMessage).not.toHaveBeenCalled();
  });

  it("supports the disabled provider result", async () => {
    setEmailProviderForTests({
      provider: "disabled",

      sendMessage: jest.fn().mockResolvedValue({
        provider: "disabled",
        accepted: false,
        skipped: true,
        messageId: null,
      }),
    });

    const result = await sendEmail({
      to: "researcher@example.com",
      subject: "Invitation",
      text: "Message",
    });

    expect(result).toEqual({
      provider: "disabled",
      accepted: false,
      skipped: true,
      messageId: null,
    });
  });
});
