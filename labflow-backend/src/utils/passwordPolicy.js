const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;

const validatePassword = (value) => {
  const password = String(value || "");

  if (!password) {
    return {
      valid: false,
      message: "Password is required.",
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    };
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return {
      valid: false,
      message: `Password must not exceed ${MAX_PASSWORD_BYTES} bytes.`,
    };
  }

  return {
    valid: true,
    message: null,
  };
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  validatePassword,
};
