const DEFAULT_LOCALE = "en-US";

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

const normalizeVerificationLink = (value) => {
  const verificationLink = normalizeRequiredText(
    value,
    "Email verification link",
  );

  let parsedUrl;

  try {
    parsedUrl = new URL(verificationLink);
  } catch {
    throw new Error("Email verification link must be a valid URL.");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("Email verification link must use HTTP or HTTPS.");
  }

  return parsedUrl.toString();
};

const formatExpirationDate = (
  expiresAt,
  { locale = DEFAULT_LOCALE, timeZone = "UTC" } = {},
) => {
  const expirationDate =
    expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  if (Number.isNaN(expirationDate.getTime())) {
    throw new Error("Email verification expiration date is invalid.");
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

const buildEmailVerificationEmail = ({
  userName,
  organizationName,
  verificationLink,
  expiresAt,
  locale = DEFAULT_LOCALE,
  timeZone = "UTC",
}) => {
  const normalizedUserName = normalizeRequiredText(userName, "User name");

  const normalizedOrganizationName = normalizeRequiredText(
    organizationName,
    "Organization name",
  );

  const normalizedVerificationLink =
    normalizeVerificationLink(verificationLink);

  const formattedExpirationDate = formatExpirationDate(expiresAt, {
    locale,
    timeZone,
  });

  const subject = "Verify your LabFlow email address";

  const text = [
    `Hello ${normalizedUserName},`,
    "",
    `Please verify the email address for your LabFlow account in ${normalizedOrganizationName}.`,
    "",
    "Verify your email address:",
    normalizedVerificationLink,
    "",
    `This link expires on ${formattedExpirationDate}.`,
    "",
    "If you did not create this LabFlow account, you can ignore this email.",
    "",
    "LabFlow",
  ].join("\n");

  const htmlUserName = escapeHtml(normalizedUserName);

  const htmlOrganizationName = escapeHtml(normalizedOrganizationName);

  const htmlVerificationLink = escapeHtml(normalizedVerificationLink);

  const htmlExpirationDate = escapeHtml(formattedExpirationDate);

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
                  Verify your email address
                </h1>

                <p
                  style="
                    margin: 0 0 16px;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  Hello ${htmlUserName},
                </p>

                <p
                  style="
                    margin: 0 0 20px;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  Please verify the email
                  address for your LabFlow
                  account in
                  <strong>
                    ${htmlOrganizationName}
                  </strong>.
                </p>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin: 0 0 24px;
                  "
                >
                  <tr>
                    <td
                      style="
                        border-radius: 6px;
                        background-color: #1677ff;
                      "
                    >
                      <a
                        href="${htmlVerificationLink}"
                        style="
                          display: inline-block;
                          padding: 12px 22px;
                          color: #ffffff;
                          font-size: 16px;
                          font-weight: 700;
                          line-height: 1.4;
                          text-decoration: none;
                        "
                      >
                        Verify Email Address
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
                  This link expires on
                  <strong>
                    ${htmlExpirationDate}
                  </strong>.
                </p>

                <p
                  style="
                    margin: 0 0 12px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #595959;
                  "
                >
                  If the button does not work,
                  copy and paste this address
                  into your browser:
                </p>

                <p
                  style="
                    margin: 0 0 20px;
                    overflow-wrap: anywhere;
                    font-size: 13px;
                    line-height: 1.6;
                  "
                >
                  <a
                    href="${htmlVerificationLink}"
                    style="
                      color: #1677ff;
                    "
                  >
                    ${htmlVerificationLink}
                  </a>
                </p>

                <p
                  style="
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #595959;
                  "
                >
                  If you did not create this
                  LabFlow account, you can
                  ignore this email.
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
  buildEmailVerificationEmail,
  formatExpirationDate,
  normalizeVerificationLink,
};
