const { Op } = require("sequelize");

const { Organization } = require("../models");

const MAX_SLUG_LENGTH = 80;

const createBaseOrganizationSlug = (organizationName) => {
  const normalizedName = String(organizationName || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = normalizedName
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "organization";
};

const createUniqueOrganizationSlug = async (
  organizationName,
  transaction,
) => {
  const baseSlug = createBaseOrganizationSlug(organizationName);

  const existingOrganizations = await Organization.findAll({
    attributes: ["slug"],
    where: {
      slug: {
        [Op.or]: [
          baseSlug,
          {
            [Op.like]: `${baseSlug}-%`,
          },
        ],
      },
    },
    transaction,
  });

  const existingSlugs = new Set(
    existingOrganizations.map((organization) => organization.slug),
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  const suffixText = `-${suffix}`;
  const availableBaseLength = MAX_SLUG_LENGTH - suffixText.length;

  const shortenedBase = baseSlug
    .slice(0, availableBaseLength)
    .replace(/-+$/g, "");

  return `${shortenedBase}${suffixText}`;
};

module.exports = {
  createBaseOrganizationSlug,
  createUniqueOrganizationSlug,
};