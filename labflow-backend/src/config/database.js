const { Sequelize } = require("sequelize");

require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});

const logger = require("./logger");
const { getDatabaseSslOptions } = require("./databaseSsl");
const { logError } = require("../utils/errorLogger");

const getRuntimeDatabaseUrl = () => {
  if (process.env.NODE_ENV === "test") {
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

const databaseUrl = getRuntimeDatabaseUrl();

const databaseSslOptions = getDatabaseSslOptions({
  nodeEnv: process.env.NODE_ENV,
  databaseUrl,
});

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",

  logging:
    process.env.NODE_ENV === "development"
      ? (message) => {
          logger.debug(
            {
              source: "sequelize",
            },
            message,
          );
        }
      : false,

  dialectOptions: databaseSslOptions
    ? {
        ssl: databaseSslOptions,
      }
    : {},
});

async function connectDatabase() {
  try {
    await sequelize.authenticate();

    logger.info("Database connection established successfully");
  } catch (error) {
    logError(error, {
      event: "database_connection_failed",
      message: "Unable to connect to the database",
    });

    throw error;
  }
}

module.exports = {
  sequelize,
  connectDatabase,
};
