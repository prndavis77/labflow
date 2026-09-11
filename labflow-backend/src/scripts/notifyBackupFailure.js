require("dotenv").config({
  quiet: true,
});

const os = require("os");

const { PublishCommand, SNSClient } = require("@aws-sdk/client-sns");

const getRequiredEnvironmentValue = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const getBackupCredentials = () => ({
  accessKeyId: getRequiredEnvironmentValue("BACKUP_AWS_ACCESS_KEY_ID"),
  secretAccessKey: getRequiredEnvironmentValue("BACKUP_AWS_SECRET_ACCESS_KEY"),
});

const notifyBackupFailure = async ({ serviceName = process.argv[2] } = {}) => {
  const normalizedServiceName = String(serviceName || "").trim();

  if (!normalizedServiceName) {
    throw new Error("Failed backup service name is required.");
  }

  const region = getRequiredEnvironmentValue("BACKUP_S3_REGION");
  const topicArn = getRequiredEnvironmentValue("BACKUP_ALERT_SNS_TOPIC_ARN");

  const client = new SNSClient({
    region,
    credentials: getBackupCredentials(),
  });

  const hostname = os.hostname();

  const subject = "Labfluss production backup failure";

  const message = [
    "Labfluss production backup failure",
    "",
    `Service: ${normalizedServiceName}`,
    `Host: ${hostname}`,
    `Time: ${new Date().toISOString()}`,
    "",
    "Action:",
    `Inspect: journalctl -u ${normalizedServiceName}`,
  ].join("\n");

  await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message,
    }),
  );

  console.log(`Backup failure notification sent for ${normalizedServiceName}.`);
};

if (require.main === module) {
  notifyBackupFailure().catch((error) => {
    console.error(`Backup failure notification failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  notifyBackupFailure,
};
