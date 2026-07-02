const { Op } = require("sequelize");
const {
  EquipmentBooking,
  Equipment,
  User,
  Project,
  Experiment,
} = require("../models");
const { getAccessibleProjectIds } = require("../utils/projectAccess");

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
}) => {
  const where = {
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

    const where = {};

    if (equipmentId) {
      where.equipmentId = equipmentId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    if (req.user.role === "admin") {
      if (projectId) {
        where.projectId = Number(projectId);
      }
    } else {
      const accessibleProjectIds = (
        await getAccessibleProjectIds(req.user)
      ).map(Number);

      if (projectId) {
        const requestedProjectId = Number(projectId);

        if (!accessibleProjectIds.includes(requestedProjectId)) {
          return res.status(403).json({
            status: "error",
            message: "You do not have access to bookings for this project.",
          });
        }

        where.projectId = requestedProjectId;
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
    console.error("Error getting equipment bookings", error);

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
    const { id } = req.params;

    const booking = await EquipmentBooking.findByPk(id, {
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
    console.error("Error getting equipment booking by ID", error);

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
      title,
      startTime,
      endTime,
      status,
      purpose,
      equipmentId,
      userId,
      projectId,
      experimentId,
    } = req.body;

    if (!title || !startTime || !endTime || !equipmentId) {
      return res.status(400).json({
        status: "error",
        message: "Title, start time, end time, and equipment are required.",
      });
    }

    const timeValidation = validateBookingTimeRange(startTime, endTime);

    if (!timeValidation.isValid) {
      return res.status(400).json({
        status: "error",
        message: timeValidation.message,
      });
    }

    const equipment = await Equipment.findByPk(equipmentId);

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
    const resolvedUserId = userId || req.user.id;

    const user = await User.findByPk(resolvedUserId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Booking user not found.",
      });
    }

    if (projectId) {
      const project = await Project.findByPk(projectId);

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
        });
      }
    }

    if (experimentId) {
      const experiment = await Experiment.findByPk(experimentId);

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
      projectId: projectId || null,
      experimentId: experimentId || null,
      organizationId: equipment.organizationId || req.user.organizationId,
    });

    const createdBooking = await EquipmentBooking.findByPk(booking.id, {
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
    console.error("Error creating equipment booking", error);

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
    const { id } = req.params;

    const {
      title,
      startTime,
      endTime,
      status,
      purpose,
      equipmentId,
      userId,
      projectId,
      experimentId,
    } = req.body;

    const booking = await EquipmentBooking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Equipment booking not found.",
      });
    }

    const resolvedEquipmentId =
      equipmentId !== undefined ? equipmentId : booking.equipmentId;

    const resolvedStartTime =
      startTime !== undefined ? startTime : booking.startTime;

    const resolvedEndTime = endTime !== undefined ? endTime : booking.endTime;

    const resolvedStatus = status !== undefined ? status : booking.status;

    const timeValidation = validateBookingTimeRange(
      resolvedStartTime,
      resolvedEndTime,
    );

    if (!timeValidation.isValid) {
      return res.status(400).json({
        status: "error",
        message: timeValidation.message,
      });
    }

    const equipment = await Equipment.findByPk(resolvedEquipmentId);

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

    if (userId) {
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "Booking user not found.",
        });
      }
    }

    if (projectId) {
      const project = await Project.findByPk(projectId);

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
        });
      }
    }

    if (experimentId) {
      const experiment = await Experiment.findByPk(experimentId);

      if (!experiment) {
        return res.status(404).json({
          status: "error",
          message: "Experiment not found.",
        });
      }

      const resolvedProjectId =
        projectId !== undefined ? projectId : booking.projectId;

      if (
        resolvedProjectId &&
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
      });

      if (conflict) {
        return res.status(409).json({
          status: "error",
          message: `Booking conflict: ${conflict.equipment.name} is already booked from ${conflict.startTime} to ${conflict.endTime}.`,
        });
      }
    }

    await booking.update({
      title: title !== undefined ? title.trim() : booking.title,
      startTime: timeValidation.startDate,
      endTime: timeValidation.endDate,
      status: resolvedStatus,
      purpose:
        purpose !== undefined ? purpose?.trim() || null : booking.purpose,
      equipmentId: resolvedEquipmentId,
      userId: userId !== undefined ? userId : booking.userId,
      projectId:
        projectId !== undefined ? projectId || null : booking.projectId,
      experimentId:
        experimentId !== undefined
          ? experimentId || null
          : booking.experimentId,
    });

    const updatedBooking = await EquipmentBooking.findByPk(booking.id, {
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
    console.error("Error updating equipment booking", error);

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
    const { id } = req.params;

    const booking = await EquipmentBooking.findByPk(id);

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
    console.error("Error deleting equipment booking", error);

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
