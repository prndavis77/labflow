import axiosClient from "./axiosClient";

// Fetch all projects that the current user is allowed to see
export const fetchProjects = async () => {
  const response = await axiosClient.get("/projects");
  return response.data;
};

// Fetch a single project by ID
// We will use this later for the project detail page
export const fetchProjectById = async (projectId) => {
  const response = await axiosClient.get(`/projects/${projectId}`);
  return response.data;
};

// Create a new project
// Only admins and supervisors should be allowed by the backend
export const createProject = async (payload) => {
  const response = await axiosClient.post("/projects", payload);
  return response.data;
};

// Update an existing project.
// Only admins and supervisors should be allowed by the backend.
export const updateProject = async (projectId, payload) => {
  const response = await axiosClient.patch(`/projects/${projectId}`, payload);
  return response.data;
};

// Delete a project
// Only admins and supervisors should be allowed by the backend
export const deleteProject = async (projectId) => {
  const response = await axiosClient.delete(`/projects/${projectId}`);
  return response.data;
};
