const VALID_NODE_ENV_VALUES = Object.freeze([
  "development",
  "test",
  "production",
]);

const requireEnvironmentValue = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const validateProductionConfig = () => {
  const nodeEnv = requireEnvironmentValue("NODE_ENV");

  if (!VALID_NODE_ENV_VALUES.includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  if (nodeEnv !== "production") {
    return;
  }

  const databaseUrl = requireEnvironmentValue("DATABASE_URL");

  try {
    const parsedDatabaseUrl = new URL(databaseUrl);

    if (
      parsedDatabaseUrl.protocol !== "postgres:" &&
      parsedDatabaseUrl.protocol !== "postgresql:"
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL URL in production.",
    );
  }

  const jwtSecret = requireEnvironmentValue("JWT_SECRET");

  if (jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters long in production.",
    );
  }

  const frontendUrl = requireEnvironmentValue("FRONTEND_URL");

  let parsedFrontendUrl;

  try {
    parsedFrontendUrl = new URL(frontendUrl);
  } catch {
    throw new Error("FRONTEND_URL must be a valid URL in production.");
  }

  if (parsedFrontendUrl.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTPS in production.");
  }
};

module.exports = {
  VALID_NODE_ENV_VALUES,
  validateProductionConfig,
};
