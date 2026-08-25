const {
  ORGANIZATION_DATA_EXPORT_VERSION,
  ORGANIZATION_EXPORT_ATTRIBUTES,
  ORGANIZATION_EXPORT_EXCLUDED_MODELS,
} = require("../config/organizationDataExportPolicy");

describe("organizationDataExportPolicy", () => {
  it("uses the expected export format version", () => {
    expect(ORGANIZATION_DATA_EXPORT_VERSION).toBe(1);
  });

  it("explicitly excludes authentication token models", () => {
    expect(ORGANIZATION_EXPORT_EXCLUDED_MODELS).toEqual([
      "PasswordResetToken",
      "EmailVerificationToken",
    ]);
  });

  it("does not export password or session security fields", () => {
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.users).not.toContain("passwordHash");
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.users).not.toContain("tokenVersion");
  });

  it("does not export invitation token or provider internals", () => {
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.invitations).not.toContain(
      "tokenHash",
    );
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.invitations).not.toContain(
      "emailProvider",
    );
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.invitations).not.toContain(
      "emailProviderMessageId",
    );
  });

  it("does not export attachment storage internals", () => {
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.attachments).not.toContain(
      "storageProvider",
    );
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.attachments).not.toContain(
      "storageKey",
    );
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.attachments).not.toContain("etag");
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.attachments).not.toContain(
      "uploadExpiresAt",
    );
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.attachments).not.toContain(
      "fileName",
    );
  });

  it("does not export raw audit telemetry or schemaless metadata", () => {
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.auditLogs).not.toContain("metadata");
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.auditLogs).not.toContain("ipAddress");
    expect(ORGANIZATION_EXPORT_ATTRIBUTES.auditLogs).not.toContain("userAgent");
  });
});
