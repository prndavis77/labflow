const { emailConfig } = require("../config/emailConfig");

const { createEmailProvider } = require("../email/createEmailProvider");

let emailProviderInstance;

const getEmailProvider = () => {
  if (!emailProviderInstance) {
    emailProviderInstance = createEmailProvider(emailConfig);
  }

  return emailProviderInstance;
};

const validateMessage = ({ to, subject, text, html }) => {
  if (typeof to !== "string" || !to.trim()) {
    throw new Error("Email recipient is required.");
  }

  if (typeof subject !== "string" || !subject.trim()) {
    throw new Error("Email subject is required.");
  }

  if (!text && !html) {
    throw new Error("Email text or HTML content is required.");
  }
};

const sendEmail = async ({ to, subject, text, html, tags = [] }) => {
  validateMessage({
    to,
    subject,
    text,
    html,
  });

  const provider = getEmailProvider();

  return provider.sendMessage({
    to: to.trim(),
    subject: subject.trim(),
    text,
    html,
    tags,
  });
};

/*
 * These hooks allow unit and integration tests to use
 * a controlled provider without making external requests.
 */
const setEmailProviderForTests = (emailProvider) => {
  emailProviderInstance = emailProvider;
};

const resetEmailProviderForTests = () => {
  emailProviderInstance = undefined;
};

module.exports = {
  getEmailProvider,
  sendEmail,
  setEmailProviderForTests,
  resetEmailProviderForTests,
};
