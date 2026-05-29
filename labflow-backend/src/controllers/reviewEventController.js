const { ReviewEvent, Experiment, Protocol, User } = require("../models");

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

// Validates that the review target exists
// Because ReviewEvent can point to either an experiment or a protocol
// this validation replaces a normal single-table foreign key
const findReviewTarget = async (targetType, targetId) => {
  if (targetType === "experiment") {
    return Experiment.findByPk(targetId);
  }

  if (targetType === "protocol") {
    return Protocol.findByPk(targetId);
  }

  return null;
};

// GET /api/review-events
// Returns review events with optional filters for targetType, targetId, action, and reviewerId
const getReviewEvents = async (req, res) => {
  try {
    const { targetType, targetId, action, reviewerId } = req.query;

    const where = {};

    if (targetType) {
      where.targetType = targetType;
    }

    if (targetId) {
      where.targetId = targetId;
    }

    if (action) {
      where.action = action;
    }

    if (reviewerId) {
      where.reviewerId = reviewerId;
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
    console.error("Error fetching review events", error);

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
    const { id } = req.params;

    const reviewEvent = await ReviewEvent.findByPk(id, {
      include: reviewEventInclude,
    });

    if (!reviewEvent) {
      return res.status(404).json({
        status: "error",
        message: "Review event not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        reviewEvent: formatReviewEventResponse(reviewEvent),
      },
    });
  } catch (error) {
    console.error("Error fetching review event", error);

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
    const { targetType, targetId, action, comment } = req.body;

    if (!targetType || !targetId || !action) {
      return res.status(400).json({
        status: "error",
        message: "Target type, target ID, and action are required.",
      });
    }

    if (!["experiment", "protocol"].includes(targetType)) {
      return res.status(400).json({
        status: "error",
        message: "Target type must be either experiment or protocol.",
      });
    }

    if (!["approved", "changes_requested"].includes(action)) {
      return res.status(400).json({
        status: "error",
        message: "Action must be either approved or changes_requested.",
      });
    }

    if (action === "changes_requested" && !comment?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "A review comment is required when requesting changes.",
      });
    }

    const target = await findReviewTarget(targetType, targetId);

    if (!target) {
      return res.status(404).json({
        status: "error",
        message: "Review target not found.",
      });
    }

    const reviewEvent = await ReviewEvent.create({
      targetType,
      targetId,
      action,
      comment: comment?.trim() || null,
      reviewerId: req.user.id,
    });

    const createdReviewEvent = await ReviewEvent.findByPk(reviewEvent.id, {
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
    console.error("Error creating review event", error);

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
    const { id } = req.params;

    const reviewEvent = await ReviewEvent.findByPk(id);

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
    console.error("Error deleting review event", error);

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
