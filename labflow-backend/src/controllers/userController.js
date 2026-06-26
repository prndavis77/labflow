const { User } = require("../models");
const bcrypt = require("bcrypt");
const formatUserResponse = require("../utils/formatUserResponse");
const { VALID_ROLES, ROLES } = require("../constants/roles");

const WORKFLOW_PERMISSION_FIELDS = [
  "canCreateExperiments",
  "canEditExperiments",
  "canCreateProtocols",
  "canEditProtocols",
];

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
        "canCreateExperiments",
        "canEditExperiments",
        "canCreateProtocols",
        "canEditProtocols",
        "createdAt",
        "updatedAt",
        "isActive",
        "deactivatedAt",
        "deactivatedById",
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
        "canCreateExperiments",
        "canEditExperiments",
        "canCreateProtocols",
        "canEditProtocols",
        "createdAt",
        "updatedAt",
        "isActive",
        "deactivatedAt",
        "deactivatedById",
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

// PATCH /api/users/:id/permissions
// Allows admins to update researcher workflow permissions.
// These permissions mainly affect researcher users.
// Admins and supervisors have full workflow access by role.
const updateUserWorkflowPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    const userToUpdate = await User.findByPk(id);

    if (!userToUpdate) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    // Workflow permission toggles are intended for researchers.
    // Admins and supervisors already have full access through their role.
    if (userToUpdate.role !== ROLES.RESEARCHER) {
      return res.status(400).json({
        status: "error",
        message:
          "Workflow permissions can only be customized for researcher accounts.",
      });
    }

    const updates = {};

    for (const field of WORKFLOW_PERMISSION_FIELDS) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "boolean") {
          return res.status(400).json({
            status: "error",
            message: `${field} must be a boolean value.`,
          });
        }

        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one workflow permission field is required.",
      });
    }

    await userToUpdate.update(updates);

    return res.json({
      status: "success",
      message: "User workflow permissions updated successfully.",
      data: {
        user: formatUserResponse(userToUpdate),
      },
    });
  } catch (error) {
    console.error("Update user workflow permissions error:", error);

    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating user workflow permissions.",
    });
  }
};

const updateUserAccountStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value.",
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await user.update({
      isActive,
      deactivatedAt: isActive ? null : new Date(),
      deactivatedById: isActive ? null : req.user.id,
    });

    return res.json({
      success: true,
      message: isActive
        ? "User account reactivated."
        : "User account deactivated.",
      data: {
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    console.error("Update user account status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user account status.",
    });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot reset your own password from this page.",
      });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        success: false,
        message: "New password is required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await user.update({ passwordHash });

    return res.json({
      success: true,
      message: "User password reset successfully.",
      data: {
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    console.error("Reset user password error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset user password.",
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUserRole,
  updateUserWorkflowPermissions,
  updateUserAccountStatus,
  resetUserPassword,
};
