const {
  createOrganizationStoragePrefix,
  validateStoragePrefix,
} = require("../storage/utils/storageKey");

describe("organization storage prefix", () => {
  describe("createOrganizationStoragePrefix", () => {
    it("creates the exact organization storage namespace", () => {
      expect(
        createOrganizationStoragePrefix({
          organizationId: 17,
        }),
      ).toBe("organizations/17/");
    });

    it("normalizes a numeric string organization id", () => {
      expect(
        createOrganizationStoragePrefix({
          organizationId: "42",
        }),
      ).toBe("organizations/42/");
    });

    it.each([undefined, null, "", 0, -1, 1.5, "abc"])(
      "rejects invalid organization id %p",
      (organizationId) => {
        expect(() =>
          createOrganizationStoragePrefix({
            organizationId,
          }),
        ).toThrow("Organization ID must be a positive integer.");
      },
    );
  });

  describe("validateStoragePrefix", () => {
    it("accepts a safe organization prefix", () => {
      expect(validateStoragePrefix("organizations/17/")).toBe(
        "organizations/17/",
      );
    });

    it.each([
      "",
      "/organizations/17/",
      "organizations/17",
      "organizations//17/",
      "organizations\\17\\",
      "organizations/../17/",
      "organizations/./17/",
    ])("rejects unsafe prefix %p", (prefix) => {
      expect(() => validateStoragePrefix(prefix)).toThrow();
    });
  });
});
