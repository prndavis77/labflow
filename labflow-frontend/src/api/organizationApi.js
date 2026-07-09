import axiosClient from "./axiosClient";

export const getOrganization = async () => {
  const response = await axiosClient.get("/organization");
  return response.data;
};

export const updateOrganization = async (payload) => {
  const response = await axiosClient.patch("/organization", payload);
  return response.data;
};
