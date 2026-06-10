const {
  Protocol,
  Project,
  User,
  Equipment,
  ReviewEvent,
} = require("../models");
const {
  canCreateProtocol,
  canEditProtocol,
} = require("../utils/workflowPermissions");
const {
  canUseProjectForResearchWork,
  canEditProjectLinkedWork,
  canViewProjectLinkedRecord,
  canReviewProjectLinkedRecord,
  getAccessibleProjectIds,
  getProjectMemberRole,
} = require("../utils/projectAccess");
const { Op } = require("sequelize");

const VALID_APPROVAL_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "changes_requested",
  "archived",
];

const isAdminOrSupervisor = (user) => {
  return ["admin", "supervisor"].includes(user?.role);
};

const canManageGeneralProtocol = (user) => {
  return isAdminOrSupervisor(user);
};

const canCreateProtocolInProject = async (user, projectId) => {
  const canEditProject = await canEditProjectLinkedWork(user, projectId);

  if (!canEditProject) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  if (projectRole === "lead") {
    return true;
  }

  if (projectRole === "member") {
    return canCreateProtocol(user);
  }

  return false;
};

const canEditProtocolInProject = async (user, projectId) => {
  const canEditProject = await canEditProjectLinkedWork(user, projectId);

  if (!canEditProject) {
    return false;
  }

  if (isAdminOrSupervisor(user)) {
    return true;
  }

  const projectRole = await getProjectMemberRole(user, projectId);

  if (projectRole === "lead") {
    return true;
  }

  if (projectRole === "member") {
    return canEditProtocol(user);
  }

  return false;
};

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

// Creates a review history event for protocol approval decisions
// This preserves repeated review cycles and protocol feedback
const createProtocolReviewEvent = async ({
  protocolId,
  action,
  comment,
  reviewerId,
}) => {
  await ReviewEvent.create({
    targetType: "protocol",
    targetId: protocolId,
    action,
    comment: comment?.trim() || null,
    reviewerId,
  });
};

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

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  return Number.isNaN(numericValue) ? null : numericValue;
};

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

    if (req.user.role !== "admin") {
      const accessibleProjectIds = (
        await getAccessibleProjectIds(req.user)
      ).map(Number);

      if (projectId) {
        const requestedProjectId = Number(projectId);

        if (!accessibleProjectIds.includes(requestedProjectId)) {
          return res.status(403).json({
            status: "error",
            message: "You do not have access to protocols for this project.",
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
          },
        ];
      }
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

    if (protocol.projectId) {
      const canViewProtocolProject = await canViewProjectLinkedRecord(
        req.user,
        protocol.projectId,
      );

      if (!canViewProtocolProject) {
        return res.status(403).json({
          status: "error",
          message: "You do not have access to this protocol.",
        });
      }
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
    if (
      approvalStatus !== undefined &&
      !VALID_APPROVAL_STATUSES.includes(approvalStatus)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid approval status.",
      });
    }

    const resolvedProjectId = normalizeOptionalId(projectId);
    const resolvedEquipmentId = normalizeOptionalId(equipmentId);

    if (!resolvedProjectId && !canManageGeneralProtocol(req.user)) {
      return res.status(403).json({
        status: "error",
        message:
          "Only admins and supervisors can create general or equipment-only SOPs.",
      });
    }

    if (resolvedProjectId) {
      const canUseProject = await canUseProjectForResearchWork(
        req.user,
        resolvedProjectId,
      );

      if (!canUseProject) {
        return res.status(403).json({
          status: "error",
          message:
            "You do not have access to create protocols for this project.",
        });
      }

      const canCreateForProject = await canCreateProtocolInProject(
        req.user,
        resolvedProjectId,
      );

      if (!canCreateForProject) {
        return res.status(403).json({
          status: "error",
          message:
            "Only admins, project supervisors, project leads, and workflow-authorized project members can create project-linked protocols.",
        });
      }
    }

    if (resolvedProjectId) {
      const project = await Project.findByPk(resolvedProjectId);

      if (!project) {
        return res.status(404).json({
          status: "error",
          message: "Project not found.",
        });
      }
    }

    if (resolvedEquipmentId) {
      const equipment = await Equipment.findByPk(resolvedEquipmentId);

      if (!equipment) {
        return res.status(404).json({
          status: "error",
          message: "Equipment not found.",
        });
      }
    }

    const resolvedApprovalStatus = approvalStatus || "draft";

    // If a protocol is created as approved, store who approved it.
    // Approval decisions are restricted to admins and supervisors.
    const approvedById =
      resolvedApprovalStatus === "approved" ? req.user.id : null;

    const approvedAt =
      resolvedApprovalStatus === "approved"
        ? new Date().toISOString().slice(0, 10)
        : null;

    if (
      ["approved", "changes_requested"].includes(resolvedApprovalStatus) &&
      !isAdminOrSupervisor(req.user)
    ) {
      return res.status(403).json({
        status: "error",
        message:
          "Only admins and supervisors can create protocols with approval decisions.",
      });
    }

    if (
      resolvedApprovalStatus === "changes_requested" &&
      !reviewComment?.trim()
    ) {
      return res.status(400).json({
        status: "error",
        message: "A review comment is required when requesting changes.",
      });
    }

    const protocol = await Protocol.create({
      title: title.trim(),
      version: version?.trim() || "1.0",
      purpose: purpose?.trim() || null,
      content: content.trim(),
      approvalStatus: resolvedApprovalStatus,
      reviewComment: reviewComment?.trim() || null,
      projectId: resolvedProjectId,
      equipmentId: resolvedEquipmentId,
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

    const currentProjectId = normalizeOptionalId(protocol.projectId);
    const requestedProjectId = normalizeOptionalId(projectId);
    const requestedEquipmentId = normalizeOptionalId(equipmentId);

    if (projectId !== undefined && requestedProjectId !== currentProjectId) {
      return res.status(400).json({
        status: "error",
        message: "Protocol project cannot be changed after creation.",
      });
    }

    if (
      approvalStatus !== undefined &&
      !VALID_APPROVAL_STATUSES.includes(approvalStatus)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid approval status.",
      });
    }

    if (currentProjectId) {
      const canUseProject = await canUseProjectForResearchWork(
        req.user,
        currentProjectId,
      );

      if (!canUseProject) {
        return res.status(403).json({
          status: "error",
          message: "You do not have access to edit protocols for this project.",
        });
      }

      const canEditForProject = await canEditProtocolInProject(
        req.user,
        currentProjectId,
      );

      if (!canEditForProject) {
        return res.status(403).json({
          status: "error",
          message:
            "Only admins, project supervisors, project leads, and workflow-authorized project members can edit project-linked protocols.",
        });
      }
    } else if (!canManageGeneralProtocol(req.user)) {
      return res.status(403).json({
        status: "error",
        message:
          "Only admins and supervisors can edit general or equipment-only SOPs.",
      });
    }

    const nextApprovalStatus =
      approvalStatus !== undefined ? approvalStatus : protocol.approvalStatus;

    const previousApprovalStatus = protocol.approvalStatus;

    // Approval decisions are restricted to admins and supervisors
    const isApprovalDecision =
      approvalStatus !== undefined &&
      ["approved", "changes_requested"].includes(approvalStatus);

    if (isApprovalDecision) {
      if (!["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({
          status: "error",
          message:
            "Only admins and supervisors can make protocol approval decisions.",
        });
      }

      if (protocol.projectId) {
        const canReviewProtocolProject = await canReviewProjectLinkedRecord(
          req.user,
          protocol.projectId,
        );

        if (!canReviewProtocolProject) {
          return res.status(403).json({
            status: "error",
            message:
              "You can only review protocols for projects you are authorized to supervise.",
          });
        }
      }
    }

    const isSubmitForReview =
      approvalStatus === "pending_review" &&
      ["draft", "changes_requested"].includes(protocol.approvalStatus);

    if (approvalStatus === "pending_review" && !isSubmitForReview) {
      return res.status(400).json({
        status: "error",
        message:
          "Only draft or changes requested protocols can be submitted for review.",
      });
    }

    // Requesting changes must include review feedback.
    if (approvalStatus === "changes_requested" && !reviewComment?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "A review comment is required when requesting changes.",
      });
    }

    if (equipmentId !== undefined && requestedEquipmentId) {
      const equipment = await Equipment.findByPk(requestedEquipmentId);

      if (!equipment) {
        return res.status(404).json({
          status: "error",
          message: "Equipment not found.",
        });
      }
    }

    // When a protocol becomes approved, store approver metadata
    // When it leaves approved status, clear approval metadata
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
      reviewComment:
        reviewComment !== undefined
          ? reviewComment?.trim() || null
          : protocol.reviewComment,
      equipmentId:
        equipmentId !== undefined ? requestedEquipmentId : protocol.equipmentId,
      approvedById: nextApprovedById,
      approvedAt: nextApprovedAt,
    });

    // Automatically create review history when a protocol review decision is made
    if (
      approvalStatus !== undefined &&
      ["approved", "changes_requested"].includes(nextApprovalStatus)
    ) {
      const shouldCreateReviewEvent =
        nextApprovalStatus !== previousApprovalStatus ||
        nextApprovalStatus === "changes_requested";

      if (shouldCreateReviewEvent) {
        await createProtocolReviewEvent({
          protocolId: protocol.id,
          action: nextApprovalStatus,
          comment:
            nextApprovalStatus === "changes_requested"
              ? reviewComment
              : reviewComment || "Protocol approved.",
          reviewerId: req.user.id,
        });
      }
    }

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
