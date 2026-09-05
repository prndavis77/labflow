jest.mock("../email/providers/disabledEmailProvider", () => ({
  createDisabledEmailProvider: jest.fn(() => ({
    provider: "disabled",
  })),
}));

jest.mock("../email/providers/mailgunEmailProvider", () => ({
  createMailgunEmailProvider: jest.fn(() => ({
    provider: "mailgun",
  })),
}));

jest.mock("../email/providers/sesEmailProvider", () => ({
  createSesEmailProvider: jest.fn(() => ({
    provider: "ses",
  })),
}));

const {
  createDisabledEmailProvider,
} = require("../email/providers/disabledEmailProvider");
const {
  createMailgunEmailProvider,
} = require("../email/providers/mailgunEmailProvider");
const {
  createSesEmailProvider,
} = require("../email/providers/sesEmailProvider");
const { createEmailProvider } = require("../email/createEmailProvider");

describe("createEmailProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates the disabled provider", () => {
    const provider = createEmailProvider({
      provider: "disabled",
    });

    expect(createDisabledEmailProvider).toHaveBeenCalledTimes(1);
    expect(provider.provider).toBe("disabled");
  });

  it("creates the Mailgun provider with the configured values", () => {
    const config = {
      provider: "mailgun",

      fromName: "Labfluss",
      fromAddress: "no-reply@labfluss.com",

      mailgun: {
        apiKey: "test-mailgun-key",
        domain: "mg.labfluss.com",
        apiBaseUrl: "https://api.eu.mailgun.net",
      },
    };

    const provider = createEmailProvider(config);

    expect(createMailgunEmailProvider).toHaveBeenCalledWith({
      apiKey: "test-mailgun-key",
      domain: "mg.labfluss.com",
      apiBaseUrl: "https://api.eu.mailgun.net",
      fromName: "Labfluss",
      fromAddress: "no-reply@labfluss.com",
    });

    expect(provider.provider).toBe("mailgun");
  });

  it("creates the SES provider with the configured values", () => {
    const config = {
      provider: "ses",

      fromName: "Labfluss",
      fromAddress: "no-reply@labfluss.com",

      ses: {
        region: "eu-central-1",
        accessKeyId: "test-access-key-id",
        secretAccessKey: "test-secret-access-key",
      },
    };

    const provider = createEmailProvider(config);

    expect(createSesEmailProvider).toHaveBeenCalledWith({
      region: "eu-central-1",
      accessKeyId: "test-access-key-id",
      secretAccessKey: "test-secret-access-key",
      fromName: "Labfluss",
      fromAddress: "no-reply@labfluss.com",
    });

    expect(provider.provider).toBe("ses");
  });

  it("rejects an unsupported provider", () => {
    expect(() =>
      createEmailProvider({
        provider: "smtp",
      }),
    ).toThrow("Unsupported email provider: smtp");
  });
});
