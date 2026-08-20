const { Sequelize } = require("sequelize");
require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});
const logger = require("./logger");
const { logError } = require("../utils/errorLogger");

const isProduction = process.env.NODE_ENV === "production";

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
  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
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
