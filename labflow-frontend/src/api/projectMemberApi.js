import axiosClient from "./axiosClient";

// Fetches project memberships
// Filters can include projectId, userId, and projectRole
export const fetchProjectMembers = async (filters = {}) => {
  const response = await axiosClient.get("/project-members", {
    params: filters,
  });

  return response.data;
};

// Fetches one project membership by ID
export const fetchprojectMemberById = async (projectMemberId) => {
  const response = await axiosClient.get(`/project-members/${projectMemberId}`);

  return response.data;
};

// Adds a user to a project
export const createProjectMember = async (payload) => {
  const response = await axiosClient.post("/project-members", payload);

  return response.data;
};

// Updates a project member's project-specific role
export const updateProjectMember = async (projectMemberId, payload) => {
  const response = await axiosClient.patch(
    `/project-members/${projectMemberId}`,
    payload,
  );

  return response.data;
};

// Removes a user from a project
export const deleteProjectMember = async (projectMemberId) => {
  const response = await axiosClient.delete(
    `project-members/${projectMemberId}`,
  );

  return response.data;
};
