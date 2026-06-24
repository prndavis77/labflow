require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});

const sslOptions = {
  require: true,
  rejectUnauthorized: false,
};

const baseConfig = {
  dialect: "postgres",
  url: process.env.DATABASE_URL,
  logging: false,
  dialectOptions: {
    ssl: sslOptions,
  },
};

module.exports = {
  development: {
    ...baseConfig,
  },
  test: {
    ...baseConfig,
  },
  production: {
    ...baseConfig,
  },
};
