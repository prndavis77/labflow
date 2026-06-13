const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDatabase, sequelize } = require("./config/database");

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

const app = express();

// Enable cross-origin requests from the frontend
const allowedOrigins = [
  "http://localhost:5173", // Vite dev
  "http://localhost:4173", // Vite preview
  "http://127.0.0.1:5173", // Vite dev alternative
  "http://127.0.0.1:4173", // Vite preview alternative
  process.env.FRONTEND_URL,
].filter(Boolean);

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
app.use(express.json());

// Health check route for quickly confirming that the API is running
app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "Labflow API is running",
  });
});

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

// Handles unknown API routes with a clear JSON response
app.use((req, res) => {
  return res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect to PostgreSQL before starting the API server
  try {
    await connectDatabase();

    // Sync Sequelize models to the database during development
    // Later, replace this with migrations for safer production database changes
    if (process.env.NODE_ENV !== "production") {
      await sequelize.sync({ alter: true });
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
