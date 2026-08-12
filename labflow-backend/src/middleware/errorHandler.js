const { logError } = require("../utils/errorLogger");

const errorHandler = (error, req, res, next) => {
  logError(error, {
    req,
    event: "unhandled_request_error",
    message: "Unhandled request error",
  });

  if (res.headersSent) {
    return next(error);
  }

  if (
    error?.type === "entity.too.large" ||
    error?.status === 413 ||
    error?.statusCode === 413
  ) {
    return res.status(413).json({
      status: "error",
      message: "Request body is too large.",
      requestId: req.requestId,
    });
  }

  return res.status(500).json({
    status: "error",
    message: "An unexpected error occurred.",
    requestId: req.requestId,
  });
};

module.exports = errorHandler;
