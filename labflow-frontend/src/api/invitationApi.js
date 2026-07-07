import axiosClient from "./axiosClient";

export const getInvitations = async (params = {}) => {
  const response = await axiosClient.get("/invitations", { params });
  return response.data;
};

export const createInvitation = async (payload) => {
  const response = await axiosClient.post("/invitations", payload);
  return response.data;
};

export const revokeInvitation = async (id) => {
  const response = await axiosClient.patch(`/invitations/${id}/revoke`);
  return response.data;
};

export const getInvitationForAcceptance = async (token) => {
  const response = await axiosClient.get(`/invitations/accept/${token}`);
  return response.data;
};

export const acceptInvitation = async (token, payload) => {
  const response = await axiosClient.post(
    `/invitations/accept/${token}`,
    payload,
  );
  return response.data;
};
