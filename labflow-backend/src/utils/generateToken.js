const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: Number(user.tokenVersion || 0),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "24h",
      issuer: "labflow-api",
      audience: "labflow-web",
    },
  );
};

module.exports = generateToken;
