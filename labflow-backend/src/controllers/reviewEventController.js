const { ReviewEvent, Experiment, Protocol, Task, User } = require("../models");
const { canViewProjectLinkedRecord } = require("../utils/projectAccess");
const { logError } = require("../utils/errorLogger");

// Formats user data safely for review event responses.
// This prevents sensitive fields like passwordHash from being exposed.
const formatUserSummary = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
  };
};

// Formats a review event for API responses
const formatReviewEventResponse = (reviewEvent) => {
  return {
    id: reviewEvent.id,
    targetType: reviewEvent.targetType,
    targetId: reviewEvent.targetId,
    action: reviewEvent.action,
    comment: reviewEvent.comment,
    reviewerId: reviewEvent.reviewerId,
    reviewer: formatUserSummary(reviewEvent.reviewer),
    createdAt: reviewEvent.createdAt,
    updatedAt: reviewEvent.updatedAt,
  };
};

// Reusable include configuration for review event queries
const reviewEventInclude = [
  {
    model: User,
    as: "reviewer",
    attributes: ["id", "name", "email", "role", "department"],
  },
];

const parsePositiveIntegerId = (value) => {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) ? id : null;
};

const parsePositiveIntegerBodyId = (value) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  return value;
};

const VALID_REVIEW_TARGET_TYPES = ["experiment", "protocol", "task"];

const VALID_REVIEW_ACTIONS = ["submitted", "approved", "changes_requested"];

const VALID_MANUAL_REVIEW_ACTIONS = ["approved", "changes_requested"];

// Validates that the review target exists
// Because ReviewEvent can point to either an experiment or a protocol
// this validation replaces a normal single-table foreign key
const findReviewTarget = async ({ targetType, targetId, organizationId }) => {
  if (targetType === "experiment") {
    return Experiment.findOne({
      where: {
        id: targetId,
        organizationId,
      },
    });
  }

  if (targetType === "protocol") {
    return Protocol.findOne({
      where: {
        id: targetId,
        organizationId,
      },
    });
  }

  if (targetType === "task") {
    return Task.findOne({
      where: {
        id: targetId,
        organizationId,
      },
    });
  }

  return null;
};

const canViewReviewTarget = async (user, targetType, targetId) => {
  if (!user || !user.id || !targetType || !targetId) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (targetType === "experiment") {
    const experiment = await Experiment.findOne({
      where: {
        id: targetId,
        organizationId: user.organizationId,
      },
    });

    if (!experiment) {
      return null;
    }

    return canViewProjectLinkedRecord(user, experiment.projectId);
  }

  if (targetType === "protocol") {
    const protocol = await Protocol.findOne({
      where: {
        id: targetId,
        organizationId: user.organizationId,
      },
    });

    if (!protocol) {
      return null;
    }

    if (!protocol.projectId) {
      // General SOP review history rule.
      // Keep this restrictive for now.
      return ["admin", "supervisor"].includes(user.role);
    }

    return canViewProjectLinkedRecord(user, protocol.projectId);
  }

  if (targetType === "task") {
    const task = await Task.findOne({
      where: {
        id: targetId,
        organizationId: user.organizationId,
      },
    });

    if (!task) {
      return null;
    }

    if (task.projectId) {
      return canViewProjectLinkedRecord(user, task.projectId);
    }

    return (
      Number(task.assignedToId) === Number(user.id) ||
      Number(task.createdById) === Number(user.id)
    );
  }

  return false;
};

// GET /api/review-events
// Returns review events with optional filters for targetType, targetId, action, and reviewerId
const getReviewEvents = async (req, res) => {
  try {
    const { targetType, targetId, action, reviewerId } = req.query;

    let parsedTargetId = null;
    let parsedReviewerId = null;

    if (
      targetType !== undefined &&
      !VALID_REVIEW_TARGET_TYPES.includes(targetType)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Target type must be experiment, protocol or task.",
      });
    }

    if (targetId !== undefined) {
      parsedTargetId = parsePositiveIntegerId(targetId);

      if (parsedTargetId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid target ID.",
        });
      }
    }

    if (reviewerId !== undefined) {
      parsedReviewerId = parsePositiveIntegerId(reviewerId);

      if (parsedReviewerId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid reviewer ID.",
        });
      }
    }

    if (action !== undefined && !VALID_REVIEW_ACTIONS.includes(action)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid review action.",
      });
    }

    if (req.user.role !== "admin" && (!targetType || parsedTargetId === null)) {
      return res.status(400).json({
        status: "error",
        message:
          "Target type and target ID are required when fetching review events.",
      });
    }

    if (req.user.role !== "admin") {
      const canView = await canViewReviewTarget(
        req.user,
        targetType,
        parsedTargetId,
      );

      if (canView === null) {
        return res.status(404).json({
          status: "error",
          message: "Review target not found.",
        });
      }

      if (!canView) {
        return res.status(403).json({
          status: "error",
          message: "You do not have access to these review events.",
        });
      }
    }

    const where = {
      organizationId: req.user.organizationId,
    };

    if (targetType !== undefined) {
      where.targetType = targetType;
    }

    if (parsedTargetId !== null) {
      where.targetId = parsedTargetId;
    }

    if (action !== undefined) {
      where.action = action;
    }

    if (parsedReviewerId !== null) {
      where.reviewerId = parsedReviewerId;
    }

    const reviewEvents = await ReviewEvent.findAll({
      where,
      include: reviewEventInclude,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      status: "success",
      data: {
        reviewEvents: reviewEvents.map(formatReviewEventResponse),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "review_events_list_failed",
      message: "Failed to fetch review events",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching review events.",
    });
  }
};

// GET /api/review-events/:id
// Returns one review event by ID
const getReviewEventById = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid review event ID.",
      });
    }

    const reviewEvent = await ReviewEvent.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
      include: reviewEventInclude,
    });

    if (!reviewEvent) {
      return res.status(404).json({
        status: "error",
        message: "Review event not found.",
      });
    }

    if (req.user.role !== "admin") {
      const canView = await canViewReviewTarget(
        req.user,
        reviewEvent.targetType,
        reviewEvent.targetId,
      );

      if (!canView) {
        return res.status(403).json({
          status: "error",
          message: "You do not have access to this review event.",
        });
      }
    }

    return res.json({
      status: "success",
      data: {
        reviewEvent: formatReviewEventResponse(reviewEvent),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "review_event_load_failed",
      message: "Failed to fetch review event",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the review event.",
    });
  }
};

// POST /api/review-events
// Creates a review history event
// In Phase 13B, experiment/protocol update actions will create these automatically
const createReviewEvent = async (req, res) => {
  try {
    const {
      targetType: rawTargetType,
      targetId: rawTargetId,
      action: rawAction,
      comment: rawComment,
    } = req.body;

    if (typeof rawTargetType !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Target type must be a string.",
      });
    }

    if (typeof rawAction !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Review action must be a string.",
      });
    }

    if (
      rawComment !== undefined &&
      rawComment !== null &&
      typeof rawComment !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Review comment must be a string or null.",
      });
    }

    const targetId = parsePositiveIntegerBodyId(rawTargetId);

    if (targetId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid target ID.",
      });
    }

    const targetType = rawTargetType.trim();
    const action = rawAction.trim();

    const comment =
      rawComment === undefined || rawComment === null
        ? null
        : rawComment.trim();

    if (!VALID_REVIEW_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({
        status: "error",
        message: "Target type must be either experiment, protocol or task.",
      });
    }

    if (!VALID_MANUAL_REVIEW_ACTIONS.includes(action)) {
      return res.status(400).json({
        status: "error",
        message: "Action must be either approved or changes_requested.",
      });
    }

    if (action === "changes_requested" && !comment) {
      return res.status(400).json({
        status: "error",
        message: "A review comment is required when requesting changes.",
      });
    }

    if (!["admin", "supervisor"].includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Only admins and supervisors can create review events.",
      });
    }

    const target = await findReviewTarget({
      targetType,
      targetId,
      organizationId: req.user.organizationId,
    });

    if (!target) {
      return res.status(404).json({
        status: "error",
        message: "Review target not found.",
      });
    }

    if (req.user.role !== "admin") {
      const canView = await canViewReviewTarget(req.user, targetType, targetId);

      if (!canView) {
        return res.status(403).json({
          status: "error",
          message:
            "You do not have access to create a review event for this target.",
        });
      }
    }

    const reviewEvent = await ReviewEvent.create({
      targetType,
      targetId,
      action,
      comment: comment || null,
      reviewerId: req.user.id,
      organizationId: req.user.organizationId,
    });

    const createdReviewEvent = await ReviewEvent.findOne({
      where: {
        id: reviewEvent.id,
        organizationId: req.user.organizationId,
      },
      include: reviewEventInclude,
    });

    return res.status(201).json({
      status: "success",
      message: "Review event created successfully.",
      data: {
        reviewEvent: formatReviewEventResponse(createdReviewEvent),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "review_event_create_failed",
      message: "Failed to create review event",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the review event.",
    });
  }
};

// DELETE /api/review-events/:id
// Deletes a review event
// This is restricted to admins because review history should not be casually modified
const deleteReviewEvent = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Only admins can delete review events.",
      });
    }
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid review event ID.",
      });
    }

    const reviewEvent = await ReviewEvent.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!reviewEvent) {
      return res.status(404).json({
        status: "error",
        message: "Review event not found.",
      });
    }

    await reviewEvent.destroy();

    return res.json({
      status: "success",
      message: "Review event deleted successfully.",
    });
  } catch (error) {
    logError(error, {
      req,
      event: "review_event_delete_failed",
      message: "Failed to delete review event",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the review event.",
    });
  }
};

module.exports = {
  getReviewEvents,
  getReviewEventById,
  createReviewEvent,
  deleteReviewEvent,
};
