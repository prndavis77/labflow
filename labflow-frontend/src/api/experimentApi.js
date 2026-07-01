import axiosClient from "./axiosClient";

// Fetch experiments from the backend
// Optional filters can include projectId, status, reviewStatus, and researcherId
export const fetchExperiments = async (filters = {}) => {
  const response = await axiosClient.get("/experiments", {
    params: filters,
  });

  return response.data;
};

// Fetch one experiment by ID
// This will be useful later for a detail page
export const fetchExperimentById = async (experimentId) => {
  const response = await axiosClient.get(`/experiments/${experimentId}`);
  return response.data;
};

// Create a new project-linked experiment.
export const createExperiment = async (payload) => {
  const response = await axiosClient.post("/experiments", payload);
  return response.data;
};

// Update an existing experiment
export const updateExperiment = async (experimentId, payload) => {
  const response = await axiosClient.patch(
    `/experiments/${experimentId}`,
    payload,
  );
  return response.data;
};

// Archive an experiment
export const archiveExperiment = async (experimentId) => {
  const response = await axiosClient.delete(`/experiments/${experimentId}`);
  return response.data;
};
