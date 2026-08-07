const pino = require("pino");

const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

const transport = isDevelopment
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    }
  : undefined;

const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? "silent" : "info"),
  transport,

  base: {
    service: "labflow-backend",
    environment: process.env.NODE_ENV || "development",
  },

  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "DATABASE_URL",
      "*.DATABASE_URL",
      "JWT_SECRET",
      "*.JWT_SECRET",
      "MAILGUN_API_KEY",
      "*.MAILGUN_API_KEY",
      "R2_ACCESS_KEY_ID",
      "*.R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "*.R2_SECRET_ACCESS_KEY",
      "signedUrl",
      "*.signedUrl",
      "uploadUrl",
      "*.uploadUrl",
      "downloadUrl",
      "*.downloadUrl",
    ],
    censor: "[REDACTED]",
  },
});

module.exports = logger;
