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
export const updateUserRole = async (userId, newRole) => {
  const response = await axiosClient.patch(`/users/${userId}/role`, {
    role: newRole,
  });

  return response.data;
};

// Updates researcher workflow permissions
export const updateUserWorkflowPermissions = async (userId, permissions) => {
  const response = await axiosClient.patch(
    `/users/${userId}/permissions`,
    permissions,
  );

  return response.data;
};

export const updateUserAccountStatus = async (userId, isActive) => {
  const response = await axiosClient.patch(`/users/${userId}/status`, {
    isActive,
  });

  return response.data;
};
