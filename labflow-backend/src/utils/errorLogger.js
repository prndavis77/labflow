const logger = require("../config/logger");

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
    err: error,
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
