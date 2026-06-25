require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});

const isHostedDatabase =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("localhost") &&
  !process.env.DATABASE_URL.includes("127.0.0.1");

const sslOptions = isHostedDatabase
  ? {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    }
  : {};

module.exports = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    ...sslOptions,
  },
  test: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    ...sslOptions,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
