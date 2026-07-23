const bcrypt = require("bcrypt");

const { User, Organization } = require("../models");
const generateToken = require("../utils/generateToken");
const formatUserResponse = require("../utils/formatUserResponse");
const { createUniqueOrganizationSlug } = require("../utils/organizationSlug");

const SALT_ROUNDS = 12;

const ORGANIZATION_TYPES = ["lab", "department", "institution", "company"];

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const normalizeRequiredText = (value) => {
  return String(value || "").trim();
};

const registerUser = async (req, res) => {
  let transaction;

  try {
    const name = normalizeRequiredText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const department = normalizeRequiredText(req.body.department) || null;

    const organizationName = normalizeRequiredText(req.body.organizationName);

    const organizationType =
      normalizeRequiredText(req.body.organizationType) || "lab";

    if (!name || !email || !password || !organizationName) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, password, and organization name are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long.",
      });
    }

    if (!ORGANIZATION_TYPES.includes(organizationType)) {
      return res.status(400).json({
        status: "error",
        message: `Organization type must be one of: ${ORGANIZATION_TYPES.join(
          ", ",
        )}.`,
      });
    }

    transaction = await User.sequelize.transaction();

    const existingUser = await User.findOne({
      where: {
        email,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();

      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists.",
      });
    }

    const organizationSlug = await createUniqueOrganizationSlug(
      organizationName,
      transaction,
    );

    const organization = await Organization.create(
      {
        name: organizationName,
        slug: organizationSlug,
        type: organizationType,
        isActive: true,
      },
      {
        transaction,
      },
    );

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create(
      {
        name,
        email,
        passwordHash,
        role: "admin",
        department,
        organizationId: organization.id,
        isActive: true,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    const createdUser = await User.findByPk(user.id, {
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "slug", "type"],
        },
      ],
    });

    const token = generateToken(createdUser);

    return res.status(201).json({
      status: "success",
      message: "Organization and administrator account created successfully.",
      data: {
        user: formatUserResponse(createdUser),
        token,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Error registering organization ", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while creating the organization account.",
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
