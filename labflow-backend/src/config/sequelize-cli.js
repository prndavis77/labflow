require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const baseConfig = {
  dialect: "postgres",
  url: process.env.DATABASE_URL,
};

module.exports = {
  development: {
    ...baseConfig,
    logging: false,
  },
  test: {
    ...baseConfig,
    logging: false,
  },
  production: {
    ...baseConfig,
    logging: false,
    dialectOptions: isProduction
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  },
};
