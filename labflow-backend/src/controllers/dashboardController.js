const { Op } = require("sequelize");
const {
  Project,
  Task,
  Experiment,
  Protocol,
  Equipment,
  EquipmentBooking,
  User,
} = require("../models");

// Formats project data for dashboard responses
const formatProjectSummary = (project) => {
  if (!project) {
    return null;
  }

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    targetEndDate: project.targetEndDate,
    supervisor: project.supervisor
      ? {
          id: project.supervisor.id,
          name: project.supervisor.name,
          email: project.supervisor.email,
          role: project.supervisor.role,
        }
      : null,
  };
};

// Formats task data for dashboard responses
const formatTaskSummary = (task) => {
  if (!task) {
    return null;
  }

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    project: task.project
      ? {
          id: task.project.id,
          title: task.project.title,
        }
      : null,
    assignedTo: task.assignedTo
      ? {
          id: task.assignedTo.id,
          name: task.assignedTo.name,
          role: task.assignedTo.role,
        }
      : null,
  };
};

// Formats experiment data for dashboard responses
const formatExperimentSummary = (experiment) => {
  if (!experiment) {
    return null;
  }

  return {
    id: experiment.id,
    title: experiment.title,
    status: experiment.status,
    reviewStatus: experiment.reviewStatus,
    startedAt: experiment.startedAt,
    project: experiment.project
      ? {
          id: experiment.project.id,
          title: experiment.project.title,
        }
      : null,
    researcher: experiment.researcher
      ? {
          id: experiment.researcher.id,
          name: experiment.researcher.name,
          role: experiment.researcher.role,
        }
      : null,
  };
};

// Formats protocol data for dashboard responses
const formatProtocolSummary = (protocol) => {
  if (!protocol) {
    return null;
  }

  return {
    id: protocol.id,
    title: protocol.title,
    version: protocol.version,
    approvalStatus: protocol.approvalStatus,
    project: protocol.project
      ? {
          id: protocol.project.id,
          title: protocol.project.title,
        }
      : null,
  };
};

// Formats booking data for dashboard responses
const formatBookingSummary = (booking) => {
  if (!booking) {
    return null;
  }

  return {
    id: booking.id,
    title: booking.title,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    equipment: booking.equipment
      ? {
          id: booking.equipment.id,
          name: booking.equipment.name,
          type: booking.equipment.type,
          location: booking.equipment.location,
        }
      : null,
    user: booking.user
      ? {
          id: booking.user.id,
          name: booking.user.name,
          role: booking.user.role,
        }
      : null,
    project: booking.project
      ? {
          id: booking.project.id,
          title: booking.project.title,
        }
      : null,
  };
};

// GET /api/dashboard/summary
// Returns high-level metrics and short lists for the main dashboard
const getDashboardSummary = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    // Run independent dashboard queries in parallel for better response time
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      openTasks,
      overdueTasks,
      tasksDueSoon,
      experimentsNeedingReview,
      pendingProtocols,
      totalEquipment,
      unavailableEquipment,
      equipmentInUseNow,
      upcomingBookings,
      recentProjects,
      recentTasks,
      recentExperiments,
    ] = await Promise.all([
      // Count all projects.
      Project.count(),

      // Count active projects.
      Project.count({
        where: {
          status: "active",
        },
      }),

      // Count completed projects.
      Project.count({
        where: {
          status: "completed",
        },
      }),

      // Count all tasks that are not done.
      Task.count({
        where: {
          status: {
            [Op.ne]: "done",
          },
        },
      }),

      // Count tasks that are overdue and not done.
      Task.count({
        where: {
          dueDate: {
            [Op.lt]: today,
          },
          status: {
            [Op.ne]: "done",
          },
        },
      }),

      // Fetch upcoming unfinished tasks.
      Task.findAll({
        where: {
          dueDate: {
            [Op.gte]: today,
          },
          status: {
            [Op.ne]: "done",
          },
        },
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
          },
          {
            model: User,
            as: "assignedTo",
            attributes: ["id", "name", "role"],
          },
        ],
        order: [
          ["dueDate", "ASC"],
          ["priority", "DESC"],
        ],
        limit: 5,
      }),

      // Fetch experiments that need supervisor attention.
      Experiment.findAll({
        where: {
          [Op.or]: [
            {
              status: "needs_review",
            },
            {
              reviewStatus: "pending",
            },
            {
              reviewStatus: "changes_requested",
            },
          ],
        },
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
          },
          {
            model: User,
            as: "researcher",
            attributes: ["id", "name", "role"],
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 5,
      }),

      // Fetch protocols waiting for review.
      Protocol.findAll({
        where: {
          approvalStatus: "pending_review",
        },
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 5,
      }),

      // Count all equipment.
      Equipment.count(),

      // Count equipment that cannot currently be booked.
      Equipment.count({
        where: {
          status: {
            [Op.ne]: "available",
          },
        },
      }),

      // Count equipment currently in use based on active confirmed bookings.
      // A booking is active now if startTime <= now and endTime > now.
      EquipmentBooking.count({
        distinct: true,
        col: "equipment_id",
        where: {
          status: "confirmed",
          startTime: {
            [Op.lte]: now,
          },
          endTime: {
            [Op.gt]: now,
          },
        },
      }),

      // Fetch upcoming confirmed equipment bookings.
      EquipmentBooking.findAll({
        where: {
          status: "confirmed",
          startTime: {
            [Op.gte]: now,
          },
        },
        include: [
          {
            model: Equipment,
            as: "equipment",
            attributes: ["id", "name", "type", "location"],
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "role"],
          },
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
          },
        ],
        order: [["startTime", "ASC"]],
        limit: 5,
      }),

      // Fetch recently created projects.
      Project.findAll({
        include: [
          {
            model: User,
            as: "supervisor",
            attributes: ["id", "name", "email", "role"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 5,
      }),

      // Fetch recently updated tasks.
      Task.findAll({
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
          },
          {
            model: User,
            as: "assignedTo",
            attributes: ["id", "name", "role"],
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 5,
      }),

      // Fetch recently updated experiments.
      Experiment.findAll({
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
          },
          {
            model: User,
            as: "researcher",
            attributes: ["id", "name", "role"],
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 5,
      }),
    ]);

    return res.json({
      status: "success",
      data: {
        metrics: {
          totalProjects,
          activeProjects,
          completedProjects,
          openTasks,
          overdueTasks,
          experimentsNeedingReview: experimentsNeedingReview.length,
          pendingProtocols: pendingProtocols.length,
          totalEquipment,
          unavailableEquipment,
          equipmentInUseNow,
          upcomingBookings: upcomingBookings.length,
        },
        lists: {
          tasksDueSoon: tasksDueSoon.map(formatTaskSummary),
          experimentsNeedingReview: experimentsNeedingReview.map(
            formatExperimentSummary,
          ),
          pendingProtocols: pendingProtocols.map(formatProtocolSummary),
          upcomingBookings: upcomingBookings.map(formatBookingSummary),
          recentProjects: recentProjects.map(formatProjectSummary),
          recentTasks: recentTasks.map(formatTaskSummary),
          recentExperiments: recentExperiments.map(formatExperimentSummary),
        },
      },
    });
  } catch (error) {
    console.error("Error getting dashboard summary", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while loading the dashboard summary.",
    });
  }
};

module.exports = { getDashboardSummary };
