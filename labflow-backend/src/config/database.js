const { Sequelize } = require("sequelize");
require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});
const logger = require("./logger");
const { getDatabaseSslOptions } = require("./databaseSsl");
const { logError } = require("../utils/errorLogger");

const databaseSslOptions = getDatabaseSslOptions();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
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

module.exports = { sequelize, connectDatabase };
