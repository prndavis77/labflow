const { sendEmail } = require("./emailService");

const {
  buildEmailVerificationEmail,
} = require("../email/templates/emailVerificationEmail");

const sendEmailVerificationEmail = async ({
  to,
  userName,
  organizationName,
  verificationLink,
  expiresAt,
  locale = "en-US",
  timeZone = "UTC",
}) => {
  const { subject, text, html } = buildEmailVerificationEmail({
    userName,
    organizationName,
    verificationLink,
    expiresAt,
    locale,
    timeZone,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
    tags: ["labflow", "email-verification"],
  });
};

module.exports = {
  sendEmailVerificationEmail,
};
