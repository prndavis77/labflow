import axiosClient from "./axiosClient";

// Fetches the main dashboard metrics and short summary lists.
export const fetchDashboardSummary = async () => {
  const response = await axiosClient.get("/dashboard/summary");

  return response.data;
};
