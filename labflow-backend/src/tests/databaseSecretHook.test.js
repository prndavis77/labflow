const mockBeforeConnect = jest.fn();
const mockAuthenticate = jest.fn();
const mockGetDatabaseSecret = jest.fn();
const mockIsDatabaseSecretEnabled = jest.fn(() => true);

jest.mock("sequelize", () => ({
  Sequelize: jest.fn(() => ({
    beforeConnect: mockBeforeConnect,
    authenticate: mockAuthenticate,
  })),
}));

jest.mock("../config/databaseSsl", () => ({
  getDatabaseSslOptions: jest.fn(() => null),
}));

jest.mock("../config/databaseSecret", () => ({
  isDatabaseSecretEnabled: mockIsDatabaseSecretEnabled,
  getDatabaseSecret: mockGetDatabaseSecret,
}));

jest.mock("../config/logger", () => ({
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../utils/errorLogger", () => ({
  logError: jest.fn(),
}));

describe("database Secrets Manager connection hook", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DATABASE_URL:
        "postgresql://postgres:placeholder@db.example.com:5432/labflow",
      DB_SECRET_ARN:
        "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test",
    };

    mockIsDatabaseSecretEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("injects the current secret before a database connection opens", async () => {
    mockGetDatabaseSecret.mockResolvedValue({
      username: "postgres",
      password: "rotated-password",
    });

    require("../config/database");

    expect(mockBeforeConnect).toHaveBeenCalledTimes(1);

    const hook = mockBeforeConnect.mock.calls[0][0];

    const config = {
      username: "old-user",
      password: "old-password",
    };

    await hook(config);

    expect(config).toEqual({
      username: "postgres",
      password: "rotated-password",
    });

    expect(mockGetDatabaseSecret).toHaveBeenCalledTimes(1);
  });
});
