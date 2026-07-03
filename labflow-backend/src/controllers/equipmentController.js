const { Equipment } = require("../models");

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
    console.error("Error getting equipment", error);

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
    console.error("Error getting equipment by ID", error);

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
    console.error("Error creating equipment", error);

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
      name: name !== undefined ? name.trim() : equipment.name,
      type: type !== undefined ? type.trim() : equipment.type,
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
    console.error("Error updating equipment", error);

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
    console.error("Error deleting equipment", error);

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
