const {
  buildInvitationEmail,
  escapeHtml,
  formatExpirationDate,
  formatRoleLabel,
} = require("../email/templates/invitationEmail");

describe("Invitation email template", () => {
  const validTemplateData = {
    inviteeName: "Maria Schmidt",
    organizationName: "Analytical Chemistry Lab",
    inviterName: "Admin User",
    role: "researcher",
    inviteLink: "https://labflow.example.com/accept-invite/test-token",
    expiresAt: "2026-08-08T12:00:00.000Z",
    locale: "en-US",
    timeZone: "UTC",
  };

  it("builds the invitation subject", () => {
    const result = buildInvitationEmail(validTemplateData);

    expect(result.subject).toBe(
      "You have been invited to join " +
        "Analytical Chemistry Lab " +
        "on LabFlow",
    );
  });

  it("builds a plain-text invitation", () => {
    const result = buildInvitationEmail(validTemplateData);

    expect(result.text).toContain("Hello Maria Schmidt,");

    expect(result.text).toContain(
      "Admin User has invited you to join " +
        "Analytical Chemistry Lab on " +
        "LabFlow as a Researcher.",
    );

    expect(result.text).toContain(validTemplateData.inviteLink);

    expect(result.text).toContain("This invitation expires on");
  });

  it("builds an HTML invitation", () => {
    const result = buildInvitationEmail(validTemplateData);

    expect(result.html).toContain("Accept invitation");

    expect(result.html).toContain(validTemplateData.inviteLink);

    expect(result.html).toContain("Analytical Chemistry Lab");

    expect(result.html).toContain("Researcher");
  });

  it("escapes user-controlled HTML values", () => {
    const result = buildInvitationEmail({
      ...validTemplateData,

      inviteeName: '<script>alert("invitee")</script>',

      organizationName: "<Lab & Research>",

      inviterName: 'Admin "Owner"',
    });

    expect(result.html).not.toContain("<script>");

    expect(result.html).toContain("&lt;script&gt;");

    expect(result.html).toContain("&lt;Lab &amp; Research&gt;");

    expect(result.html).toContain("Admin &quot;Owner&quot;");
  });

  it("escapes the invitation URL in HTML", () => {
    const result = buildInvitationEmail({
      ...validTemplateData,
      inviteLink: "https://example.com/accept?token=abc&source=email",
    });

    expect(result.html).toContain("token=abc&amp;source=email");

    expect(result.text).toContain("token=abc&source=email");
  });

  it("formats known role labels", () => {
    expect(formatRoleLabel("admin")).toBe("Administrator");

    expect(formatRoleLabel("supervisor")).toBe("Supervisor");

    expect(formatRoleLabel("researcher")).toBe("Researcher");
  });

  it("formats unknown role labels safely", () => {
    expect(formatRoleLabel("lab_manager")).toBe("Lab Manager");
  });

  it("formats the expiration date", () => {
    const result = formatExpirationDate("2026-08-08T12:00:00.000Z", {
      locale: "en-US",
      timeZone: "UTC",
    });

    expect(result).toContain("August 8, 2026");

    expect(result).toContain("UTC");
  });

  it("requires the invitee name", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        inviteeName: "",
      }),
    ).toThrow("Invitee name is required.");
  });

  it("requires the organization name", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        organizationName: "",
      }),
    ).toThrow("Organization name is required.");
  });

  it("requires the inviter name", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        inviterName: "",
      }),
    ).toThrow("Inviter name is required.");
  });

  it("requires the role", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        role: "",
      }),
    ).toThrow("Invitation role is required.");
  });

  it("requires an invitation link", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        inviteLink: "",
      }),
    ).toThrow("Invitation link is required.");
  });

  it("rejects an invalid invitation URL", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        inviteLink: "not-a-url",
      }),
    ).toThrow("Invitation link must be a valid URL.");
  });

  it("rejects unsafe URL protocols", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        inviteLink: "javascript:alert(1)",
      }),
    ).toThrow("Invitation link must use HTTP or HTTPS.");
  });

  it("rejects an invalid expiration date", () => {
    expect(() =>
      buildInvitationEmail({
        ...validTemplateData,
        expiresAt: "invalid-date",
      }),
    ).toThrow("Invitation expiration date is invalid.");
  });

  it("escapes HTML independently", () => {
    expect(escapeHtml(`<div class="test">Tom & Jerry's</div>`)).toBe(
      "&lt;div class=&quot;test&quot;&gt;" +
        "Tom &amp; Jerry&#039;s&lt;/div&gt;",
    );
  });
});
