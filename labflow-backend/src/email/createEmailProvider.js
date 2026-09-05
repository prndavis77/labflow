const {
  createDisabledEmailProvider,
} = require("./providers/disabledEmailProvider");
const {
  createMailgunEmailProvider,
} = require("./providers/mailgunEmailProvider");
const { createSesEmailProvider } = require("./providers/sesEmailProvider");

const createEmailProvider = (config) => {
  switch (config.provider) {
    case "disabled":
      return createDisabledEmailProvider();

    case "mailgun":
      return createMailgunEmailProvider({
        apiKey: config.mailgun.apiKey,
        domain: config.mailgun.domain,
        apiBaseUrl: config.mailgun.apiBaseUrl,
        fromName: config.fromName,
        fromAddress: config.fromAddress,
      });

    case "ses":
      return createSesEmailProvider({
        region: config.ses.region,
        accessKeyId: config.ses.accessKeyId,
        secretAccessKey: config.ses.secretAccessKey,
        fromName: config.fromName,
        fromAddress: config.fromAddress,
      });

    default:
      throw new Error(`Unsupported email provider: ${config.provider}`);
  }
};

module.exports = {
  createEmailProvider,
};
