const logger = require("../config/logger");

const sanitizeLogText = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  return (
    value
      /*
       * Common key=value secret formats that can appear in SDK,
       * database, authentication, or configuration errors.
       */
      .replace(
        /\b(password|passwd|pwd|token|accessToken|refreshToken|authorization|cookie|JWT_SECRET|MAILGUN_API_KEY|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)\s*=\s*[^\s]+/gi,
        "$1=[REDACTED]",
      )

      /*
       * Environment-style connection/configuration values.
       */
      .replace(/\b(DATABASE_URL)\s*=\s*[^\s]+/gi, "$1=[REDACTED]")

      /*
       * Authorization values that may appear as
       * "Authorization: Bearer <token>".
       */
      .replace(
        /\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi,
        "Authorization: Bearer [REDACTED]",
      )

      /*
       * Generic bearer tokens that may be embedded in an error message.
       */
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
  );
};

const serializeErrorForLog = (error) => {
  if (!error || typeof error !== "object") {
    return {
      name: "Error",
      message: sanitizeLogText(String(error || "Unknown error")),
    };
  }

  const serializedError = {
    name: typeof error.name === "string" && error.name ? error.name : "Error",
    message:
      typeof error.message === "string"
        ? sanitizeLogText(error.message)
        : "Unknown error",
  };

  if (typeof error.stack === "string" && error.stack) {
    serializedError.stack = sanitizeLogText(error.stack);
  }

  if (typeof error.code === "string" || typeof error.code === "number") {
    serializedError.code = error.code;
  }

  if (Number.isInteger(error.status)) {
    serializedError.status = error.status;
  }

  if (Number.isInteger(error.statusCode)) {
    serializedError.statusCode = error.statusCode;
  }

  return serializedError;
};

const logError = (
  error,
  {
    req = null,
    event = "application_error",
    message = "Application error",
    context = null,
    level = "error",
  } = {},
) => {
  const logData = {
    event,
    err: serializeErrorForLog(error),
  };

  if (req?.requestId) {
    logData.requestId = req.requestId;
  }

  if (req?.user?.id) {
    logData.userId = req.user.id;
  }

  if (req?.user?.organizationId) {
    logData.organizationId = req.user.organizationId;
  }

  if (context && typeof context === "object") {
    logData.context = context;
  }

  const logMethod =
    typeof logger[level] === "function"
      ? logger[level].bind(logger)
      : logger.error.bind(logger);

  logMethod(logData, message);
};

module.exports = {
  logError,
};
