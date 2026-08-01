const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const { Invitation, User, Organization } = require("../models");
const {
  generateInvitationToken,
  hashInvitationToken,
  getInvitationExpiryDate,
} = require("../utils/invitationTokens");
const { writeAuditLog } = require("../utils/auditLogger");
const { sendInvitationEmail } = require("../services/invitationEmailService");
const { emailConfig } = require("../config/emailConfig");
const {
  INVITATION_EMAIL_DELIVERY_STATUSES,
} = require("../constants/invitationEmail");
const { AUDIT_ACTIONS } = require("../constants/auditActions");

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const getFrontendBaseUrl = () => {
  return process.env.FRONTEND_URL || "http://localhost:5173";
};

const shouldIncludeInviteLink = () => {
  return process.env.NODE_ENV !== "production";
};

const getEmailDeliveryMessage = ({ accepted, skipped }) => {
  if (accepted) {
    return "Invitation created and email sent.";
  }

  if (skipped) {
    return "Invitation created. Email delivery is disabled.";
  }

  return "Invitation created, but the email could not be sent.";
};

const getResendEmailDeliveryMessage = ({ accepted, skipped }) => {
  if (accepted) {
    return "Invitation resent and email sent.";
  }

  if (skipped) {
    return "Invitation renewed. Email delivery is disabled.";
  }

  return "Invitation renewed, but the email could not be sent.";
};

const formatInvitationResponse = (invitation) => {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    name: invitation.name,
    department: invitation.department,
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

    emailDeliveryStatus: invitation.emailDeliveryStatus,

    emailProvider: invitation.emailProvider,

    emailLastAttemptedAt: invitation.emailLastAttemptedAt,

    emailSentAt: invitation.emailSentAt,
    organization: invitation.organization
      ? {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
        }
      : null,
  };
};

const formatAcceptInvitationResponse = (invitation) => {
  return {
    id: invitation.id,
    email: invitation.email,
    name: invitation.name,
    department: invitation.department,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    organization: invitation.organization
      ? {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
        }
      : null,
  };
};

const findPendingInvitationByToken = async (token) => {
  const tokenHash = hashInvitationToken(token);

  return Invitation.findOne({
    where: {
      tokenHash,
      status: "pending",
    },
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "slug", "isActive"],
      },
    ],
  });
};

const isInvitationExpired = (invitation) => {
  return new Date(invitation.expiresAt).getTime() < Date.now();
};

const buildInvitationEmailTracking = ({
  emailDelivery,
  attemptedAt = new Date(),
}) => {
  const accepted = Boolean(emailDelivery?.accepted);

  const skipped = Boolean(emailDelivery?.skipped);

  let emailDeliveryStatus = INVITATION_EMAIL_DELIVERY_STATUSES.FAILED;

  if (accepted) {
    emailDeliveryStatus = INVITATION_EMAIL_DELIVERY_STATUSES.SENT;
  } else if (skipped) {
    emailDeliveryStatus = INVITATION_EMAIL_DELIVERY_STATUSES.SKIPPED;
  }

  return {
    emailDeliveryStatus,

    emailProvider: emailDelivery?.provider || emailConfig.provider || null,

    emailProviderMessageId: accepted ? emailDelivery?.messageId || null : null,

    emailLastAttemptedAt: attemptedAt,

    emailSentAt: accepted ? attemptedAt : null,
  };
};

const persistInvitationEmailTracking = async ({
  invitation,
  emailDelivery,
  attemptedAt,
}) => {
  const trackingValues = buildInvitationEmailTracking({
    emailDelivery,
    attemptedAt,
  });

  try {
    await invitation.update(trackingValues);

    return {
      persisted: true,
      trackingValues,
    };
  } catch (error) {
    return {
      persisted: false,
      trackingValues,
    };
  }
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

  const department = req.body.department
    ? String(req.body.department).trim()
    : null;

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
    },
  });

  if (existingUser) {
    return res.status(409).json({
      status: "error",
      message: "An account with this email already exists.",
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

  const organization = await Organization.findOne({
    where: {
      id: req.user.organizationId,
      isActive: true,
    },
    attributes: ["id", "name", "slug"],
  });

  if (!organization) {
    return res.status(404).json({
      status: "error",
      message: "Organization not found or inactive.",
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
    department,
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

  const inviteLink = `${getFrontendBaseUrl()}` + `/accept-invite/${rawToken}`;

  const emailAttemptedAt = new Date();

  let emailDelivery;

  try {
    emailDelivery = await sendInvitationEmail({
      to: invitation.email,
      inviteeName: invitation.name,
      organizationName: organization.name,
      inviterName: req.user.name || req.user.email || "A LabFlow administrator",
      role: invitation.role,
      inviteLink,
      expiresAt: invitation.expiresAt,
    });
  } catch {
    emailDelivery = {
      provider: emailConfig.provider || null,
      accepted: false,
      skipped: false,
      messageId: null,
    };
  }

  const emailTracking = await persistInvitationEmailTracking({
    invitation,
    emailDelivery,
    attemptedAt: emailAttemptedAt,
  });

  const responseData = {
    invitation: formatInvitationResponse(invitation),

    emailDelivery: {
      provider: emailDelivery.provider,

      accepted: Boolean(emailDelivery.accepted),

      skipped: Boolean(emailDelivery.skipped),
    },
  };

  if (shouldIncludeInviteLink()) {
    responseData.inviteLink = inviteLink;
  }

  return res.status(201).json({
    status: "success",

    message: getEmailDeliveryMessage(emailDelivery),

    data: responseData,
  });
};

const resendInvitation = async (req, res) => {
  const invitationId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(invitationId)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid invitation ID.",
    });
  }

  let invitation;
  let organization;
  let rawToken;
  let expiresAt;

  const transaction = await sequelize.transaction();

  try {
    invitation = await Invitation.findOne({
      where: {
        id: invitationId,
        organizationId: req.user.organizationId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!invitation) {
      await transaction.rollback();

      return res.status(404).json({
        status: "error",
        message: "Invitation not found.",
      });
    }

    if (invitation.status !== "pending" && invitation.status !== "expired") {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message: "Only pending or expired invitations can be resent.",
      });
    }

    const existingUser = await User.findOne({
      where: {
        email: invitation.email,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();

      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists.",
      });
    }

    organization = await Organization.findOne({
      where: {
        id: req.user.organizationId,
        isActive: true,
      },
      attributes: ["id", "name", "slug"],
      transaction,
    });

    if (!organization) {
      await transaction.rollback();

      return res.status(404).json({
        status: "error",
        message: "Organization not found or inactive.",
      });
    }

    rawToken = generateInvitationToken();

    const tokenHash = hashInvitationToken(rawToken);

    expiresAt = getInvitationExpiryDate();

    await invitation.update(
      {
        tokenHash,
        status: "pending",
        expiresAt,
        acceptedAt: null,
        acceptedUserId: null,

        emailDeliveryStatus: INVITATION_EMAIL_DELIVERY_STATUSES.NOT_ATTEMPTED,

        emailProvider: null,
        emailProviderMessageId: null,
        emailLastAttemptedAt: null,
        emailSentAt: null,
      },
      {
        transaction,
      },
    );

    await writeAuditLog({
      req,
      action: AUDIT_ACTIONS.INVITATION_RESENT,
      entityType: "invitation",
      entityId: invitation.id,

      summary: `Renewed invitation for ` + `${invitation.email}.`,

      metadata: {
        email: invitation.email,
        role: invitation.role,
        expiresAt,
      },

      transaction,
    });

    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Error renewing invitation", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while renewing the invitation.",
    });
  }

  const inviteLink = `${getFrontendBaseUrl()}` + `/accept-invite/${rawToken}`;

  const emailAttemptedAt = new Date();

  let emailDelivery;

  try {
    emailDelivery = await sendInvitationEmail({
      to: invitation.email,
      inviteeName: invitation.name,
      organizationName: organization.name,

      inviterName: req.user.name || req.user.email || "A LabFlow administrator",

      role: invitation.role,
      inviteLink,
      expiresAt: invitation.expiresAt,
    });
  } catch {
    emailDelivery = {
      provider: emailConfig.provider || null,
      accepted: false,
      skipped: false,
      messageId: null,
    };
  }

  await persistInvitationEmailTracking({
    invitation,
    emailDelivery,
    attemptedAt: emailAttemptedAt,
  });

  const responseData = {
    invitation: formatInvitationResponse(invitation),

    emailDelivery: {
      provider: emailDelivery.provider,

      accepted: Boolean(emailDelivery.accepted),

      skipped: Boolean(emailDelivery.skipped),
    },
  };

  if (shouldIncludeInviteLink()) {
    responseData.inviteLink = inviteLink;
  }

  return res.status(200).json({
    status: "success",

    message: getResendEmailDeliveryMessage(emailDelivery),

    data: responseData,
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

const getInvitationForAcceptance = async (req, res) => {
  const token = req.params.token;

  if (!token) {
    return res.status(400).json({
      status: "error",
      message: "Invitation token is required.",
    });
  }

  const invitation = await findPendingInvitationByToken(token);

  if (!invitation) {
    return res.status(404).json({
      status: "error",
      message: "Invitation not found or no longer valid.",
    });
  }

  if (isInvitationExpired(invitation)) {
    invitation.status = "expired";
    await invitation.save();

    return res.status(410).json({
      status: "error",
      message: "Invitation has expired.",
    });
  }

  if (!invitation.organization || invitation.organization.isActive === false) {
    return res.status(400).json({
      status: "error",
      message: "Invitation organization is not active.",
    });
  }

  return res.status(200).json({
    status: "success",
    data: {
      invitation: formatAcceptInvitationResponse(invitation),
    },
  });
};

const acceptInvitation = async (req, res) => {
  const token = req.params.token;
  const password = String(req.body.password || "");

  let transaction;

  try {
    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "Invitation token is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long.",
      });
    }

    const invitation = await findPendingInvitationByToken(token);

    if (!invitation) {
      return res.status(404).json({
        status: "error",
        message: "Invitation not found or no longer valid.",
      });
    }

    if (isInvitationExpired(invitation)) {
      invitation.status = "expired";
      await invitation.save();

      return res.status(410).json({
        status: "error",
        message: "Invitation has expired.",
      });
    }

    if (
      !invitation.organization ||
      invitation.organization.isActive === false
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invitation organization is not active.",
      });
    }

    const existingUser = await User.findOne({
      where: {
        email: invitation.email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    transaction = await User.sequelize.transaction();

    const user = await User.create(
      {
        name: invitation.name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        department: invitation.department || null,
        organizationId: invitation.organizationId,
        isActive: true,
        canCreateExperiments:
          invitation.role === "researcher"
            ? invitation.canCreateExperiments
            : true,
        canEditExperiments:
          invitation.role === "researcher"
            ? invitation.canEditExperiments
            : true,
        canCreateProtocols:
          invitation.role === "researcher"
            ? invitation.canCreateProtocols
            : true,
        canEditProtocols:
          invitation.role === "researcher" ? invitation.canEditProtocols : true,
      },
      { transaction },
    );

    await invitation.update(
      {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedUserId: user.id,
      },
      { transaction },
    );

    await transaction.commit();

    await writeAuditLog({
      actorUserId: invitation.invitedById,
      organizationId: invitation.organizationId,
      action: "invitation.accepted",
      entityType: "invitation",
      entityId: invitation.id,
      targetUserId: user.id,
      summary: `Invitation accepted by ${invitation.email}.`,
      metadata: {
        email: invitation.email,
        role: invitation.role,
        acceptedUserId: user.id,
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Invitation accepted. You can now log in.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        },
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Error accepting invitation", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while accepting the invitation.",
    });
  }
};

module.exports = {
  listInvitations,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  getInvitationForAcceptance,
  acceptInvitation,
  shouldIncludeInviteLink,
  getEmailDeliveryMessage,
  getResendEmailDeliveryMessage,
  buildInvitationEmailTracking,
  persistInvitationEmailTracking,
};
