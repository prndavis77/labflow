require("dotenv").config({
  quiet: process.env.NODE_ENV === "test",
});

const { spawn } = require("child_process");

const { getDatabaseSecret } = require("../config/databaseSecret");

const SUPPORTED_DATABASE_ENVIRONMENTS = new Set([
  "development",
  "test",
  "production",
]);

const getNodeEnvironment = (environment = process.env) => {
  const nodeEnv = String(environment.NODE_ENV || "development")
    .trim()
    .toLowerCase();

  if (!SUPPORTED_DATABASE_ENVIRONMENTS.has(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  return nodeEnv;
};

const buildCredentialedDatabaseUrl = (databaseUrl, { username, password }) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );
  }

  if (parsedUrl.password) {
    throw new Error(
      "Production DATABASE_URL must remain passwordless when running Sequelize CLI.",
    );
  }

  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedUsername) {
    throw new Error("Database secret username is missing.");
  }

  if (!normalizedPassword) {
    throw new Error("Database secret password is missing.");
  }

  parsedUrl.username = normalizedUsername;
  parsedUrl.password = normalizedPassword;

  return parsedUrl.toString();
};

const buildSequelizeCliEnvironment = async ({
  environment = process.env,
  getSecret = getDatabaseSecret,
} = {}) => {
  const nodeEnv = getNodeEnvironment(environment);
  const childEnvironment = { ...environment };

  if (nodeEnv !== "production") {
    return childEnvironment;
  }

  const databaseUrl = String(environment.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const secretArn = String(environment.DB_SECRET_ARN || "").trim();

  if (!secretArn) {
    throw new Error(
      "DB_SECRET_ARN is required for production Sequelize CLI commands.",
    );
  }

  const databaseSecret = await getSecret();

  childEnvironment.DATABASE_URL = buildCredentialedDatabaseUrl(
    databaseUrl,
    databaseSecret,
  );

  return childEnvironment;
};

const runSequelizeCli = async ({
  args = process.argv.slice(2),
  environment = process.env,
  spawnProcess = spawn,
} = {}) => {
  if (!args.length) {
    throw new Error("A Sequelize CLI command is required.");
  }

  const childEnvironment = await buildSequelizeCliEnvironment({
    environment,
  });

  const sequelizeCliPath = require.resolve("sequelize-cli/lib/sequelize");

  const child = spawnProcess(process.execPath, [sequelizeCliPath, ...args], {
    env: childEnvironment,
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.once("error", reject);

    child.once("exit", (code, signal) => {
      if (signal) {
        reject(
          new Error(`Sequelize CLI exited after receiving signal ${signal}.`),
        );
        return;
      }

      resolve(code ?? 1);
    });
  });
};

if (require.main === module) {
  runSequelizeCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(`Sequelize CLI failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  getNodeEnvironment,
  buildCredentialedDatabaseUrl,
  buildSequelizeCliEnvironment,
  runSequelizeCli,
};
