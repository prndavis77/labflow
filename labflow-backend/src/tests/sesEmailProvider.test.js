const mockSend = jest.fn();

jest.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: jest.fn(() => ({
    send: mockSend,
  })),

  SendEmailCommand: jest.fn((input) => ({
    input,
  })),
}));

const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");

const {
  createSesEmailProvider,
} = require("../email/providers/sesEmailProvider");

describe("SES email provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createProvider = () =>
    createSesEmailProvider({
      region: "eu-central-1",
      accessKeyId: "test-access-key-id",
      secretAccessKey: "test-secret-access-key",
      fromName: "Labfluss",
      fromAddress: "no-reply@labfluss.com",
    });

  it("creates the SES client with explicit credentials", () => {
    createProvider();

    expect(SESv2Client).toHaveBeenCalledWith({
      region: "eu-central-1",
      credentials: {
        accessKeyId: "test-access-key-id",
        secretAccessKey: "test-secret-access-key",
      },
    });
  });

  it("sends a text and HTML email through SES", async () => {
    mockSend.mockResolvedValue({
      MessageId: "ses-message-123",
    });

    const provider = createProvider();

    const result = await provider.sendMessage({
      to: "recipient@example.com",
      subject: "Test subject",
      text: "Plain text body",
      html: "<p>HTML body</p>",
    });

    expect(SendEmailCommand).toHaveBeenCalledTimes(1);

    expect(SendEmailCommand).toHaveBeenCalledWith({
      FromEmailAddress: "Labfluss <no-reply@labfluss.com>",

      Destination: {
        ToAddresses: ["recipient@example.com"],
      },

      Content: {
        Simple: {
          Subject: {
            Data: "Test subject",
            Charset: "UTF-8",
          },

          Body: {
            Text: {
              Data: "Plain text body",
              Charset: "UTF-8",
            },

            Html: {
              Data: "<p>HTML body</p>",
              Charset: "UTF-8",
            },
          },
        },
      },
    });

    expect(mockSend).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      provider: "ses",
      accepted: true,
      skipped: false,
      messageId: "ses-message-123",
    });
  });

  it("supports text-only messages", async () => {
    mockSend.mockResolvedValue({
      MessageId: "text-message-123",
    });

    const provider = createProvider();

    await provider.sendMessage({
      to: "recipient@example.com",
      subject: "Text only",
      text: "Plain text body",
    });

    expect(SendEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Content: {
          Simple: expect.objectContaining({
            Body: {
              Text: {
                Data: "Plain text body",
                Charset: "UTF-8",
              },
            },
          }),
        },
      }),
    );
  });

  it("supports HTML-only messages", async () => {
    mockSend.mockResolvedValue({
      MessageId: "html-message-123",
    });

    const provider = createProvider();

    await provider.sendMessage({
      to: "recipient@example.com",
      subject: "HTML only",
      html: "<p>HTML body</p>",
    });

    expect(SendEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Content: {
          Simple: expect.objectContaining({
            Body: {
              Html: {
                Data: "<p>HTML body</p>",
                Charset: "UTF-8",
              },
            },
          }),
        },
      }),
    );
  });

  it("maps generic email tags to SES email tags", async () => {
    mockSend.mockResolvedValue({
      MessageId: "tagged-message-123",
    });

    const provider = createProvider();

    await provider.sendMessage({
      to: "recipient@example.com",
      subject: "Tagged email",
      text: "Body",
      tags: ["labflow", "invitation"],
    });

    expect(SendEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        EmailTags: [
          {
            Name: "tag1",
            Value: "labflow",
          },
          {
            Name: "tag2",
            Value: "invitation",
          },
        ],
      }),
    );
  });

  it("omits EmailTags when no tags are provided", async () => {
    mockSend.mockResolvedValue({
      MessageId: "untagged-message-123",
    });

    const provider = createProvider();

    await provider.sendMessage({
      to: "recipient@example.com",
      subject: "No tags",
      text: "Body",
    });

    const commandInput = SendEmailCommand.mock.calls[0][0];

    expect(commandInput).not.toHaveProperty("EmailTags");
  });

  it("returns null when SES does not provide a message ID", async () => {
    mockSend.mockResolvedValue({});

    const provider = createProvider();

    const result = await provider.sendMessage({
      to: "recipient@example.com",
      subject: "Test",
      text: "Body",
    });

    expect(result).toEqual({
      provider: "ses",
      accepted: true,
      skipped: false,
      messageId: null,
    });
  });

  it("propagates SES send failures", async () => {
    const error = new Error("SES send failed");

    mockSend.mockRejectedValue(error);

    const provider = createProvider();

    await expect(
      provider.sendMessage({
        to: "recipient@example.com",
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toBe(error);
  });
});
