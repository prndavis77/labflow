"use strict";

const {
  Attachment,
  AuditLog,
  EmailVerificationToken,
  Equipment,
  EquipmentBooking,
  Experiment,
  Invitation,
  NotebookEntry,
  Organization,
  PasswordResetToken,
  Project,
  ProjectMember,
  Protocol,
  ReviewEvent,
  Task,
  User,
} = require("../models");

const sequelize = Organization.sequelize;

class OrganizationDeletionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OrganizationDeletionError";
    this.code = code;
  }
}

const validateOrganizationId = (organizationId) => {
  const normalizedOrganizationId = Number(organizationId);

  if (
    !Number.isSafeInteger(normalizedOrganizationId) ||
    normalizedOrganizationId <= 0
  ) {
    throw new OrganizationDeletionError(
      "organizationId must be a positive integer.",
      "INVALID_ORGANIZATION_ID",
    );
  }

  return normalizedOrganizationId;
};

const buildOrganizationWhere = (organizationId) => ({
  organizationId,
});

/*
 * Returns the number of rows currently owned by the organization.
 *
 * This function is read-only. It is useful before permanent deletion so the
 * operator can see the scope of the operation and later compare the deletion
 * result against the original inventory.
 */
const getOrganizationDeletionInventory = async ({
  organizationId,
  transaction,
} = {}) => {
  const normalizedOrganizationId = validateOrganizationId(organizationId);
  const where = buildOrganizationWhere(normalizedOrganizationId);

  const organization = await Organization.findByPk(normalizedOrganizationId, {
    attributes: ["id", "name", "slug", "isActive"],
    transaction,
  });

  if (!organization) {
    throw new OrganizationDeletionError(
      "Organization was not found.",
      "ORGANIZATION_NOT_FOUND",
    );
  }

  const [
    reviewEvents,
    notebookEntries,
    equipmentBookings,
    projectMembers,
    attachments,
    invitations,
    experiments,
    tasks,
    protocols,
    equipment,
    projects,
    passwordResetTokens,
    emailVerificationTokens,
    auditLogs,
    users,
  ] = await Promise.all([
    ReviewEvent.count({ where, transaction }),
    NotebookEntry.count({ where, transaction }),
    EquipmentBooking.count({ where, transaction }),
    ProjectMember.count({ where, transaction }),
    Attachment.count({ where, transaction }),
    Invitation.count({ where, transaction }),
    Experiment.count({ where, transaction }),
    Task.count({ where, transaction }),
    Protocol.count({ where, transaction }),
    Equipment.count({ where, transaction }),
    Project.count({ where, transaction }),
    PasswordResetToken.count({ where, transaction }),
    EmailVerificationToken.count({ where, transaction }),
    AuditLog.count({ where, transaction }),
    User.count({ where, transaction }),
  ]);

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      isActive: organization.isActive,
    },

    counts: {
      reviewEvents,
      notebookEntries,
      equipmentBookings,
      projectMembers,
      attachments,
      invitations,
      experiments,
      tasks,
      protocols,
      equipment,
      projects,
      passwordResetTokens,
      emailVerificationTokens,
      auditLogs,
      users,
    },
  };
};

/*
 * Permanently removes one organization's relational data.
 *
 * IMPORTANT:
 * This function does NOT delete Cloudflare R2 objects.
 *
 * If attachment rows exist, the caller must first complete the attachment
 * storage deletion/reconciliation phase and then explicitly pass
 * attachmentStorageDeletionConfirmed: true.
 *
 * The explicit confirmation prevents this service from deleting the only
 * database records that contain the attachment storage keys before R2 cleanup
 * has been completed.
 */
const deleteOrganizationDatabaseData = async ({
  organizationId,
  attachmentStorageDeletionConfirmed = false,
} = {}) => {
  const normalizedOrganizationId = validateOrganizationId(organizationId);

  return sequelize.transaction(async (transaction) => {
    /*
     * Lock the organization row for the duration of the destructive database
     * operation. The later offboarding orchestration layer will additionally
     * freeze application access before this service is called.
     */
    const organization = await Organization.findByPk(normalizedOrganizationId, {
      attributes: ["id", "name", "slug", "isActive"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!organization) {
      throw new OrganizationDeletionError(
        "Organization was not found.",
        "ORGANIZATION_NOT_FOUND",
      );
    }

    const organizationWhere = buildOrganizationWhere(normalizedOrganizationId);

    const attachmentCount = await Attachment.count({
      where: organizationWhere,
      transaction,
    });

    if (attachmentCount > 0 && !attachmentStorageDeletionConfirmed) {
      throw new OrganizationDeletionError(
        "Attachment storage deletion must be confirmed before attachment metadata can be permanently deleted.",
        "ATTACHMENT_STORAGE_DELETION_NOT_CONFIRMED",
      );
    }

    const deleted = {};

    /*
     * Explicit child-first deletion is intentional.
     *
     * Do not replace this with broad database cascading. The production schema
     * deliberately contains RESTRICT, NO ACTION, SET NULL, and CASCADE
     * relationships.
     */

    deleted.reviewEvents = await ReviewEvent.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.notebookEntries = await NotebookEntry.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.equipmentBookings = await EquipmentBooking.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.projectMembers = await ProjectMember.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.attachments = await Attachment.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.invitations = await Invitation.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.experiments = await Experiment.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.tasks = await Task.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.protocols = await Protocol.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.equipment = await Equipment.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.projects = await Project.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.passwordResetTokens = await PasswordResetToken.destroy({
      where: organizationWhere,
      transaction,
    });

    deleted.emailVerificationTokens = await EmailVerificationToken.destroy({
      where: organizationWhere,
      transaction,
    });

    /*
     * Audit logs belong to the tenant and therefore cannot remain attached to
     * an organization that is about to be deleted.
     *
     * Any minimal operational deletion evidence that must survive offboarding
     * must be copied to an independent record before this service is called.
     */
    deleted.auditLogs = await AuditLog.destroy({
      where: organizationWhere,
      transaction,
    });

    /*
     * Users are deliberately late in the sequence because multiple workflow
     * tables contain required user foreign keys with RESTRICT or NO ACTION
     * behavior.
     */
    deleted.users = await User.destroy({
      where: organizationWhere,
      transaction,
    });

    const deletedOrganizations = await Organization.destroy({
      where: {
        id: normalizedOrganizationId,
      },
      transaction,
    });

    if (deletedOrganizations !== 1) {
      throw new OrganizationDeletionError(
        "Organization deletion did not delete exactly one organization row.",
        "ORGANIZATION_DELETE_COUNT_MISMATCH",
      );
    }

    deleted.organizations = deletedOrganizations;

    return {
      organizationId: normalizedOrganizationId,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      deleted,
    };
  });
};

module.exports = {
  OrganizationDeletionError,
  deleteOrganizationDatabaseData,
  getOrganizationDeletionInventory,
  validateOrganizationId,
};
