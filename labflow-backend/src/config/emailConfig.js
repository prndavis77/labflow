const EMAIL_PROVIDERS = Object.freeze(["disabled", "mailgun"]);

const MAILGUN_API_BASE_URLS = Object.freeze([
  "https://api.mailgun.net",
  "https://api.eu.mailgun.net",
]);

const getRequiredEnvironmentValue = (variableName) => {
  const value = String(process.env[variableName] || "").trim();

  if (!value) {
    throw new Error(
      `${variableName} is required when ` + "EMAIL_PROVIDER=mailgun.",
    );
  }

  return value;
};

const emailProvider = String(process.env.EMAIL_PROVIDER || "disabled")
  .trim()
  .toLowerCase();

if (!EMAIL_PROVIDERS.includes(emailProvider)) {
  throw new Error(`Unsupported email provider: ${emailProvider}`);
}

const fromName = String(process.env.EMAIL_FROM_NAME || "LabFlow").trim();

const fromAddress = String(
  process.env.EMAIL_FROM_ADDRESS || "no-reply@example.com",
)
  .trim()
  .toLowerCase();

const emailConfig = {
  provider: emailProvider,

  fromName,
  fromAddress,

  mailgun: {
    apiKey: null,
    domain: null,
    apiBaseUrl: null,
  },
};

if (emailProvider === "mailgun") {
  const apiBaseUrl = String(
    process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net",
  )
    .trim()
    .replace(/\/+$/, "");

  if (!MAILGUN_API_BASE_URLS.includes(apiBaseUrl)) {
    throw new Error(
      "MAILGUN_API_BASE_URL must be either " +
        "https://api.mailgun.net or " +
        "https://api.eu.mailgun.net.",
    );
  }

  emailConfig.mailgun = {
    apiKey: getRequiredEnvironmentValue("MAILGUN_API_KEY"),

    domain: getRequiredEnvironmentValue("MAILGUN_DOMAIN"),

    apiBaseUrl,
  };

  if (!fromAddress || !fromAddress.includes("@")) {
    throw new Error(
      "EMAIL_FROM_ADDRESS must be a valid " +
        "sender address when EMAIL_PROVIDER=mailgun.",
    );
  }
}

module.exports = {
  EMAIL_PROVIDERS,
  MAILGUN_API_BASE_URLS,
  emailConfig,
};
