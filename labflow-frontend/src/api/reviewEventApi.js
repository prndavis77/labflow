import axiosClient from "./axiosClient";

// Fetch review history events
// Filters can include targetType, targetId, action, and reviewerId
export const fetchReviewEvents = async (filters = {}) => {
  const response = await axiosClient.get("/review-events", {
    params: filters,
  });

  return response.data;
};

// Fetch one review event by ID
// This is not needed immediately, but keeps the API module complete
export const fetchReviewEventById = async (reviewEventId) => {
  const response = await axiosClient.get(`/review-events/${reviewEventId}`);

  return response.data;
};
