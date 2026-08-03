const { sendEmail } = require("./emailService");

const {
  buildPasswordResetEmail,
} = require("../email/templates/passwordResetEmail");

const sendPasswordResetEmail = async ({
  to,
  userName,
  organizationName,
  resetLink,
  expiresAt,
  locale = "en-US",
  timeZone = "UTC",
}) => {
  const { subject, text, html } = buildPasswordResetEmail({
    userName,
    organizationName,
    resetLink,
    expiresAt,
    locale,
    timeZone,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
    tags: ["labflow", "password-reset"],
  });
};

module.exports = {
  sendPasswordResetEmail,
};
