const { sendEmail } = require("./emailService");

const { buildInvitationEmail } = require("../email/templates/invitationEmail");

const sendInvitationEmail = async ({
  to,
  inviteeName,
  organizationName,
  inviterName,
  role,
  inviteLink,
  expiresAt,
  locale = "en-US",
  timeZone = "UTC",
}) => {
  const { subject, text, html } = buildInvitationEmail({
    inviteeName,
    organizationName,
    inviterName,
    role,
    inviteLink,
    expiresAt,
    locale,
    timeZone,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
    tags: ["labflow", "invitation"],
  });
};

module.exports = {
  sendInvitationEmail,
};
