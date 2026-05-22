import axiosClient from "./axiosClient";

// Fetch protocols from the backend
// Optional filters can include projectId and approvalStatus
export const fetchProtocols = async (filters = {}) => {
  const response = await axiosClient.get("/protocols", {
    params: filters,
  });

  return response.data;
};

// Fetch one protocol by ID
// This will be useful later for a protocol detail page
export const fetchProtocolById = async (protocolId) => {
  const response = await axiosClient.get(`/protocols/${protocolId}`);
  return response.data;
};

// Create a new project-linked protocol
// The backend currently limits this to admins and supervisors
export const createProtocol = async (payload) => {
  const response = await axiosClient.post("/protocols", payload);
  return response.data;
};

// Update an existing protocol
// The backend currently limits this to admins and supervisors
export const updateProtocol = async (protocolId, payload) => {
  const response = await axiosClient.patch(`/protocols/${protocolId}`, payload);
  return response.data;
};

// Delete a protocol
// The backend currently limits this to admins and supervisors
export const deleteProtocol = async (protocolId) => {
  const response = await axiosClient.delete(`/protocols/${protocolId}`);
  return response.data;
};
