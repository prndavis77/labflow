const { Organization } = require("../models");
const { writeAuditLog } = require("../utils/auditLogger");
const { logError } = require("../utils/errorLogger");

const formatOrganizationResponse = (organization) => {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    type: organization.type,
    isActive: organization.isActive,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
};

const VALID_ORGANIZATION_TYPES = [
  "lab",
  "department",
  "institution",
  "company",
  "demo",
];

const getCurrentOrganization = async (req, res) => {
  try {
    const organization = await Organization.findByPk(req.user.organizationId);

    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        organization: formatOrganizationResponse(organization),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "organization_load_failed",
      message: "Failed to load organization",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while loading the organization.",
    });
  }
};

const updateCurrentOrganization = async (req, res) => {
  try {
    const organization = await Organization.findByPk(req.user.organizationId);

    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found.",
      });
    }

    const { name: rawName, type: rawType } = req.body;

    if (
      rawName !== undefined &&
      rawName !== null &&
      typeof rawName !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Organization name must be a string.",
      });
    }

    if (
      rawType !== undefined &&
      rawType !== null &&
      typeof rawType !== "string"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Organization type must be a string.",
      });
    }

    const name = rawName?.trim() || "";
    const type = rawType?.trim() || null;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Organization name is required.",
      });
    }

    if (name.length > 150) {
      return res.status(400).json({
        status: "error",
        message: "Organization name must be 150 characters or fewer.",
      });
    }

    if (!type) {
      return res.status(400).json({
        status: "error",
        message: "Organization type is required.",
      });
    }

    if (!VALID_ORGANIZATION_TYPES.includes(type)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid organization type.",
      });
    }

    const previousValues = {
      name: organization.name,
      type: organization.type,
    };

    organization.name = name;
    organization.type = type;

    await organization.save();

    await writeAuditLog({
      req,
      action: "organization.updated",
      entityType: "organization",
      entityId: organization.id,
      summary: `Updated organization settings for ${organization.name}.`,
      metadata: {
        previousValues,
        newValues: {
          name: organization.name,
          type: organization.type,
        },
      },
    });

    return res.json({
      status: "success",
      data: {
        organization: formatOrganizationResponse(organization),
      },
    });
  } catch (error) {
    logError(error, {
      req,
      event: "organization_update_failed",
      message: "Failed to update organization",
    });

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the organization.",
    });
  }
};

module.exports = {
  getCurrentOrganization,
  updateCurrentOrganization,
};
