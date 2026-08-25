"use strict";

const { Transaction } = require("sequelize");

const {
  Attachment,
  AuditLog,
  Equipment,
  EquipmentBooking,
  Experiment,
  Invitation,
  NotebookEntry,
  Organization,
  Project,
  ProjectMember,
  Protocol,
  ReviewEvent,
  Task,
  User,
} = require("../models");

const {
  ORGANIZATION_DATA_EXPORT_VERSION,
  ORGANIZATION_EXPORT_ATTRIBUTES,
} = require("../config/organizationDataExportPolicy");

const sequelize = Organization.sequelize;

class OrganizationDataExportError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OrganizationDataExportError";
    this.code = code;
  }
}

const validateOrganizationId = (organizationId) => {
  const normalizedOrganizationId = Number(organizationId);

  if (
    !Number.isSafeInteger(normalizedOrganizationId) ||
    normalizedOrganizationId <= 0
  ) {
    throw new OrganizationDataExportError(
      "organizationId must be a positive integer.",
      "INVALID_ORGANIZATION_ID",
    );
  }

  return normalizedOrganizationId;
};

/*
 * Model mapping is explicit so adding a Sequelize model does not
 * automatically make it exportable.
 */
const EXPORT_DATASETS = Object.freeze([
  {
    key: "users",
    model: User,
  },
  {
    key: "projects",
    model: Project,
  },
  {
    key: "projectMembers",
    model: ProjectMember,
  },
  {
    key: "tasks",
    model: Task,
  },
  {
    key: "experiments",
    model: Experiment,
  },
  {
    key: "protocols",
    model: Protocol,
  },
  {
    key: "equipment",
    model: Equipment,
  },
  {
    key: "equipmentBookings",
    model: EquipmentBooking,
  },
  {
    key: "notebookEntries",
    model: NotebookEntry,
  },
  {
    key: "reviewEvents",
    model: ReviewEvent,
  },
  {
    key: "invitations",
    model: Invitation,
  },
  {
    key: "auditLogs",
    model: AuditLog,
  },
  {
    key: "attachments",
    model: Attachment,
  },
]);

const buildOrganizationWhere = (organizationId) => ({
  organizationId,
});

const fetchDataset = async ({ model, key, organizationId, transaction }) => {
  const attributes = ORGANIZATION_EXPORT_ATTRIBUTES[key];

  if (!attributes) {
    throw new OrganizationDataExportError(
      `No export attribute policy exists for dataset "${key}".`,
      "EXPORT_POLICY_MISSING",
    );
  }

  return model.findAll({
    attributes,
    where: buildOrganizationWhere(organizationId),
    order: [["id", "ASC"]],
    transaction,
    raw: true,
  });
};

/*
 * Creates a consistent, organization-scoped snapshot of customer data stored
 * in PostgreSQL.
 *
 * This service intentionally:
 * - does not write files;
 * - does not create ZIP archives;
 * - does not access Cloudflare R2;
 * - does not export password/reset/verification security material;
 * - does not serialize full Sequelize model instances.
 *
 * Attachment binaries are handled by the later storage-export phase.
 */
const exportOrganizationDatabaseData = async ({ organizationId } = {}) => {
  const normalizedOrganizationId = validateOrganizationId(organizationId);

  return sequelize.transaction(
    {
      isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
    },
    async (transaction) => {
      const organization = await Organization.findByPk(
        normalizedOrganizationId,
        {
          attributes: ORGANIZATION_EXPORT_ATTRIBUTES.organization,
          transaction,
          raw: true,
        },
      );

      if (!organization) {
        throw new OrganizationDataExportError(
          "Organization was not found.",
          "ORGANIZATION_NOT_FOUND",
        );
      }

      const datasetResults = await Promise.all(
        EXPORT_DATASETS.map(async ({ key, model }) => {
          const rows = await fetchDataset({
            model,
            key,
            organizationId: normalizedOrganizationId,
            transaction,
          });

          return [key, rows];
        }),
      );

      const data = Object.fromEntries(datasetResults);

      const recordCounts = Object.fromEntries(
        datasetResults.map(([key, rows]) => [key, rows.length]),
      );

      return {
        exportVersion: ORGANIZATION_DATA_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        organizationId: normalizedOrganizationId,
        organization,
        recordCounts,
        data,
      };
    },
  );
};

module.exports = {
  EXPORT_DATASETS,
  OrganizationDataExportError,
  exportOrganizationDatabaseData,
  validateOrganizationId,
};
