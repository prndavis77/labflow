const { User } = require("../models");
const { VALID_ROLES, ROLES } = require("../constants/roles");

// Formats user records before sending them to the frontend
// This prevents sensitive fields like passwordHash from being exposed
const formatUserResponse = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// GET /api/users
// Returns all users who can potentially be assigned to tasks
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "department",
        "createdAt",
        "updatedAt",
      ],
      order: [
        ["role", "ASC"],
        ["name", "ASC"],
      ],
    });

    return res.json({
      status: "success",
      data: {
        users: users.map(formatUserResponse),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching users.",
    });
  }
};

// GET /api/users/:id
// Returns one user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "department",
        "createdAt",
        "updatedAt",
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
    console.error("Get user by ID error:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the user.",
    });
  }
};

// PATCH /api/users/:id/role
// Allows admins to change another user's role
// This is intentionally role-specific instead of a generic user update endpoint
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.body.role;

    if (!role) {
      return res.status(400).json({
        status: "error",
        message: "Role is required.",
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid role. Role must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    const userToUpdate = await User.findByPk(id);

    if (!userToUpdate) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    // Prevent an admin from demoting their own account
    if (
      Number(req.user.id) === Number(userToUpdate.id) &&
      userToUpdate.role === ROLES.ADMIN &&
      role !== ROLES.ADMIN
    ) {
      return res.status(400).json({
        status: "error",
        message: "You cannot remove your own admin privileges.",
      });
    }

    await userToUpdate.update({ role });

    return res.json({
      status: "success",
      message: "User role updated successfully.",
      data: {
        user: formatUserResponse(userToUpdate),
      },
    });
  } catch (error) {
    console.error("Update user role error:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating the user's role.",
    });
  }
};

module.exports = { getUsers, getUserById, updateUserRole };
