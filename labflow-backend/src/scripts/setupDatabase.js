require("dotenv").config();

const { sequelize } = require("../config/database");

// Import models so Sequelize knows about all model definitions and associations.
require("../models");

const setupDatabase = async () => {
  try {
    console.log("Connecting to database...");

    await sequelize.authenticate();

    console.log("Database connection established.");
    console.log("Syncing database schema...");

    await sequelize.sync({ alter: true });

    console.log("Database schema setup completed.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to set up database schema.", error);
    process.exit(1);
  }
};

setupDatabase();
