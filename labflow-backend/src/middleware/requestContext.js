const crypto = require("crypto");

const requestContext = (req, res, next) => {
  const requestId = crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader("X-Request-ID", requestId);

  next();
};

module.exports = requestContext;
