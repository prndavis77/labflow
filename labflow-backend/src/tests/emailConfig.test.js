const ORIGINAL_ENV = process.env;

const loadEmailConfig = (environmentOverrides = {}) => {
  jest.resetModules();

  process.env = {
    ...ORIGINAL_ENV,

    EMAIL_PROVIDER: "disabled",
    EMAIL_FROM_NAME: "LabFlow",
    EMAIL_FROM_ADDRESS: "no-reply@example.com",

    MAILGUN_API_KEY: "",
    MAILGUN_DOMAIN: "",
    MAILGUN_API_BASE_URL: "https://api.mailgun.net",

    ...environmentOverrides,
  };

  return require("../config/emailConfig");
};

describe("Email configuration", () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  it("uses the disabled provider by default", () => {
    const { emailConfig } = loadEmailConfig({
      EMAIL_PROVIDER: "",
    });

    expect(emailConfig).toMatchObject({
      provider: "disabled",
      fromName: "LabFlow",
      fromAddress: "no-reply@example.com",
    });
  });

  it("normalizes the provider value", () => {
    const { emailConfig } = loadEmailConfig({
      EMAIL_PROVIDER: "  DISABLED  ",
    });

    expect(emailConfig.provider).toBe("disabled");
  });

  it("rejects an unsupported provider", () => {
    expect(() =>
      loadEmailConfig({
        EMAIL_PROVIDER: "smtp",
      }),
    ).toThrow("Unsupported email provider: smtp");
  });

  it("requires a Mailgun API key", () => {
    expect(() =>
      loadEmailConfig({
        EMAIL_PROVIDER: "mailgun",
        MAILGUN_API_KEY: "",
        MAILGUN_DOMAIN: "mg.example.com",
      }),
    ).toThrow("MAILGUN_API_KEY is required");
  });

  it("requires a Mailgun domain", () => {
    expect(() =>
      loadEmailConfig({
        EMAIL_PROVIDER: "mailgun",
        MAILGUN_API_KEY: "test-mailgun-key",
        MAILGUN_DOMAIN: "",
      }),
    ).toThrow("MAILGUN_DOMAIN is required");
  });

  it("accepts the Mailgun US endpoint", () => {
    const { emailConfig } = loadEmailConfig({
      EMAIL_PROVIDER: "mailgun",
      MAILGUN_API_KEY: "test-mailgun-key",
      MAILGUN_DOMAIN: "mg.example.com",
      MAILGUN_API_BASE_URL: "https://api.mailgun.net",
    });

    expect(emailConfig.mailgun).toEqual({
      apiKey: "test-mailgun-key",
      domain: "mg.example.com",
      apiBaseUrl: "https://api.mailgun.net",
    });
  });

  it("accepts the Mailgun EU endpoint", () => {
    const { emailConfig } = loadEmailConfig({
      EMAIL_PROVIDER: "mailgun",
      MAILGUN_API_KEY: "test-mailgun-key",
      MAILGUN_DOMAIN: "mg.example.com",
      MAILGUN_API_BASE_URL: "https://api.eu.mailgun.net",
    });

    expect(emailConfig.mailgun.apiBaseUrl).toBe("https://api.eu.mailgun.net");
  });

  it("rejects an unsupported Mailgun endpoint", () => {
    expect(() =>
      loadEmailConfig({
        EMAIL_PROVIDER: "mailgun",
        MAILGUN_API_KEY: "test-mailgun-key",
        MAILGUN_DOMAIN: "mg.example.com",
        MAILGUN_API_BASE_URL: "https://unexpected.example.com",
      }),
    ).toThrow("MAILGUN_API_BASE_URL must be either");
  });

  it("does not include the Mailgun API key in validation errors", () => {
    const secretValue = "super-secret-mailgun-key";

    let thrownError;

    try {
      loadEmailConfig({
        EMAIL_PROVIDER: "mailgun",
        MAILGUN_API_KEY: secretValue,
        MAILGUN_DOMAIN: "mg.example.com",
        MAILGUN_API_BASE_URL: "https://invalid.example.com",
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeDefined();

    expect(thrownError.message).not.toContain(secretValue);
  });
});
