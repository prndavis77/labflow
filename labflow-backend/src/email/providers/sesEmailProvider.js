const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");

const createSesEmailProvider = ({
  region,
  accessKeyId,
  secretAccessKey,
  fromName,
  fromAddress,
}) => {
  const client = new SESv2Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const formattedSender = fromName
    ? `${fromName} <${fromAddress}>`
    : fromAddress;

  return {
    provider: "ses",

    async sendMessage({ to, subject, text, html, tags = [] }) {
      const body = {};

      if (text) {
        body.Text = {
          Data: text,
          Charset: "UTF-8",
        };
      }

      if (html) {
        body.Html = {
          Data: html,
          Charset: "UTF-8",
        };
      }

      const input = {
        FromEmailAddress: formattedSender,

        Destination: {
          ToAddresses: [to],
        },

        Content: {
          Simple: {
            Subject: {
              Data: subject,
              Charset: "UTF-8",
            },
            Body: body,
          },
        },
      };

      if (tags.length > 0) {
        input.EmailTags = tags.map((tag, index) => ({
          Name: `tag${index + 1}`,
          Value: String(tag),
        }));
      }

      const result = await client.send(new SendEmailCommand(input));

      return {
        provider: "ses",
        accepted: true,
        skipped: false,
        messageId: result.MessageId || null,
      };
    },
  };
};

module.exports = {
  createSesEmailProvider,
};
