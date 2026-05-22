import axiosClient from "./axiosClient";

// Fetch equipment from the backend.
// Optional filters can include status
export const fetchEquipment = async (filters = {}) => {
  const response = await axiosClient.get("/equipment", {
    params: filters,
  });

  return response.data;
};

// Fetch one equipment item by ID
export const fetchEquipmentById = async (equipmentId) => {
  const response = await axiosClient.get(`/equipment/${equipmentId}`);
  return response.data;
};

// Create a new lab equipment item
// The backend currently limits this to admins and supervisors
export const createEquipment = async (payload) => {
  const response = await axiosClient.post("/equipment", payload);
  return response.data;
};

// Update an equipment item
// The backend currently limits this to admins and supervisors
export const updateEquipment = async (equipmentId, payload) => {
  const response = await axiosClient.patch(
    `/equipment/${equipmentId}`,
    payload,
  );
  return response.data;
};

// Delete an equipment item
// The backend currently limits this to admins and supervisors
export const deleteEquipment = async (equipmentId) => {
  const response = await axiosClient.delete(`/equipment/${equipmentId}`);
  return response.data;
};
