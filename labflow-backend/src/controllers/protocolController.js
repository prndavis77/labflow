const { Protocol, Project, User, Equipment } = require("../models");

// Formats user data safely for API responses
// This prevents sensitive fields like passwordHash from leaking to the frontend
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

// Formats project data for protocol responses
// Protocol list views do not need the full project object
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

// Formats equipment data for protocol responses
// This is useful for equipment-specific SOPs
function formatEquipmentSummary(equipment) {
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
}

// Formats protocol data before sending it to the frontend
const formatProtocolResponse = (protocol) => {
  return {
    id: protocol.id,
    title: protocol.title,
    version: protocol.version,
    purpose: protocol.purpose,
    content: protocol.content,
    approvalStatus: protocol.approvalStatus,
    reviewComment: protocol.reviewComment,
    projectId: protocol.projectId,
    equipmentId: protocol.equipmentId,
    createdById: protocol.createdById,
    approvedById: protocol.approvedById,
    approvedAt: protocol.approvedAt,
    project: formatProjectSummary(protocol.project),
    equipment: formatEquipmentSummary(protocol.equipment),
    createdBy: formatUserSummary(protocol.createdBy),
    approvedBy: formatUserSummary(protocol.approvedBy),
    createdAt: protocol.createdAt,
    updatedAt: protocol.updatedAt,
  };
};

// Reusable include configuration for protocol queries
// This keeps list, detail, create, and update responses consistent
const protocolInclude = [
  {
    model: Project,
    as: "project",
    attributes: ["id", "title", "status"],
  },
  {
    model: Equipment,
    as: "equipment",
    attributes: ["id", "name", "type", "location", "status"],
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "name", "email", "role", "department"],
  },
  {
    model: User,
    as: "approvedBy",
    attributes: ["id", "name", "email", "role", "department"],
  },
];

// GET /api/protocols
// Returns protocols with optional filters for project and approval status
const getProtocols = async (req, res) => {
  try {
    const { projectId, equipmentId, approvalStatus } = req.query;

    // Build a flexible filter object from query parameters.
    const where = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (equipmentId) {
      where.equipmentId = equipmentId;
    }

    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    const protocols = await Protocol.findAll({
      where,
      include: protocolInclude,
      order: [
        ["updatedAt", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.json({
      status: "success",
      data: {
        protocols: protocols.map(formatProtocolResponse),
      },
    });
  } catch (error) {
    console.error("Error getting protocols", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching protocols.",
    });
  }
};

// GET /api/protocols/:id
// Returns one protocol by ID
const getProtocolById = async (req, res) => {
  try {
    const { id } = req.params;

    const protocol = await Protocol.findByPk(id, {
      include: protocolInclude,
    });

    if (!protocol) {
      return res.status(404).json({
        status: "error",
        message: "Protocol not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        protocol: formatProtocolResponse(protocol),
      },
    });
  } catch (error) {
    console.error("Error getting protocol by ID", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the protocol.",
    });
  }
};

// POST /api/protocols
// Creates a project-linked protocol
const createProtocol = async (req, res) => {
  try {
    const {
      title,
      version,
      purpose,
      content,
      approvalStatus,
      reviewComment,
      projectId,
      equipmentId,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        status: "error",
        message: "Protocol title and content are required.",
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

    if (equipmentId) {
      const equipment = await Equipment.findByPk(equipmentId);

      if (!equipment) {
        return res.status(404).json({
          status: "error",
          message: "Equipment not found.",
        });
      }
    }

    const resolvedApprovalStatus = approvalStatus || "draft";

    // If a protocol is created as approved, store who approved it
    // For this MVP, only supervisors/admins can create protocols through routes
    const approvedById =
      resolvedApprovalStatus === "approved" ? req.user.id : null;

    const approvedAt =
      resolvedApprovalStatus === "approved"
        ? new Date().toISOString().slice(0, 10)
        : null;

    const protocol = await Protocol.create({
      title: title.trim(),
      version: version?.trim() || "1.0",
      purpose: purpose?.trim() || null,
      content: content.trim(),
      approvalStatus: resolvedApprovalStatus,
      reviewComment: reviewComment?.trim() || null,
      projectId: projectId || null,
      equipmentId: equipmentId || null,
      createdById: req.user.id,
      approvedById,
      approvedAt,
    });

    const createdProtocol = await Protocol.findByPk(protocol.id, {
      include: protocolInclude,
    });

    return res.status(201).json({
      status: "success",
      message: "Protocol created successfully.",
      data: {
        protocol: formatProtocolResponse(createdProtocol),
      },
    });
  } catch (error) {
    console.error("Error creating protocol", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the protocol.",
    });
  }
};

// PATCH /api/protocols/:id
// Updates an existing protocol
const updateProtocol = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      version,
      purpose,
      content,
      approvalStatus,
      reviewComment,
      projectId,
      equipmentId,
    } = req.body;

    const protocol = await Protocol.findByPk(id);

    if (!protocol) {
      return res.status(404).json({
        status: "error",
        message: "Protocol not found.",
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

    if (equipmentId) {
      const equipment = await Equipment.findByPk(equipmentId);

      if (!equipment) {
        return res.status(404).json({
          status: "error",
          message: "Equipment not found.",
        });
      }
    }

    const nextApprovalStatus =
      approvalStatus !== undefined ? approvalStatus : protocol.approvalStatus;

    // When a protocol becomes approved, store approver metadata.
    // When it leaves approved status, clear approval metadata.
    let nextApprovedById = protocol.approvedById;
    let nextApprovedAt = protocol.approvedAt;

    if (approvalStatus !== undefined) {
      if (approvalStatus === "approved") {
        nextApprovedById = req.user.id;
        nextApprovedAt = new Date().toISOString().slice(0, 10);
      } else {
        nextApprovedById = null;
        nextApprovedAt = null;
      }
    }

    await protocol.update({
      title: title !== undefined ? title.trim() : protocol.title,
      version: version !== undefined ? version.trim() : protocol.version,
      purpose:
        purpose !== undefined ? purpose?.trim() || null : protocol.purpose,
      content: content !== undefined ? content.trim() : protocol.content,
      approvalStatus: nextApprovalStatus,
      projectId:
        projectId !== undefined ? projectId || null : protocol.projectId,
      equipmentId:
        equipmentId !== undefined ? equipmentId || null : protocol.equipmentId,
      approvedById: nextApprovedById,
      approvedAt: nextApprovedAt,
      reviewComment:
        reviewComment !== undefined
          ? reviewComment?.trim() || null
          : protocol.reviewComment,
    });

    const updatedProtocol = await Protocol.findByPk(protocol.id, {
      include: protocolInclude,
    });

    return res.json({
      status: "success",
      message: "Protocol updated successfully.",
      data: {
        protocol: formatProtocolResponse(updatedProtocol),
      },
    });
  } catch (error) {
    console.error("Error updating protocol", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the protocol.",
    });
  }
};

// DELETE /api/protocols/:id
// Deletes a protocol.
// Later, archiving is safer than hard deletion because protocols are part of research history.
const deleteProtocol = async (req, res) => {
  try {
    const { id } = req.params;

    const protocol = await Protocol.findByPk(id);

    if (!protocol) {
      return res.status(404).json({
        status: "error",
        message: "Protocol not found.",
      });
    }

    await protocol.destroy();

    return res.json({
      status: "success",
      message: "Protocol deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting protocol", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while deleting the protocol.",
    });
  }
};

module.exports = {
  getProtocols,
  getProtocolById,
  createProtocol,
  updateProtocol,
  deleteProtocol,
};
