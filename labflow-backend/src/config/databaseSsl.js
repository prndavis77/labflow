const SSL_CONNECTION_STRING_PARAMETERS = Object.freeze([
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
]);

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const parseBooleanEnvironmentValue = (value, fallback, variableName) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error(`${variableName} must be either true or false.`);
};

const parseDatabaseUrl = (databaseUrl) => {
  const value = String(databaseUrl || "").trim();

  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
};

const isLocalDatabaseUrl = (databaseUrl) => {
  const parsedUrl = parseDatabaseUrl(databaseUrl);

  if (!parsedUrl) {
    return false;
  }

  return LOCAL_DATABASE_HOSTS.has(parsedUrl.hostname);
};

const assertNoConnectionStringSslOptions = (databaseUrl) => {
  const parsedUrl = parseDatabaseUrl(databaseUrl);

  if (!parsedUrl) {
    return;
  }

  const conflictingParameter = SSL_CONNECTION_STRING_PARAMETERS.find(
    (parameter) => parsedUrl.searchParams.has(parameter),
  );

  if (conflictingParameter) {
    throw new Error(
      `DATABASE_URL must not contain ${conflictingParameter}; ` +
        "configure database TLS with LabFlow environment variables instead.",
    );
  }
};

const normalizeDatabaseCa = (value) => {
  const ca = String(value || "").trim();

  if (!ca) {
    return null;
  }

  return ca.replace(/\\n/g, "\n");
};

const getDatabaseSslOptions = ({
  nodeEnv = process.env.NODE_ENV,
  databaseUrl = process.env.DATABASE_URL,
  rejectUnauthorizedValue = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
  caValue = process.env.DATABASE_SSL_CA,
} = {}) => {
  const isProduction = nodeEnv === "production";

  const useSsl =
    isProduction || (Boolean(databaseUrl) && !isLocalDatabaseUrl(databaseUrl));

  if (!useSsl) {
    return null;
  }

  /*
   * In production, LabFlow owns the PostgreSQL TLS configuration.
   * Connection-string SSL parameters could otherwise override the
   * explicitly configured certificate-verification settings.
   *
   * Development and test environments may use provider-supplied
   * DATABASE_URL values that already contain sslmode.
   */
  if (isProduction) {
    assertNoConnectionStringSslOptions(databaseUrl);
  }

  const rejectUnauthorized = parseBooleanEnvironmentValue(
    rejectUnauthorizedValue,
    true,
    "DATABASE_SSL_REJECT_UNAUTHORIZED",
  );

  const ca = normalizeDatabaseCa(caValue);

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
};

module.exports = {
  getDatabaseSslOptions,
};
