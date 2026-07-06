const { Op } = require("sequelize");
const { Invitation, User, Organization } = require("../models");
const {
  generateInvitationToken,
  hashInvitationToken,
  getInvitationExpiryDate,
} = require("../utils/invitationTokens");
const { writeAuditLog } = require("../utils/auditLogger");

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const getFrontendBaseUrl = () => {
  return process.env.FRONTEND_URL || "http://localhost:5173";
};

const formatInvitationResponse = (invitation) => {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    invitedById: invitation.invitedById,
    acceptedUserId: invitation.acceptedUserId,
    canCreateExperiments: invitation.canCreateExperiments,
    canEditExperiments: invitation.canEditExperiments,
    canCreateProtocols: invitation.canCreateProtocols,
    canEditProtocols: invitation.canEditProtocols,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    invitedBy: invitation.invitedBy
      ? {
          id: invitation.invitedBy.id,
          name: invitation.invitedBy.name,
          email: invitation.invitedBy.email,
          role: invitation.invitedBy.role,
        }
      : null,
    organization: invitation.organization
      ? {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
        }
      : null,
  };
};

const listInvitations = async (req, res) => {
  const where = {
    organizationId: req.user.organizationId,
  };

  if (req.query.status) {
    where.status = req.query.status;
  }

  const invitations = await Invitation.findAll({
    where,
    include: [
      {
        model: User,
        as: "invitedBy",
        attributes: ["id", "name", "email", "role"],
      },
      {
        model: User,
        as: "acceptedUser",
        attributes: ["id", "name", "email", "role"],
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "slug"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return res.status(200).json({
    status: "success",
    data: {
      invitations: invitations.map(formatInvitationResponse),
    },
  });
};

const createInvitation = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const name = String(req.body.name || "").trim();
  const role = req.body.role || "researcher";

  const allowedRoles = ["admin", "supervisor", "researcher"];

  if (!name) {
    return res.status(400).json({
      status: "error",
      message: "Name is required.",
    });
  }

  if (!email) {
    return res.status(400).json({
      status: "error",
      message: "Email is required.",
    });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid role.",
    });
  }

  const existingUser = await User.findOne({
    where: {
      email,
      organizationId: req.user.organizationId,
    },
  });

  if (existingUser) {
    return res.status(409).json({
      status: "error",
      message: "A user with this email already exists in this organization.",
    });
  }

  const existingPendingInvitation = await Invitation.findOne({
    where: {
      email,
      organizationId: req.user.organizationId,
      status: "pending",
      expiresAt: {
        [Op.gt]: new Date(),
      },
    },
  });

  if (existingPendingInvitation) {
    return res.status(409).json({
      status: "error",
      message: "A pending invitation already exists for this email.",
    });
  }

  const rawToken = generateInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = getInvitationExpiryDate();

  const isResearcher = role === "researcher";

  const invitation = await Invitation.create({
    organizationId: req.user.organizationId,
    email,
    name,
    role,
    tokenHash,
    status: "pending",
    expiresAt,
    invitedById: req.user.id,
    canCreateExperiments: isResearcher
      ? Boolean(req.body.canCreateExperiments)
      : false,
    canEditExperiments: isResearcher
      ? Boolean(req.body.canEditExperiments)
      : false,
    canCreateProtocols: isResearcher
      ? Boolean(req.body.canCreateProtocols)
      : false,
    canEditProtocols: isResearcher ? Boolean(req.body.canEditProtocols) : false,
  });

  await writeAuditLog({
    req,
    action: "invitation.created",
    entityType: "invitation",
    entityId: invitation.id,
    summary: `Created invitation for ${email}.`,
    metadata: {
      email,
      role,
      expiresAt,
    },
  });

  const inviteLink = `${getFrontendBaseUrl()}/accept-invite/${rawToken}`;

  return res.status(201).json({
    status: "success",
    message: "Invitation created.",
    data: {
      invitation: formatInvitationResponse(invitation),
      inviteLink,
    },
  });
};

const revokeInvitation = async (req, res) => {
  const invitation = await Invitation.findOne({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
    },
  });

  if (!invitation) {
    return res.status(404).json({
      status: "error",
      message: "Invitation not found.",
    });
  }

  if (invitation.status !== "pending") {
    return res.status(400).json({
      status: "error",
      message: "Only pending invitations can be revoked.",
    });
  }

  invitation.status = "revoked";
  await invitation.save();

  await writeAuditLog({
    req,
    action: "invitation.revoked",
    entityType: "invitation",
    entityId: invitation.id,
    summary: `Revoked invitation for ${invitation.email}.`,
    metadata: {
      email: invitation.email,
      role: invitation.role,
    },
  });

  return res.status(200).json({
    status: "success",
    message: "Invitation revoked.",
    data: {
      invitation: formatInvitationResponse(invitation),
    },
  });
};

module.exports = {
  listInvitations,
  createInvitation,
  revokeInvitation,
};
