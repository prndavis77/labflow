import axiosClient from "./axiosClient";

// Fetch tasks from the backend
// Optional filters can include projectId and status
export const fetchTasks = async (filters = {}) => {
  const response = await axiosClient.get("/tasks", {
    params: filters,
  });

  return response.data;
};

// Fetch one task by ID
// This will be useful later for a task detail page
export const fetchTaskById = async (taskId) => {
  const response = await axiosClient.get(`/tasks/${taskId}`);
  return response.data;
};

// Create a new project-linked task
export const createTask = async (payload) => {
  const response = await axiosClient.post("/tasks", payload);
  return response.data;
};

// Update an existing task
export const updateTask = async (taskId, payload) => {
  const response = await axiosClient.patch(`tasks/${taskId}`, payload);
  return response.data;
};

// Delete a task
export const deleteTask = async (taskId) => {
  const response = await axiosClient.delete(`/tasks/${taskId}`);
  return response.data;
};
