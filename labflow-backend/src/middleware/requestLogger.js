const logger = require("../config/logger");

const getRequestPath = (req) => {
  const originalUrl = req.originalUrl || req.url || "";

  return originalUrl.split("?")[0];
};

const sanitizeRequestPath = (path) => {
  if (/^\/api\/auth\/password-reset\/[^/]+$/i.test(path)) {
    return "/api/auth/password-reset/:token";
  }

  if (/^\/api\/auth\/email-verification\/[^/]+$/i.test(path)) {
    return "/api/auth/email-verification/:token";
  }

  if (/^\/api\/invitations\/accept\/[^/]+$/i.test(path)) {
    return "/api/invitations/accept/:token";
  }

  return path;
};

const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  // Capture and sanitize before Express routing can mutate req.url/baseUrl state.
  const sanitizedPath = sanitizeRequestPath(getRequestPath(req));

  res.on("finish", () => {
    const finishedAt = process.hrtime.bigint();

    const durationMs = Number(finishedAt - startedAt) / 1_000_000;

    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: sanitizedPath,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    if (req.user) {
      logData.userId = req.user.id;
      logData.organizationId = req.user.organizationId;
    }

    if (res.statusCode >= 500) {
      logger.error(logData, "HTTP request completed");
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn(logData, "HTTP request completed");
      return;
    }

    logger.info(logData, "HTTP request completed");
  });

  next();
};

module.exports = requestLogger;
