import axiosClient from "./axiosClient";

// Fetch user summaries for assignment dropdowns
// Used for assignment dropdowns and admin user management
export const fetchUsers = async () => {
  const response = await axiosClient.get("/users");

  return response.data;
};

// Fetches one user by ID
export const fetchUserById = async (userId) => {
  const response = await axiosClient.get(`/users/${userId}`);

  return response.data;
};

// Updates a user's role
// Admin-only backend endpoint
export const updateUserRole = async (userId, newRole) => {
  const response = await axiosClient.patch(`/users/${userId}/role`, {
    role: newRole,
  });

  return response.data;
};
