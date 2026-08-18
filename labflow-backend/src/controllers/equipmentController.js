const { Equipment } = require("../models");
const { logError } = require("../utils/errorLogger");

const VALID_EQUIPMENT_STATUSES = [
  "available",
  "maintenance",
  "out_of_service",
  "retired",
];

// Formats equipment data before sending it to the frontend
const formatEquipmentResponse = (equipment) => {
  return {
    id: equipment.id,
    name: equipment.name,
    type: equipment.type,
    location: equipment.location,
    status: equipment.status,
    notes: equipment.notes,
    createdAt: equipment.createdAt,
    updatedAt: equipment.updatedAt,
  };
};

// GET /api/equipment
// Returns all equipment, with optional status filtering
const getEquipment = async (req, res) => {
  try {
    const { status } = req.query;

    if (status && !VALID_EQUIPMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment status.",
      });
    }

    const where = {
      organizationId: req.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    const equipment = await Equipment.findAll({
      where,
      order: [
        ["status", "ASC"],
        ["name", "ASC"],
      ],
    });

    return res.json({
      status: "success",
      data: {
        equipment: equipment.map(formatEquipmentResponse),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_list_failed",
      message: "Failed to fetch equipment",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching equipment.",
    });
  }
};

// GET /api/equipment/:id
// Returns one equipment item by ID
const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await Equipment.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!equipment) {
      return res.status(404).json({
        status: "error",
        message: "Equipment not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        equipment: formatEquipmentResponse(equipment),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_load_failed",
      message: "Failed to fetch equipment",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the equipment.",
    });
  }
};

// POST /api/equipment
// Creates a new shared lab equipment item
const createEquipment = async (req, res) => {
  try {
    const { name, type, location, status, notes } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        status: "error",
        message: "Equipment name and type are required.",
      });
    }

    if (typeof name !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Equipment name must be a string.",
      });
    }

    if (typeof type !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Equipment type must be a string.",
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Equipment name must be between 2 and 200 characters.",
      });
    }

    const trimmedType = type.trim();

    if (trimmedType.length === 0 || trimmedType.length > 100) {
      return res.status(400).json({
        status: "error",
        message: "Equipment type must be between 1 and 100 characters.",
      });
    }

    if (
      location !== undefined &&
      location !== null &&
      typeof location !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Equipment location must be a string or null.",
      });
    }

    if (
      location !== undefined &&
      location !== null &&
      location.trim().length > 200
    ) {
      return res.status(400).json({
        status: "error",
        message: "Equipment location must be 200 characters or fewer.",
      });
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Equipment notes must be a string or null.",
      });
    }

    if (status !== undefined && !VALID_EQUIPMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment status.",
      });
    }

    const equipment = await Equipment.create({
      name: name.trim(),
      type: type.trim(),
      location: location?.trim() || null,
      status: status || "available",
      notes: notes?.trim() || null,
      organizationId: req.user.organizationId,
    });

    return res.status(201).json({
      status: "success",
      message: "Equipment created successfully.",
      data: {
        equipment: formatEquipmentResponse(equipment),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_create_failed",
      message: "Failed to create equipment",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating equipment.",
    });
  }
};

// PATCH /api/equipment/:id
// Updates an existing equipment item
const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, location, status, notes } = req.body;

    if (name !== undefined && typeof name !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Equipment name must be a string.",
      });
    }

    const trimmedName = name !== undefined ? name.trim() : null;

    if (
      name !== undefined &&
      (trimmedName.length < 2 || trimmedName.length > 200)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Equipment name must be between 2 and 200 characters.",
      });
    }

    if (type !== undefined && typeof type !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Equipment type must be a string.",
      });
    }

    const trimmedType = type !== undefined ? type.trim() : null;

    if (
      type !== undefined &&
      (trimmedType.length === 0 || trimmedType.length > 100)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Equipment type must be between 1 and 100 characters.",
      });
    }

    if (
      location !== undefined &&
      location !== null &&
      typeof location !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Equipment location must be a string or null.",
      });
    }

    if (
      location !== undefined &&
      location !== null &&
      location.trim().length > 200
    ) {
      return res.status(400).json({
        status: "error",
        message: "Equipment location must be 200 characters or fewer.",
      });
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Equipment notes must be a string or null.",
      });
    }

    if (status !== undefined && !VALID_EQUIPMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid equipment status.",
      });
    }

    const equipment = await Equipment.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!equipment) {
      return res.status(404).json({
        status: "error",
        message: "Equipment not found.",
      });
    }

    await equipment.update({
      name: name !== undefined ? trimmedName : equipment.name,
      type: type !== undefined ? trimmedType : equipment.type,
      location:
        location !== undefined ? location?.trim() || null : equipment.location,
      status: status !== undefined ? status : equipment.status,
      notes: notes !== undefined ? notes?.trim() || null : equipment.notes,
    });

    return res.json({
      status: "success",
      message: "Equipment updated successfully.",
      data: {
        equipment: formatEquipmentResponse(equipment),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_update_failed",
      message: "Failed to update equipment",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating equipment.",
    });
  }
};

// DELETE /api/equipment/:id
// Deletes an equipment item.
// In production, status = retired is often safer than hard deletion.
const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await Equipment.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!equipment) {
      return res.status(404).json({
        status: "error",
        message: "Equipment not found.",
      });
    }

    await equipment.destroy();

    return res.json({
      status: "success",
      message: "Equipment deleted successfully.",
    });
  } catch (error) {
    logError(error, {
      req,
      event: "equipment_delete_failed",
      message: "Failed to delete equipment",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting equipment.",
    });
  }
};

module.exports = {
  getEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
};
