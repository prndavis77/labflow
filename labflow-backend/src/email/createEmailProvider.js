const {
  createDisabledEmailProvider,
} = require("./providers/disabledEmailProvider");

const {
  createMailgunEmailProvider,
} = require("./providers/mailgunEmailProvider");

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

    default:
      throw new Error(`Unsupported email provider: ${config.provider}`);
  }
};

module.exports = {
  createEmailProvider,
};
