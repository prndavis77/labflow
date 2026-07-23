const { createBaseOrganizationSlug } = require("../utils/organizationSlug");

describe("Organization slug utility", () => {
  it("converts an organization name into a slug", () => {
    expect(createBaseOrganizationSlug("Analytical Chemistry Laboratory")).toBe(
      "analytical-chemistry-laboratory",
    );
  });

  it("removes accents and punctuation", () => {
    expect(
      createBaseOrganizationSlug("Universität für Analytische Chemie!"),
    ).toBe("universitat-fur-analytische-chemie");
  });

  it("collapses repeated separators", () => {
    expect(
      createBaseOrganizationSlug("Chemistry --- Research ___ Laboratory"),
    ).toBe("chemistry-research-laboratory");
  });

  it("removes leading and trailing separators", () => {
    expect(createBaseOrganizationSlug(" --- Chemistry Laboratory --- ")).toBe(
      "chemistry-laboratory",
    );
  });

  it("uses a fallback when no usable characters remain", () => {
    expect(createBaseOrganizationSlug("!!!")).toBe("organization");
  });
});
