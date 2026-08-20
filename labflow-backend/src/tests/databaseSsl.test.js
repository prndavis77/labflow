const { getDatabaseSslOptions } = require("../config/databaseSsl");

describe("database SSL configuration", () => {
  test("does not enable SSL for a local development database", () => {
    expect(
      getDatabaseSslOptions({
        nodeEnv: "development",
        databaseUrl: "postgres://postgres:password@localhost:5432/labflow",
      }),
    ).toBeNull();
  });

  test("enables certificate verification for production by default", () => {
    expect(
      getDatabaseSslOptions({
        nodeEnv: "production",
        databaseUrl: "postgres://user:password@db.example.com:5432/labflow",
      }),
    ).toEqual({
      rejectUnauthorized: true,
    });
  });

  test("enables SSL for a hosted development database", () => {
    expect(
      getDatabaseSslOptions({
        nodeEnv: "development",
        databaseUrl: "postgres://user:password@db.example.com:5432/labflow",
      }),
    ).toEqual({
      rejectUnauthorized: true,
    });
  });

  test("supports an explicitly configured database CA", () => {
    expect(
      getDatabaseSslOptions({
        nodeEnv: "production",
        databaseUrl: "postgres://user:password@db.example.com:5432/labflow",
        caValue:
          "-----BEGIN CERTIFICATE-----\\nTEST\\n-----END CERTIFICATE-----",
      }),
    ).toEqual({
      rejectUnauthorized: true,
      ca:
        "-----BEGIN CERTIFICATE-----\n" +
        "TEST\n" +
        "-----END CERTIFICATE-----",
    });
  });

  test("allows certificate verification to be disabled only explicitly", () => {
    expect(
      getDatabaseSslOptions({
        nodeEnv: "production",
        databaseUrl: "postgres://user:password@db.example.com:5432/labflow",
        rejectUnauthorizedValue: "false",
      }),
    ).toEqual({
      rejectUnauthorized: false,
    });
  });

  test("rejects an invalid certificate verification setting", () => {
    expect(() =>
      getDatabaseSslOptions({
        nodeEnv: "production",
        databaseUrl: "postgres://user:password@db.example.com:5432/labflow",
        rejectUnauthorizedValue: "maybe",
      }),
    ).toThrow("DATABASE_SSL_REJECT_UNAUTHORIZED must be either true or false.");
  });

  test("allows sslmode in a non-production hosted database URL", () => {
    expect(
      getDatabaseSslOptions({
        nodeEnv: "test",
        databaseUrl:
          "postgres://user:password@db.example.com:5432/labflow?sslmode=require",
      }),
    ).toEqual({
      rejectUnauthorized: true,
    });
  });

  test("rejects sslmode in DATABASE_URL", () => {
    expect(() =>
      getDatabaseSslOptions({
        nodeEnv: "production",
        databaseUrl:
          "postgres://user:password@db.example.com:5432/labflow?sslmode=require",
      }),
    ).toThrow("DATABASE_URL must not contain sslmode");
  });

  test("rejects sslrootcert in DATABASE_URL", () => {
    expect(() =>
      getDatabaseSslOptions({
        nodeEnv: "production",
        databaseUrl:
          "postgres://user:password@db.example.com:5432/labflow?sslrootcert=root.crt",
      }),
    ).toThrow("DATABASE_URL must not contain sslrootcert");
  });

  test("rejects malformed DATABASE_URL values", () => {
    expect(() =>
      getDatabaseSslOptions({
        nodeEnv: "production",
        databaseUrl: "not a database URL",
      }),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL URL.");
  });
});
