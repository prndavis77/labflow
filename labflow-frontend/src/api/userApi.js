import axiosClient from "./axiosClient";

// Fetch user summaries for assignment dropdowns
// The backend does not return password hashes or sensitive fields
export const fetchUsers = async () => {
  const response = await axiosClient.get("/users");
  return response.data;
};
