require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});

const { getDatabaseSslOptions } = require("./databaseSsl");

const buildDatabaseConfig = (nodeEnv) => {
  const sslOptions = getDatabaseSslOptions({
    nodeEnv,
  });

  return {
    url: process.env.DATABASE_URL,
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

module.exports = {
  development: buildDatabaseConfig("development"),

  test: buildDatabaseConfig("test"),

  production: buildDatabaseConfig("production"),
};
