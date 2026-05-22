const { User } = require("../models");

// Formats user records before sending them to the frontend
// This prevents sensitive fields like passwordHash from being exposed
const formatUserResponse = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
  };
};

// GET /api/users
// Returns all users who can potentially be assigned to tasks
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role", "department"],
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

module.exports = { getUsers };
