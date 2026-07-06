const crypto = require("crypto");

const generateInvitationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashInvitationToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const getInvitationExpiryDate = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
};

module.exports = {
  generateInvitationToken,
  hashInvitationToken,
  getInvitationExpiryDate,
};
