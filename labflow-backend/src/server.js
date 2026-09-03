const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const { connectDatabase, sequelize } = require("./config/database");
const logger = require("./config/logger");
const { logError } = require("./utils/errorLogger");
const requestContext = require("./middleware/requestContext");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const {
  validateProductionConfig,
} = require("./config/validateProductionConfig");
const { parseTrustProxy } = require("./config/proxyConfig");

// Import routes
const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const userRoutes = require("./routes/userRoutes");
const experimentRoutes = require("./routes/experimentRoutes");
const protocolRoutes = require("./routes/protocolRoutes");
const equipmentRoutes = require("./routes/equipmentRoutes");
const equipmentBookingRoutes = require("./routes/equipmentBookingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const notebookEntryRoutes = require("./routes/notebookEntryRoutes");
const reviewEventRoutes = require("./routes/reviewEventRoutes");
const projectMemberRoutes = require("./routes/projectMemberRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const attachmentRoutes = require("./routes/attachmentRoutes");
const archivedItemRoutes = require("./routes/archivedItemRoutes");

validateProductionConfig();

const app = express();

app.set("trust proxy", parseTrustProxy());

app.use(requestContext);
app.use(requestLogger);

// Enable cross-origin requests from the frontend
const developmentOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

const isProductionCors = process.env.NODE_ENV === "production";

const productionOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADDITIONAL_FRONTEND_URL,
].filter(Boolean);

const allowedOrigins = isProductionCors
  ? productionOrigins
  : [...developmentOrigins, ...productionOrigins];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Parse incoming JSON request bodies
const JSON_BODY_LIMIT = "1mb";

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
  }),
);

app.use(helmet());

// Liveness check.
// Confirms that the Node/Express process is running.
// This intentionally does not depend on PostgreSQL.
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "success",
    message: "Labfluss API is running",
  });
});

// Readiness check.
// Confirms that the API can currently communicate with PostgreSQL.
app.get("/api/ready", async (req, res) => {
  try {
    await sequelize.authenticate();

    return res.status(200).json({
      status: "success",
      message: "Labfluss API is ready",
      checks: {
        database: "ready",
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "database_readiness_failed",
      message: "Database readiness check failed",
    });

    return res.status(503).json({
      status: "error",
      message: "Labfluss API is not ready",
      checks: {
        database: "unavailable",
      },
      requestId: req.requestId,
    });
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

// Authentication routes
app.use("/api/auth", authRoutes);

// User summary routes
app.use("/api/users", userRoutes);

// Project CRUD routes
app.use("/api/projects", projectRoutes);

// Projectmember routes
app.use("/api/project-members", projectMemberRoutes);

// Task CRUD routes
app.use("/api/tasks", taskRoutes);

// Experiment CRUD routes
app.use("/api/experiments", experimentRoutes);

// Protocol CRUD routes
app.use("/api/protocols", protocolRoutes);

// Equipment inventory routes
app.use("/api/equipment", equipmentRoutes);

// Equipment booking routes
app.use("/api/equipment-bookings", equipmentBookingRoutes);

// Dashboard summary routes
app.use("/api/dashboard", dashboardRoutes);

// Experiment-linked notebook entry routes
app.use("/api/notebook-entries", notebookEntryRoutes);

// Review history routes
app.use("/api/review-events", reviewEventRoutes);

//Audit log routes
app.use("/api/audit-logs", auditLogRoutes);

// Invitation routes
app.use("/api/invitations", invitationRoutes);

// Organization routes
app.use("/api/organization", organizationRoutes);

// Attachment routes
app.use("/api/attachments", attachmentRoutes);

// Admin archived-item routes
app.use("/api/admin/archived-items", archivedItemRoutes);

// Handles unknown routes without reflecting user-controlled URL data.
app.use((req, res) => {
  return res.status(404).json({
    status: "error",
    message: "Route not found.",
    requestId: req.requestId,
  });
});

// Handles errors that were not handled by a controller or middleware.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

function startServer({ connect = connectDatabase } = {}) {
  const server = app.listen(PORT, () => {
    logger.info(
      {
        port: Number(PORT),
      },
      "Labfluss API server started",
    );
  });

  /*
   * Database availability affects readiness, not process liveness.
   *
   * Start Express first so /api/health remains available during temporary
   * PostgreSQL outages, provider quota exhaustion, restarts, or network
   * failures.
   *
   * connectDatabase() already logs the underlying database error. This catch
   * records the operational consequence without terminating the HTTP process.
   */
  Promise.resolve()
    .then(() => connect())
    .catch(() => {
      logger.warn(
        {
          event: "database_initial_connection_failed",
        },
        "Initial database connection failed. API remains live but not ready.",
      );
    });

  return server;
}

// Only start the server when this file is run directly.
// Do not start the server when imported by tests.
if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
