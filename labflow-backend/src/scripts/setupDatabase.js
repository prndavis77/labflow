require("dotenv").config();

const logger = require("../config/logger");
const { sequelize } = require("../config/database");
const { logError } = require("../utils/errorLogger");

// Import models so Sequelize knows about all model definitions and associations.
require("../models");

const assertDatabaseSetupAllowed = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to run automatic database schema sync in production. " +
        "Use Sequelize migrations instead.",
    );
  }
};

const setupDatabase = async () => {
  try {
    assertDatabaseSetupAllowed();

    logger.info("Connecting to database for schema setup.");

    await sequelize.authenticate();

    logger.info("Database connection established for schema setup.");
    logger.info("Synchronizing development database schema.");

    await sequelize.sync({
      alter: true,
    });

    logger.info("Database schema setup completed.");

    process.exitCode = 0;
  } catch (error) {
    logError(error, {
      event: "database_setup_failed",
      message: "Failed to set up database schema",
    });

    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  setupDatabase();
}

module.exports = {
  assertDatabaseSetupAllowed,
  setupDatabase,
};
