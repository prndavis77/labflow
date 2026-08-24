require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});

const { getDatabaseSslOptions } = require("./databaseSsl");

const SUPPORTED_DATABASE_ENVIRONMENTS = new Set([
  "development",
  "test",
  "production",
]);

const getDatabaseUrl = (nodeEnv) => {
  if (nodeEnv === "test") {
    const testDatabaseUrl = String(process.env.TEST_DATABASE_URL || "").trim();

    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required when NODE_ENV is test.");
    }

    return testDatabaseUrl;
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
};

const buildDatabaseConfig = (nodeEnv) => {
  const databaseUrl = getDatabaseUrl(nodeEnv);

  const sslOptions = getDatabaseSslOptions({
    nodeEnv,
    databaseUrl,
  });

  return {
    url: databaseUrl,
    dialect: "postgres",

    ...(sslOptions
      ? {
          dialectOptions: {
            ssl: sslOptions,
          },
        }
      : {}),
  };
};

const nodeEnv = String(process.env.NODE_ENV || "development")
  .trim()
  .toLowerCase();

if (!SUPPORTED_DATABASE_ENVIRONMENTS.has(nodeEnv)) {
  throw new Error("NODE_ENV must be development, test, or production.");
}

/*
 * Build only the configuration Sequelize CLI is actually using.
 *
 * Building every environment eagerly would cause an unrelated production
 * DATABASE_URL to be validated while running local test migrations.
 */
module.exports = {
  [nodeEnv]: buildDatabaseConfig(nodeEnv),
};
