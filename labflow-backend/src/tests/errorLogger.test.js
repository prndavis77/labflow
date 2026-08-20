jest.mock("../config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const logger = require("../config/logger");
const { logError } = require("../utils/errorLogger");

describe("errorLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("logs only request identity metadata and supplied safe context", () => {
    const error = new Error("Database operation failed");

    const req = {
      requestId: "request-123",
      user: {
        id: 42,
        organizationId: 7,
      },
      body: {
        password: "should-never-be-logged",
      },
      headers: {
        authorization: "Bearer should-never-be-logged",
      },
      originalUrl: "/api/example?token=should-never-be-logged",
    };

    logError(error, {
      req,
      event: "database_operation_failed",
      message: "Database operation failed",
      context: {
        entityId: 123,
      },
    });

    expect(logger.error).toHaveBeenCalledTimes(1);

    const [logData, logMessage] = logger.error.mock.calls[0];

    expect(logMessage).toBe("Database operation failed");

    expect(logData).toEqual({
      event: "database_operation_failed",
      err: {
        name: "Error",
        message: "Database operation failed",
        stack: expect.any(String),
      },
      requestId: "request-123",
      userId: 42,
      organizationId: 7,
      context: {
        entityId: 123,
      },
    });

    expect(logData).not.toHaveProperty("req");
    expect(logData).not.toHaveProperty("body");
    expect(logData).not.toHaveProperty("headers");
    expect(logData).not.toHaveProperty("originalUrl");
  });

  test("does not pass nested error-owned request or configuration data to the logger", () => {
    const error = new Error("Storage request failed");

    error.request = {
      headers: {
        authorization: "Bearer nested-secret-token",
      },
    };

    error.config = {
      password: "nested-database-password",
      signedUrl:
        "https://storage.example.test/private?signature=nested-secret-signature",
    };

    logError(error, {
      event: "storage_request_failed",
      message: "Storage request failed",
    });

    const [logData] = logger.error.mock.calls[0];

    const serializedLogData = JSON.stringify(logData);

    expect(serializedLogData).not.toContain("nested-secret-token");
    expect(serializedLogData).not.toContain("nested-database-password");
    expect(serializedLogData).not.toContain("nested-secret-signature");
  });

  test("keeps useful scalar error metadata without logging arbitrary attached objects", () => {
    const error = new Error("Database query failed");

    error.code = "DB_QUERY_FAILED";
    error.statusCode = 503;

    error.connection = {
      password: "database-password-that-must-not-leak",
      connectionString:
        "postgres://secret-user:secret-password@private-host/database",
    };

    logError(error, {
      event: "database_query_failed",
      message: "Database query failed",
    });

    const [logData] = logger.error.mock.calls[0];

    expect(logData.err).toEqual({
      name: "Error",
      message: "Database query failed",
      stack: expect.any(String),
      code: "DB_QUERY_FAILED",
      statusCode: 503,
    });

    const serializedLogData = JSON.stringify(logData);

    expect(serializedLogData).not.toContain(
      "database-password-that-must-not-leak",
    );

    expect(serializedLogData).not.toContain("secret-password");

    expect(serializedLogData).not.toContain("private-host");
  });

  test("does not expose credential-like values embedded in error messages or stacks", () => {
    const error = new Error(
      "Request failed with password=super-secret-password " +
        "DATABASE_URL=postgres://secret-user:secret-password@private-host/database " +
        "Authorization: Bearer highly-sensitive-access-token",
    );

    logError(error, {
      event: "sensitive_error_message",
      message: "Sensitive error message test",
    });

    const [logData] = logger.error.mock.calls[0];

    const serializedLogData = JSON.stringify(logData);

    expect(serializedLogData).not.toContain("super-secret-password");

    expect(serializedLogData).not.toContain("secret-password");

    expect(serializedLogData).not.toContain("private-host");

    expect(serializedLogData).not.toContain("highly-sensitive-access-token");

    expect(logData.err.message).toContain("password=[REDACTED]");

    expect(logData.err.message).toContain("DATABASE_URL=[REDACTED]");

    expect(logData.err.message).toContain("Authorization: Bearer [REDACTED]");

    expect(logData.err.stack).toContain("[REDACTED]");
  });
});
