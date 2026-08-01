const FormData = require("form-data");
const Mailgun = require("mailgun.js");

const createMailgunEmailProvider = ({
  apiKey,
  domain,
  apiBaseUrl,
  fromName,
  fromAddress,
}) => {
  const mailgun = new Mailgun(FormData);

  const clientOptions = {
    username: "api",
    key: apiKey,
  };

  /*
   * Mailgun's US endpoint is the SDK default.
   * Set the URL explicitly only for the EU endpoint.
   */
  if (apiBaseUrl === "https://api.eu.mailgun.net") {
    clientOptions.url = apiBaseUrl;
  }

  const client = mailgun.client(clientOptions);

  const formattedSender = fromName
    ? `${fromName} <${fromAddress}>`
    : fromAddress;

  return {
    provider: "mailgun",

    async sendMessage({ to, subject, text, html, tags = [] }) {
      const messageData = {
        from: formattedSender,
        to: [to],
        subject,
      };

      if (text) {
        messageData.text = text;
      }

      if (html) {
        messageData.html = html;
      }

      if (tags.length > 0) {
        messageData["o:tag"] = tags;
      }

      const result = await client.messages.create(domain, messageData);

      return {
        provider: "mailgun",
        accepted: true,
        skipped: false,
        messageId: result.id || null,
      };
    },
  };
};

module.exports = {
  createMailgunEmailProvider,
};
