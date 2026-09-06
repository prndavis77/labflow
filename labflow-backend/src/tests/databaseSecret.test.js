const mockSend = jest.fn();

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: mockSend,
  })),

  GetSecretValueCommand: jest.fn((input) => ({
    input,
  })),
}));

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const {
  isDatabaseSecretEnabled,
  getDatabaseSecret,
  parseDatabaseSecret,
} = require("../config/databaseSecret");

describe("database secret configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      DB_SECRET_ARN:
        "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test",
      DB_SECRET_REGION: "eu-central-1",
      DB_SECRET_ACCESS_KEY_ID: "test-access-key",
      DB_SECRET_SECRET_ACCESS_KEY: "test-secret-key",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("reports database secret mode as enabled when DB_SECRET_ARN is set", () => {
    expect(isDatabaseSecretEnabled()).toBe(true);
  });

  it("reports database secret mode as disabled when DB_SECRET_ARN is absent", () => {
    delete process.env.DB_SECRET_ARN;

    expect(isDatabaseSecretEnabled()).toBe(false);
  });

  it("parses username and password from the RDS secret", () => {
    expect(
      parseDatabaseSecret(
        JSON.stringify({
          username: "postgres",
          password: "secret-password",
          host: "example.rds.amazonaws.com",
          port: 5432,
          dbname: "labflow",
        }),
      ),
    ).toEqual({
      username: "postgres",
      password: "secret-password",
    });
  });

  it("rejects malformed secret JSON", () => {
    expect(() => parseDatabaseSecret("not-json")).toThrow(
      "Database secret is not valid JSON.",
    );
  });

  it("rejects a secret without a username", () => {
    expect(() =>
      parseDatabaseSecret(
        JSON.stringify({
          password: "secret-password",
        }),
      ),
    ).toThrow("Database secret username is missing.");
  });

  it("rejects a secret without a password", () => {
    expect(() =>
      parseDatabaseSecret(
        JSON.stringify({
          username: "postgres",
        }),
      ),
    ).toThrow("Database secret password is missing.");
  });

  it("retrieves AWSCURRENT from Secrets Manager using dedicated credentials", async () => {
    mockSend.mockResolvedValue({
      SecretString: JSON.stringify({
        username: "postgres",
        password: "current-password",
      }),
    });

    const result = await getDatabaseSecret();

    expect(SecretsManagerClient).toHaveBeenCalledWith({
      region: "eu-central-1",
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
      },
    });

    expect(GetSecretValueCommand).toHaveBeenCalledWith({
      SecretId: "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test",
      VersionStage: "AWSCURRENT",
    });

    expect(result).toEqual({
      username: "postgres",
      password: "current-password",
    });
  });

  it("rejects a response without SecretString", async () => {
    mockSend.mockResolvedValue({});

    await expect(getDatabaseSecret()).rejects.toThrow(
      "Database secret does not contain a SecretString.",
    );
  });

  it("propagates Secrets Manager failures", async () => {
    const error = new Error("Access denied");

    mockSend.mockRejectedValue(error);

    await expect(getDatabaseSecret()).rejects.toBe(error);
  });
});
