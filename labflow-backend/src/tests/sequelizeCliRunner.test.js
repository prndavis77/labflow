const {
  getNodeEnvironment,
  buildCredentialedDatabaseUrl,
  buildSequelizeCliEnvironment,
} = require("../scripts/runSequelizeCli");

describe("Sequelize CLI runner", () => {
  describe("getNodeEnvironment", () => {
    it("normalizes NODE_ENV", () => {
      expect(
        getNodeEnvironment({
          NODE_ENV: " Production ",
        }),
      ).toBe("production");
    });

    it("defaults to development", () => {
      expect(getNodeEnvironment({})).toBe("development");
    });

    it("rejects unsupported environments", () => {
      expect(() =>
        getNodeEnvironment({
          NODE_ENV: "staging",
        }),
      ).toThrow("NODE_ENV must be development, test, or production.");
    });
  });

  describe("buildCredentialedDatabaseUrl", () => {
    it("injects the database secret into a passwordless PostgreSQL URL", () => {
      const result = buildCredentialedDatabaseUrl(
        "postgresql://postgres@db.example.com:5432/labflow",
        {
          username: "postgres",
          password: "secret-password",
        },
      );

      const parsed = new URL(result);

      expect(parsed.protocol).toBe("postgresql:");
      expect(parsed.username).toBe("postgres");
      expect(parsed.password).toBe("secret-password");
      expect(parsed.hostname).toBe("db.example.com");
      expect(parsed.port).toBe("5432");
      expect(parsed.pathname).toBe("/labflow");
    });

    it("safely encodes special characters in credentials", () => {
      const result = buildCredentialedDatabaseUrl(
        "postgresql://postgres@db.example.com:5432/labflow",
        {
          username: "postgres",
          password: "a!b:c@d/e?#f",
        },
      );

      const parsed = new URL(result);

      expect(parsed.username).toBe("postgres");
      expect(decodeURIComponent(parsed.password)).toBe("a!b:c@d/e?#f");
    });

    it("rejects a production URL that already contains a password", () => {
      expect(() =>
        buildCredentialedDatabaseUrl(
          "postgresql://postgres:old-password@db.example.com:5432/labflow",
          {
            username: "postgres",
            password: "new-password",
          },
        ),
      ).toThrow(
        "Production DATABASE_URL must remain passwordless when running Sequelize CLI.",
      );
    });

    it("rejects non-PostgreSQL URLs", () => {
      expect(() =>
        buildCredentialedDatabaseUrl("mysql://user@db.example.com/database", {
          username: "user",
          password: "password",
        }),
      ).toThrow("DATABASE_URL must use the postgres or postgresql protocol.");
    });
  });

  describe("buildSequelizeCliEnvironment", () => {
    it("does not fetch Secrets Manager credentials outside production", async () => {
      const getSecret = jest.fn();

      const environment = {
        NODE_ENV: "development",
        DATABASE_URL:
          "postgresql://postgres:local-password@localhost:5432/labflow",
      };

      const result = await buildSequelizeCliEnvironment({
        environment,
        getSecret,
      });

      expect(getSecret).not.toHaveBeenCalled();
      expect(result.DATABASE_URL).toBe(environment.DATABASE_URL);
    });

    it("uses AWSCURRENT database credentials for production CLI commands", async () => {
      const getSecret = jest.fn().mockResolvedValue({
        username: "postgres",
        password: "rotated-password",
      });

      const environment = {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres@db.example.com:5432/labflow",
        DB_SECRET_ARN:
          "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test",
      };

      const result = await buildSequelizeCliEnvironment({
        environment,
        getSecret,
      });

      expect(getSecret).toHaveBeenCalledTimes(1);

      const parsed = new URL(result.DATABASE_URL);

      expect(parsed.username).toBe("postgres");
      expect(parsed.password).toBe("rotated-password");

      expect(environment.DATABASE_URL).toBe(
        "postgresql://postgres@db.example.com:5432/labflow",
      );
    });

    it("requires DB_SECRET_ARN in production", async () => {
      await expect(
        buildSequelizeCliEnvironment({
          environment: {
            NODE_ENV: "production",
            DATABASE_URL: "postgresql://postgres@db.example.com:5432/labflow",
          },
          getSecret: jest.fn(),
        }),
      ).rejects.toThrow(
        "DB_SECRET_ARN is required for production Sequelize CLI commands.",
      );
    });

    it("requires DATABASE_URL in production", async () => {
      await expect(
        buildSequelizeCliEnvironment({
          environment: {
            NODE_ENV: "production",
            DB_SECRET_ARN:
              "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test",
          },
          getSecret: jest.fn(),
        }),
      ).rejects.toThrow("DATABASE_URL is required.");
    });
  });
});
