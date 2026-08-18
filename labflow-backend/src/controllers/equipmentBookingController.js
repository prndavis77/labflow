const { Op } = require("sequelize");
const {
  EquipmentBooking,
  Equipment,
  User,
  Project,
  Experiment,
} = require("../models");
const { getAccessibleProjectIds } = require("../utils/projectAccess");
const { logError } = require("../utils/errorLogger");

// Formats user data safely for API responses
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

// Formats equipment data for booking responses
const formatEquipmentSummary = (equipment) => {
  if (!equipment) {
    return null;
  }

  return {
    id: equipment.id,
    name: equipment.name,
    type: equipment.type,
    location: equipment.location,
    status: equipment.status,
  };
};

// Formats project data for booking responses
const formatProjectSummary = (project) => {
  if (!project) {
    return null;
  }

  return {
    id: project.id,
    title: project.title,
    status: project.status,
  };
};

// Formats experiment data for booking responses
const formatExperimentSummary = (experiment) => {
  if (!experiment) {
    return null;
  }

  return {
    id: experiment.id,
    title: experiment.title,
    status: experiment.status,
  };
};

// Formats booking data before sending it to the frontend
const formatBookingResponse = (booking) => {
  return {
    id: booking.id,
    title: booking.title,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    purpose: booking.purpose,
    equipmentId: booking.equipmentId,
    userId: booking.userId,
    projectId: booking.projectId,
    experimentId: booking.experimentId,
    equipment: formatEquipmentSummary(booking.equipment),
    user: formatUserSummary(booking.user),
    project: formatProjectSummary(booking.project),
    experiment: formatExperimentSummary(booking.experiment),
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
};

// Reusable include configuration for booking queries
const bookingInclude = [
  {
    model: Equipment,
    as: "equipment",
    attributes: ["id", "name", "type", "location", "status"],
  },
  {
    model: User,
    as: "user",
    attributes: ["id", "name", "email", "role", "department"],
  },
  {
    model: Project,
    as: "project",
    attributes: ["id", "title", "status"],
  },
  {
    model: Experiment,
    as: "experiment",
    attributes: ["id", "title", "status"],
  },
];

const VALID_BOOKING_STATUSES = ["confirmed", "cancelled", "completed"];

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

// Validates that the booking time range is usable
const validateBookingTimeRange = (startTime, endTime) => {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      isValid: false,
      message: "Start time and end time must be valid dates.",
    };
  }

  if (endDate <= startDate) {
    return {
      isValid: false,
      message: "End time must be after start time.",
    };
  }

  return {
    isValid: true,
    startDate,
    endDate,
  };
};

// Checks whether a confirmed booking overlaps with another confirmed booking
// Overlap rule: existing.start < new.end AND existing.end > new.start
const findConflictingBooking = async ({
  equipmentId,
  startDate,
  endDate,
  ignoredBookingId,
  organizationId,
}) => {
  const where = {
    organizationId,
    equipmentId,
    status: "confirmed",
    startTime: {
      [Op.lt]: endDate,
    },
    endTime: {
      [Op.gt]: startDate,
    },
  };

  // When updating a booking, ignore the booking being updated.
  if (ignoredBookingId) {
    where.id = {
      [Op.ne]: ignoredBookingId,
    };
  }

  return EquipmentBooking.findOne({
    where,
    include: bookingInclude,
  });
};

// GET /api/equipment-bookings
// Returns bookings with optional filters for equipment, user, project, and status
const getEquipmentBookings = async (req, res) => {
  try {
    const { equipmentId, userId, projectId, status } = req.query;

    let parsedEquipmentId = null;
    let parsedUserId = null;
    let parsedProjectId = null;

    if (equipmentId !== undefined) {
      parsedEquipmentId = parsePositiveIntegerId(equipmentId);

      if (parsedEquipmentId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid equipment ID.",
        });
      }
    }

    if (userId !== undefined) {
      parsedUserId = parsePositiveIntegerId(userId);

      if (parsedUserId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid user ID.",
        });
      }
    }

    if (projectId !== undefined) {
      parsedProjectId = parsePositiveIntegerId(projectId);

      if (parsedProjectId === null) {
        return res.status(400).json({
          status: "error",
          message: "Invalid project ID.",
        });
      }
    }

    if (status !== undefined && !VALID_BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid booking status.",
      });
    }

    const where = {
      organizationId: req.user.organizationId,
    };

    if (parsedEquipmentId !== null) {
      where.equipmentId = parsedEquipmentId;
    }

    if (parsedUserId !== null) {
      where.userId = parsedUserId;
    }

    if (status !== undefined) {
      where.status = status;
    }

    if (req.user.role === "admin") {
      if (parsedProjectId !== null) {
        where.projectId = parsedProjectId;
      }
    } else {
      const accessibleProjectIds = (
        await getAccessibleProjectIds(req.user)
      ).map(Number);

      if (parsedProjectId !== null) {
        if (!accessibleProjectIds.includes(parsedProjectId)) {
          return res.status(403).json({
            status: "error",
            message: "You do not have access to bookings for this project.",
          });
        }

        where.projectId = parsedProjectId;
      } else {
        where[Op.or] = [
          {
            projectId: {
              [Op.in]: accessibleProjectIds,
            },
          },
          {
            projectId: null,
            userId: req.user.id,
          },
        ];
      }
    }

    const bookings = await EquipmentBooking.findAll({
      where,
      include: bookingInclude,
      order: [["startTime", "ASC"]],
    });

    return res.json({
      status: "success",
      data: {
        bookings: bookings.map(formatBookingResponse),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_booking_list_failed",
      message: "Failed to load equipment bookings",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching equipment bookings.",
    });
  }
};

// GET /api/equipment-bookings/:id
// Returns one booking by ID
const getEquipmentBookingById = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment booking ID.",
      });
    }

    const booking = await EquipmentBooking.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
      include: bookingInclude,
    });

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Equipment booking not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        booking: formatBookingResponse(booking),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_booking_load_failed",
      message: "Failed to load equipment booking",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the equipment booking.",
    });
  }
};

// POST /api/equipment-bookings
// Creates a new equipment booking and prevents overlapping confirmed bookings
const createEquipmentBooking = async (req, res) => {
  try {
    const {
      title: rawTitle,
      startTime: rawStartTime,
      endTime: rawEndTime,
      status: rawStatus,
      purpose: rawPurpose,
      equipmentId: rawEquipmentId,
      userId: rawUserId,
      projectId: rawProjectId,
      experimentId: rawExperimentId,
    } = req.body;

    if (
      rawTitle !== undefined &&
      rawTitle !== null &&
      typeof rawTitle !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Booking title must be a string.",
      });
    }

    if (
      rawStartTime !== undefined &&
      rawStartTime !== null &&
      typeof rawStartTime !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Start time must be a string.",
      });
    }

    if (
      rawEndTime !== undefined &&
      rawEndTime !== null &&
      typeof rawEndTime !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "End time must be a string.",
      });
    }

    if (
      rawStatus !== undefined &&
      rawStatus !== null &&
      typeof rawStatus !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Booking status must be a string.",
      });
    }

    if (
      rawPurpose !== undefined &&
      rawPurpose !== null &&
      typeof rawPurpose !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Booking purpose must be a string or null.",
      });
    }

    const equipmentId = parsePositiveIntegerBodyId(rawEquipmentId);

    const userId =
      rawUserId === undefined || rawUserId === null
        ? null
        : parsePositiveIntegerBodyId(rawUserId);

    const projectId =
      rawProjectId === undefined || rawProjectId === null
        ? null
        : parsePositiveIntegerBodyId(rawProjectId);

    const experimentId =
      rawExperimentId === undefined || rawExperimentId === null
        ? null
        : parsePositiveIntegerBodyId(rawExperimentId);

    if (equipmentId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment ID.",
      });
    }

    if (rawUserId !== undefined && rawUserId !== null && userId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user ID.",
      });
    }

    if (
      rawProjectId !== undefined &&
      rawProjectId !== null &&
      projectId === null
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid project ID.",
      });
    }

    if (
      rawExperimentId !== undefined &&
      rawExperimentId !== null &&
      experimentId === null
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid experiment ID.",
      });
    }

    const title = rawTitle?.trim() || "";
    const startTime = rawStartTime;
    const endTime = rawEndTime;
    const status = rawStatus || "confirmed";
    const purpose = rawPurpose?.trim() || null;

    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Booking title is required.",
      });
    }

    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Booking title must be between 3 and 200 characters.",
      });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({
        status: "error",
        message: "Start time and end time are required.",
      });
    }

    if (!VALID_BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid booking status.",
      });
    }

    const timeValidation = validateBookingTimeRange(startTime, endTime);

    if (!timeValidation.isValid) {
      return res.status(400).json({
        status: "error",
        message: timeValidation.message,
      });
    }

    const equipment = await Equipment.findOne({
      where: {
        id: equipmentId,
        organizationId: req.user.organizationId,
      },
    });

    if (!equipment) {
      return res.status(404).json({
        status: "error",
        message: "Equipment not found.",
      });
    }

    if (equipment.status !== "available") {
      return res.status(400).json({
        status: "error",
        message: "Only available equipment can be booked.",
      });
    }

    // If no userId is provided, assign the booking to the logged-in user
    const resolvedUserId = userId ?? req.user.id;

    const user = await User.findOne({
      where: {
        id: resolvedUserId,
        organizationId: req.user.organizationId,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Booking user not found.",
      });
    }

    if (projectId) {
      const project = await Project.findOne({
        where: {
          id: projectId,
          organizationId: req.user.organizationId,
          isArchived: false,
        },
      });

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
        });
      }
    }

    if (experimentId) {
      const experiment = await Experiment.findOne({
        where: {
          id: experimentId,
          organizationId: req.user.organizationId,
          isArchived: false,
        },
      });

      if (!experiment) {
        return res.status(404).json({
          status: "error",
          message: "Experiment not found.",
        });
      }

      if (projectId && Number(experiment.projectId) !== Number(projectId)) {
        return res.status(400).json({
          status: "error",
          message: "Linked experiment must belong to the selected project.",
        });
      }
    }

    const resolvedStatus = status || "confirmed";

    if (resolvedStatus === "confirmed") {
      const conflict = await findConflictingBooking({
        equipmentId,
        startDate: timeValidation.startDate,
        endDate: timeValidation.endDate,
        organizationId: req.user.organizationId,
      });

      if (conflict) {
        return res.status(409).json({
          status: "error",
          message: `Booking conflict: ${conflict.equipment.name} is already booked from ${conflict.startTime} to ${conflict.endTime}.`,
        });
      }
    }

    const booking = await EquipmentBooking.create({
      title: title.trim(),
      startTime: timeValidation.startDate,
      endTime: timeValidation.endDate,
      status: resolvedStatus,
      purpose: purpose?.trim() || null,
      equipmentId,
      userId: resolvedUserId,
      projectId: projectId ?? null,
      experimentId: experimentId ?? null,
      organizationId: equipment.organizationId || req.user.organizationId,
    });

    const createdBooking = await EquipmentBooking.findOne({
      where: {
        id: booking.id,
        organizationId: req.user.organizationId,
      },
      include: bookingInclude,
    });

    return res.status(201).json({
      status: "success",
      message: "Equipment booking created successfully.",
      data: {
        booking: formatBookingResponse(createdBooking),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_booking_create_failed",
      message: "Failed to create equipment booking",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the equipment booking.",
    });
  }
};

// PATCH /api/equipment-bookings/:id
// Updates an equipment booking and prevents overlapping confirmed bookings
const updateEquipmentBooking = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment booking ID.",
      });
    }

    const {
      title: rawTitle,
      startTime: rawStartTime,
      endTime: rawEndTime,
      status: rawStatus,
      purpose: rawPurpose,
      equipmentId: rawEquipmentId,
      userId: rawUserId,
      projectId: rawProjectId,
      experimentId: rawExperimentId,
    } = req.body;

    if (
      rawTitle !== undefined &&
      rawTitle !== null &&
      typeof rawTitle !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Booking title must be a string.",
      });
    }

    if (
      rawStartTime !== undefined &&
      rawStartTime !== null &&
      typeof rawStartTime !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Start time must be a string.",
      });
    }

    if (
      rawEndTime !== undefined &&
      rawEndTime !== null &&
      typeof rawEndTime !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "End time must be a string.",
      });
    }

    if (
      rawStatus !== undefined &&
      rawStatus !== null &&
      typeof rawStatus !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Booking status must be a string.",
      });
    }

    if (
      rawPurpose !== undefined &&
      rawPurpose !== null &&
      typeof rawPurpose !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Booking purpose must be a string or null.",
      });
    }

    const equipmentId =
      rawEquipmentId === undefined
        ? undefined
        : parsePositiveIntegerBodyId(rawEquipmentId);

    const userId =
      rawUserId === undefined
        ? undefined
        : parsePositiveIntegerBodyId(rawUserId);

    const projectId =
      rawProjectId === undefined
        ? undefined
        : rawProjectId === null
          ? null
          : parsePositiveIntegerBodyId(rawProjectId);

    const experimentId =
      rawExperimentId === undefined
        ? undefined
        : rawExperimentId === null
          ? null
          : parsePositiveIntegerBodyId(rawExperimentId);

    if (rawEquipmentId !== undefined && equipmentId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment ID.",
      });
    }

    if (rawUserId !== undefined && userId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user ID.",
      });
    }

    if (
      rawProjectId !== undefined &&
      rawProjectId !== null &&
      projectId === null
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid project ID.",
      });
    }

    if (
      rawExperimentId !== undefined &&
      rawExperimentId !== null &&
      experimentId === null
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid experiment ID.",
      });
    }

    const booking = await EquipmentBooking.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Equipment booking not found.",
      });
    }

    const title = rawTitle !== undefined ? rawTitle.trim() : booking.title;

    const purpose =
      rawPurpose !== undefined ? rawPurpose?.trim() || null : booking.purpose;

    const resolvedStartTime =
      rawStartTime !== undefined ? rawStartTime : booking.startTime;

    const resolvedEndTime =
      rawEndTime !== undefined ? rawEndTime : booking.endTime;

    const resolvedStatus = rawStatus !== undefined ? rawStatus : booking.status;

    const resolvedEquipmentId =
      equipmentId !== undefined ? equipmentId : booking.equipmentId;

    const timeValidation = validateBookingTimeRange(
      resolvedStartTime,
      resolvedEndTime,
    );

    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Booking title is required.",
      });
    }

    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Booking title must be between 3 and 200 characters.",
      });
    }

    if (!VALID_BOOKING_STATUSES.includes(resolvedStatus)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid booking status.",
      });
    }

    if (!timeValidation.isValid) {
      return res.status(400).json({
        status: "error",
        message: timeValidation.message,
      });
    }

    const resolvedProjectId =
      projectId !== undefined ? projectId : booking.projectId;

    const resolvedExperimentId =
      experimentId !== undefined ? experimentId : booking.experimentId;

    const equipment = await Equipment.findOne({
      where: {
        id: resolvedEquipmentId,
        organizationId: req.user.organizationId,
      },
    });

    if (!equipment) {
      return res.status(404).json({
        status: "error",
        message: "Equipment not found.",
      });
    }

    if (equipment.status !== "available" && resolvedStatus === "confirmed") {
      return res.status(400).json({
        status: "error",
        message: "Only available equipment can have confirmed bookings.",
      });
    }

    if (userId !== undefined) {
      const user = await User.findOne({
        where: {
          id: userId,
          organizationId: req.user.organizationId,
        },
      });

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "Booking user not found.",
        });
      }
    }

    if (resolvedProjectId !== null) {
      const project = await Project.findOne({
        where: {
          id: resolvedProjectId,
          organizationId: req.user.organizationId,
          isArchived: false,
        },
      });

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
        });
      }
    }

    if (resolvedExperimentId !== null) {
      const experiment = await Experiment.findOne({
        where: {
          id: resolvedExperimentId,
          organizationId: req.user.organizationId,
          isArchived: false,
        },
      });

      if (!experiment) {
        return res.status(404).json({
          status: "error",
          message: "Experiment not found.",
        });
      }

      if (
        resolvedProjectId !== null &&
        Number(experiment.projectId) !== Number(resolvedProjectId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Linked experiment must belong to the selected project.",
        });
      }
    }

    if (resolvedStatus === "confirmed") {
      const conflict = await findConflictingBooking({
        equipmentId: resolvedEquipmentId,
        startDate: timeValidation.startDate,
        endDate: timeValidation.endDate,
        ignoredBookingId: booking.id,
        organizationId: req.user.organizationId,
      });

      if (conflict) {
        return res.status(409).json({
          status: "error",
          message: `Booking conflict: ${conflict.equipment.name} is already booked from ${conflict.startTime} to ${conflict.endTime}.`,
        });
      }
    }

    await booking.update({
      title,
      startTime: timeValidation.startDate,
      endTime: timeValidation.endDate,
      status: resolvedStatus,
      purpose,
      equipmentId: resolvedEquipmentId,
      userId: userId !== undefined ? userId : booking.userId,
      projectId: resolvedProjectId,
      experimentId: resolvedExperimentId,
      organizationId: equipment.organizationId || req.user.organizationId,
    });
    const updatedBooking = await EquipmentBooking.findOne({
      where: {
        id: booking.id,
        organizationId: req.user.organizationId,
      },
      include: bookingInclude,
    });

    return res.json({
      status: "success",
      message: "Equipment booking updated successfully.",
      data: {
        booking: formatBookingResponse(updatedBooking),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_booking_update_failed",
      message: "Failed to update equipment booking",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occured while updating the equipment booking.",
    });
  }
};

// DELETE /api/equipment-bookings/:id
// Deletes an equipment booking.
// Later, cancelling bookings may be better than hard deletion.
const deleteEquipmentBooking = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment booking ID.",
      });
    }

    const booking = await EquipmentBooking.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Equipment booking not found.",
      });
    }

    await booking.destroy();

    return res.json({
      status: "success",
      message: "Equipment booking deleted successfully.",
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_booking_delete_failed",
      message: "Failed to delete equipment booking",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the equipment booking.",
    });
  }
};

module.exports = {
  getEquipmentBookings,
  getEquipmentBookingById,
  createEquipmentBooking,
  updateEquipmentBooking,
  deleteEquipmentBooking,
};
