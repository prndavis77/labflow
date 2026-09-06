const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const getRequiredEnvironmentValue = (variableName) => {
  const value = String(process.env[variableName] || "").trim();

  if (!value) {
    throw new Error(`${variableName} is required.`);
  }

  return value;
};

const isDatabaseSecretEnabled = () =>
  Boolean(String(process.env.DB_SECRET_ARN || "").trim());

const createDatabaseSecretClient = () => {
  const region = getRequiredEnvironmentValue("DB_SECRET_REGION");

  const accessKeyId = getRequiredEnvironmentValue("DB_SECRET_ACCESS_KEY_ID");

  const secretAccessKey = getRequiredEnvironmentValue(
    "DB_SECRET_SECRET_ACCESS_KEY",
  );

  return new SecretsManagerClient({
    region,

    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

const parseDatabaseSecret = (secretString) => {
  let secret;

  try {
    secret = JSON.parse(secretString);
  } catch {
    throw new Error("Database secret is not valid JSON.");
  }

  const username = String(secret.username || "").trim();
  const password = String(secret.password || "");

  if (!username) {
    throw new Error("Database secret username is missing.");
  }

  if (!password) {
    throw new Error("Database secret password is missing.");
  }

  return {
    username,
    password,
  };
};

const getDatabaseSecret = async () => {
  const secretId = getRequiredEnvironmentValue("DB_SECRET_ARN");

  const client = createDatabaseSecretClient();

  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
      VersionStage: "AWSCURRENT",
    }),
  );

  if (!response.SecretString) {
    throw new Error("Database secret does not contain a SecretString.");
  }

  return parseDatabaseSecret(response.SecretString);
};

module.exports = {
  isDatabaseSecretEnabled,
  getDatabaseSecret,
  parseDatabaseSecret,
};
