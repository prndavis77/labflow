const { Sequelize } = require("sequelize");
require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});

const isProduction = process.env.NODE_ENV === "production";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
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
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDatabase };
