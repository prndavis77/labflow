function formatUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = formatUserResponse;
