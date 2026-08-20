const parseTrustProxy = ({
  nodeEnv = process.env.NODE_ENV,
  value = process.env.TRUST_PROXY,
} = {}) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return nodeEnv === "production" ? 1 : false;
  }

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  if (/^[1-9]\d*$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  throw new Error("TRUST_PROXY must be true, false, or a positive integer.");
};

module.exports = {
  parseTrustProxy,
};
