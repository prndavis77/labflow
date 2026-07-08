const bcrypt = require("bcrypt");
const { User, Organization } = require("../models");
const generateToken = require("../utils/generateToken");
const formatUserResponse = require("../utils/formatUserResponse");

const SALT_ROUNDS = 12;

const registerUser = async (req, res) => {
  try {
    // Public registration should not allow users to choose admin or supervisor roles
    const { name, email, password, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const demoOrganization = await Organization.findOne({
      where: { slug: "labflow-demo" },
    });

    if (!demoOrganization) {
      return res.status(500).json({
        status: "error",
        message: "Default organization is not configured.",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "researcher",
      department: department || null,
      organizationId: demoOrganization.id,
    });

    const createdUser = await User.findByPk(user.id, {
  include: [
    {
      model: Organization,
      as: "organization",
      attributes: ["id", "name", "slug", "type"],
    },
  ],
});

    const token = generateToken(user);

    return res.status(201).json({
      status: "success",
      message: "User registered successfully.",
      data: {
        user: formatUserResponse(createdUser),
        token,
      },
    });
  } catch (error) {
    console.error("Register error", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while registering the user.",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      where: { email: normalizedEmail },
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "slug", "type"],
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    const passwordMatched = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatched) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated.",
      });
    }

    const token = generateToken(user);

    return res.json({
      status: "success",
      message: "Login successful.",
      data: {
        token,
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    console.error("Login error", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while logging in.",
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "slug", "type"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    return res.json({
      status: "success",
      data: {
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    console.error("Get current user error", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while loading the current user.",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
};
