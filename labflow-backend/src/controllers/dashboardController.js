const { Op } = require("sequelize");
const {
  Project,
  Task,
  Experiment,
  Protocol,
  Equipment,
  EquipmentBooking,
  NotebookEntry,
  User,
} = require("../models");
const { getAccessibleProjectIds } = require("../utils/projectAccess");

const buildDashboardProjectScope = async (user) => {
  if (!user || !user.id) {
    return {
      isProjectScoped: true,
      accessibleProjectIds: [],
      projectWhere: {
        id: {
          [Op.in]: [],
        },
      },
      projectLinkedWhere: {
        projectId: {
          [Op.in]: [],
        },
      },
    };
  }

  if (user.role === "admin") {
    return {
      isProjectScoped: false,
      accessibleProjectIds: null,
      projectWhere: {},
      projectLinkedWhere: {},
    };
  }

  const accessibleProjectIds = await getAccessibleProjectIds(user);

  return {
    isProjectScoped: true,
    accessibleProjectIds,
    projectWhere: {
      id: {
        [Op.in]: accessibleProjectIds,
      },
    },
    projectLinkedWhere: {
      projectId: {
        [Op.in]: accessibleProjectIds,
      },
    },
  };
};

const buildProtocolWhere = (scope) => {
  if (!scope.isProjectScoped) {
    return {};
  }

  return {
    [Op.or]: [
      {
        projectId: {
          [Op.in]: scope.accessibleProjectIds,
        },
      },
      {
        projectId: null,
      },
    ],
  };
};

const buildDashboardTaskWhere = (scope, user) => {
  if (!scope.isProjectScoped) {
    return {};
  }

  return {
    [Op.or]: [
      {
        projectId: {
          [Op.in]: scope.accessibleProjectIds,
        },
      },
      {
        projectId: null,
        assignedToId: user.id,
      },
      {
        projectId: null,
        createdById: user.id,
      },
    ],
  };
};

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

// Formats notebook entry data for dashboard responses.
// Dashboard only needs summary data, not the full editing workflow.
const formatNotebookEntrySummary = (entry) => {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    title: entry.title,
    entryType: entry.entryType,
    content: entry.content,
    contentFormat: entry.contentFormat,
    experiment: entry.experiment
      ? {
          id: entry.experiment.id,
          title: entry.experiment.title,
          status: entry.experiment.status,
        }
      : null,
    project: entry.project
      ? {
          id: entry.project.id,
          title: entry.project.title,
          status: entry.project.status,
        }
      : null,
    author: entry.author
      ? {
          id: entry.author.id,
          name: entry.author.name,
          role: entry.author.role,
        }
      : null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
};

// GET /api/dashboard/summary
// Returns high-level metrics and short lists for the main dashboard
const getDashboardSummary = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const scope = await buildDashboardProjectScope(req.user);
    const protocolWhere = buildProtocolWhere(scope);
    const taskWhere = buildDashboardTaskWhere(scope, req.user);

    // Run independent dashboard queries in parallel for better response time
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      openTasks,
      overdueTasks,
      tasksDueSoon,
      experimentsNeedingReview,
      protocolsNeedingReview,
      totalEquipment,
      unavailableEquipment,
      equipmentInUseNow,
      upcomingBookings,
      recentProjects,
      recentTasks,
      tasksAwaitingCompletionReview,
      recentExperiments,
      recentNotebookEntries,
    ] = await Promise.all([
      // Count all projects.
      Project.count({
        where: scope.projectWhere,
      }),

      // Count active projects.
      Project.count({
        where: {
          ...scope.projectWhere,
          status: "active",
        },
      }),

      // Count completed projects.
      Project.count({
        where: {
          ...scope.projectWhere,
          status: "completed",
        },
      }),

      // Count all tasks that are not done.
      Task.count({
        where: {
          ...taskWhere,
          status: {
            [Op.ne]: "done",
          },
        },
      }),

      // Count tasks that are overdue and not done.
      Task.count({
        where: {
          ...taskWhere,
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
          ...taskWhere,
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
            required: false,
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
          ...scope.projectLinkedWhere,
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
          ...protocolWhere,
          approvalStatus: {
            [Op.in]: ["pending_review", "changes_requested"],
          },
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
          ...scope.projectLinkedWhere,
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
        where: scope.projectWhere,
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
        where: taskWhere,
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
            required: false,
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

      Task.findAll({
        where: {
          ...taskWhere,
          status: "completion_requested",
        },
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "title"],
            required: false,
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
        where: scope.projectLinkedWhere,
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

      // Fetch recently created or updated notebook entries
      NotebookEntry.findAll({
        where: scope.projectLinkedWhere,
        include: [
          {
            model: Experiment,
            as: "experiment",
            attributes: ["id", "title", "status"],
          },
          {
            model: Project,
            as: "project",
            attributes: ["id", "title", "status"],
          },
          {
            model: User,
            as: "author",
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
        accessScope: {
          role: req.user.role,
          isProjectScoped: scope.isProjectScoped,
          accessibleProjectIds: scope.isProjectScoped
            ? scope.accessibleProjectIds
            : "all",
        },
        metrics: {
          totalProjects,
          activeProjects,
          completedProjects,
          openTasks,
          overdueTasks,
          experimentsNeedingReview: experimentsNeedingReview.length,
          tasksAwaitingCompletionReview: tasksAwaitingCompletionReview.length,
          protocolsNeedingReview: protocolsNeedingReview.length,
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
          tasksAwaitingCompletionReview:
            tasksAwaitingCompletionReview.map(formatTaskSummary),
          protocolsNeedingReview: protocolsNeedingReview.map(
            formatProtocolSummary,
          ),
          upcomingBookings: upcomingBookings.map(formatBookingSummary),
          recentProjects: recentProjects.map(formatProjectSummary),
          recentTasks: recentTasks.map(formatTaskSummary),
          recentExperiments: recentExperiments.map(formatExperimentSummary),
          recentNotebookEntries: recentNotebookEntries.map(
            formatNotebookEntrySummary,
          ),
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
