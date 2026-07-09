const { Organization } = require("../models");
const { writeAuditLog } = require("../utils/auditLogger");

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
    console.error("Error getting organization", error);

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

    const name = req.body.name ? String(req.body.name).trim() : "";
    const type = req.body.type ? String(req.body.type).trim() : null;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Organization name is required.",
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
    console.error("Error updating organization", error);

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
