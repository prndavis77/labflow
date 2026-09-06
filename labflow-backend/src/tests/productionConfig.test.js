const ORIGINAL_ENV = process.env;

describe("production configuration validation", () => {
  beforeEach(() => {
    jest.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const loadValidator = () => {
    return require("../config/validateProductionConfig")
      .validateProductionConfig;
  };

  test("requires NODE_ENV", () => {
    delete process.env.NODE_ENV;

    expect(() => loadValidator()()).toThrow("NODE_ENV is required.");
  });

  test("rejects an unsupported NODE_ENV value", () => {
    process.env.NODE_ENV = "prod";

    expect(() => loadValidator()()).toThrow(
      "NODE_ENV must be development, test, or production.",
    );
  });

  test("rejects a non-PostgreSQL DATABASE_URL in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "https://database.example.com/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    expect(() => loadValidator()()).toThrow(
      "DATABASE_URL must be a valid PostgreSQL URL in production.",
    );
  });

  test("does nothing outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.FRONTEND_URL;

    expect(() => loadValidator()()).not.toThrow();
  });

  test("requires DATABASE_URL in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    expect(() => loadValidator()()).toThrow("DATABASE_URL is required.");
  });

  test("requires JWT_SECRET in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    delete process.env.JWT_SECRET;
    process.env.FRONTEND_URL = "https://labflow.example.com";

    expect(() => loadValidator()()).toThrow("JWT_SECRET is required.");
  });

  test("requires a sufficiently long JWT_SECRET in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "short-secret";
    process.env.FRONTEND_URL = "https://labflow.example.com";

    expect(() => loadValidator()()).toThrow(
      "JWT_SECRET must be at least 32 characters long in production.",
    );
  });

  test("requires FRONTEND_URL in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    delete process.env.FRONTEND_URL;

    expect(() => loadValidator()()).toThrow("FRONTEND_URL is required.");
  });

  test("requires HTTPS FRONTEND_URL in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "http://labflow.example.com";

    expect(() => loadValidator()()).toThrow(
      "FRONTEND_URL must use HTTPS in production.",
    );
  });

  test("accepts valid production configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    expect(() => loadValidator()()).not.toThrow();
  });

  test("accepts production configuration without database secret mode", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    delete process.env.DB_SECRET_ARN;
    delete process.env.DB_SECRET_REGION;
    delete process.env.DB_SECRET_ACCESS_KEY_ID;
    delete process.env.DB_SECRET_SECRET_ACCESS_KEY;

    expect(() => loadValidator()()).not.toThrow();
  });

  test("accepts complete database secret configuration in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    process.env.DB_SECRET_ARN =
      "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test";
    process.env.DB_SECRET_REGION = "eu-central-1";
    process.env.DB_SECRET_ACCESS_KEY_ID = "test-access-key";
    process.env.DB_SECRET_SECRET_ACCESS_KEY = "test-secret-key";

    expect(() => loadValidator()()).not.toThrow();
  });

  test("requires DB_SECRET_REGION when database secret mode is enabled", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    process.env.DB_SECRET_ARN =
      "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test";
    delete process.env.DB_SECRET_REGION;
    process.env.DB_SECRET_ACCESS_KEY_ID = "test-access-key";
    process.env.DB_SECRET_SECRET_ACCESS_KEY = "test-secret-key";

    expect(() => loadValidator()()).toThrow("DB_SECRET_REGION is required.");
  });

  test("requires DB_SECRET_ACCESS_KEY_ID when database secret mode is enabled", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    process.env.DB_SECRET_ARN =
      "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test";
    process.env.DB_SECRET_REGION = "eu-central-1";
    delete process.env.DB_SECRET_ACCESS_KEY_ID;
    process.env.DB_SECRET_SECRET_ACCESS_KEY = "test-secret-key";

    expect(() => loadValidator()()).toThrow(
      "DB_SECRET_ACCESS_KEY_ID is required.",
    );
  });

  test("requires DB_SECRET_SECRET_ACCESS_KEY when database secret mode is enabled", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL =
      "postgres://user:password@example.com:5432/labflow";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.FRONTEND_URL = "https://labflow.example.com";

    process.env.DB_SECRET_ARN =
      "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test";
    process.env.DB_SECRET_REGION = "eu-central-1";
    process.env.DB_SECRET_ACCESS_KEY_ID = "test-access-key";
    delete process.env.DB_SECRET_SECRET_ACCESS_KEY;

    expect(() => loadValidator()()).toThrow(
      "DB_SECRET_SECRET_ACCESS_KEY is required.",
    );
  });
});
