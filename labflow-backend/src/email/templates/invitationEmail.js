const DEFAULT_LOCALE = "en-US";

const ROLE_LABELS = Object.freeze({
  admin: "Administrator",
  supervisor: "Supervisor",
  researcher: "Researcher",
});

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeRequiredText = (value, fieldName) => {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalizedValue;
};

const normalizeInviteLink = (value) => {
  const inviteLink = normalizeRequiredText(value, "Invitation link");

  let parsedUrl;

  try {
    parsedUrl = new URL(inviteLink);
  } catch {
    throw new Error("Invitation link must be a valid URL.");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("Invitation link must use HTTP or HTTPS.");
  }

  return parsedUrl.toString();
};

const formatRoleLabel = (role) => {
  const normalizedRole = normalizeRequiredText(
    role,
    "Invitation role",
  ).toLowerCase();

  return (
    ROLE_LABELS[normalizedRole] ||
    normalizedRole
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
};

const formatExpirationDate = (
  expiresAt,
  { locale = DEFAULT_LOCALE, timeZone = "UTC" } = {},
) => {
  const expirationDate =
    expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  if (Number.isNaN(expirationDate.getTime())) {
    throw new Error("Invitation expiration date is invalid.");
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(expirationDate);
};

const buildInvitationEmail = ({
  inviteeName,
  organizationName,
  inviterName,
  role,
  inviteLink,
  expiresAt,
  locale = DEFAULT_LOCALE,
  timeZone = "UTC",
}) => {
  const normalizedInviteeName = normalizeRequiredText(
    inviteeName,
    "Invitee name",
  );

  const normalizedOrganizationName = normalizeRequiredText(
    organizationName,
    "Organization name",
  );

  const normalizedInviterName = normalizeRequiredText(
    inviterName,
    "Inviter name",
  );

  const normalizedInviteLink = normalizeInviteLink(inviteLink);

  const roleLabel = formatRoleLabel(role);

  const formattedExpirationDate = formatExpirationDate(expiresAt, {
    locale,
    timeZone,
  });

  const subject =
    `You have been invited to join ` +
    `${normalizedOrganizationName} on LabFlow`;

  const text = [
    `Hello ${normalizedInviteeName},`,
    "",
    `${normalizedInviterName} has invited you to join ${normalizedOrganizationName} on LabFlow as a ${roleLabel}.`,
    "",
    "Accept your invitation:",
    normalizedInviteLink,
    "",
    `This invitation expires on ${formattedExpirationDate}.`,
    "",
    "If you were not expecting this invitation, you can ignore this email.",
    "",
    "LabFlow",
  ].join("\n");

  const htmlInviteeName = escapeHtml(normalizedInviteeName);

  const htmlOrganizationName = escapeHtml(normalizedOrganizationName);

  const htmlInviterName = escapeHtml(normalizedInviterName);

  const htmlRoleLabel = escapeHtml(roleLabel);

  const htmlExpirationDate = escapeHtml(formattedExpirationDate);

  const htmlInviteLink = escapeHtml(normalizedInviteLink);

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    >
    <title>${escapeHtml(subject)}</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
      color: #262626;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="
        background-color: #f5f5f5;
        padding: 24px 12px;
      "
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width: 600px;
              background-color: #ffffff;
              border: 1px solid #e8e8e8;
              border-radius: 8px;
            "
          >
            <tr>
              <td
                style="
                  padding: 28px 32px 16px;
                "
              >
                <div
                  style="
                    font-size: 24px;
                    font-weight: 700;
                    line-height: 1.3;
                    color: #1677ff;
                  "
                >
                  LabFlow
                </div>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 0 32px 32px;
                "
              >
                <h1
                  style="
                    margin: 0 0 20px;
                    font-size: 24px;
                    line-height: 1.35;
                    color: #141414;
                  "
                >
                  You have been invited
                </h1>

                <p
                  style="
                    margin: 0 0 16px;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  Hello ${htmlInviteeName},
                </p>

                <p
                  style="
                    margin: 0 0 20px;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  ${htmlInviterName} has invited you
                  to join
                  <strong>
                    ${htmlOrganizationName}
                  </strong>
                  on LabFlow as a
                  <strong>
                    ${htmlRoleLabel}
                  </strong>.
                </p>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin: 24px 0;
                  "
                >
                  <tr>
                    <td
                      bgcolor="#1677ff"
                      style="
                        border-radius: 6px;
                      "
                    >
                      <a
                        href="${htmlInviteLink}"
                        style="
                          display: inline-block;
                          padding: 12px 22px;
                          color: #ffffff;
                          text-decoration: none;
                          font-size: 16px;
                          font-weight: 600;
                          line-height: 1.4;
                        "
                      >
                        Accept invitation
                      </a>
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    margin: 0 0 16px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #595959;
                  "
                >
                  This invitation expires on
                  <strong>
                    ${htmlExpirationDate}
                  </strong>.
                </p>

                <p
                  style="
                    margin: 0 0 8px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #595959;
                  "
                >
                  If the button does not work, copy
                  and paste this link into your
                  browser:
                </p>

                <p
                  style="
                    margin: 0 0 24px;
                    font-size: 13px;
                    line-height: 1.6;
                    word-break: break-all;
                  "
                >
                  <a
                    href="${htmlInviteLink}"
                    style="
                      color: #1677ff;
                    "
                  >
                    ${htmlInviteLink}
                  </a>
                </p>

                <p
                  style="
                    margin: 0;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #8c8c8c;
                  "
                >
                  If you were not expecting this
                  invitation, you can ignore this
                  email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  return {
    subject,
    text,
    html,
  };
};

module.exports = {
  ROLE_LABELS,
  buildInvitationEmail,
  escapeHtml,
  formatExpirationDate,
  formatRoleLabel,
};
