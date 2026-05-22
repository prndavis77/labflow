import axiosClient from "./axiosClient";

// Fetch equipment bookings from the backend
// Optional filters can include equipmentId, userId, projectId, and status
export const fetchEquipmentBookings = async (filters = {}) => {
  const response = await axiosClient.get("/equipment-bookings", {
    params: filters,
  });

  return response.data;
};

// Fetch one equipment booking by ID
export const fetchEquipmentBookingById = async (bookingId) => {
  const response = await axiosClient.get(`/equipment-bookings/${bookingId}`);
  return response.data;
};

// Create a new equipment booking
export const createEquipmentBooking = async (payload) => {
  const response = await axiosClient.post("/equipment-bookings", payload);
  return response.data;
};

// Update an existing equipment booking
export const updateEquipmentBooking = async (bookingId, payload) => {
  const response = await axiosClient.patch(
    `/equipment-bookings/${bookingId}`,
    payload,
  );

  return response.data;
};

// Delete an equipment booking.
// The backend currently limits this to admins and supervisors
export const deleteEquipmentBooking = async (bookingId) => {
  const response = await axiosClient.delete(`/equipment-bookings/${bookingId}`);
  return response.data;
};
