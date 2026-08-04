import axiosClient from "./axiosClient";

export const registerUser = async (payload) => {
  const response = await axiosClient.post("/auth/register", payload);
  return response.data;
};

export const loginUser = async (payload) => {
  const response = await axiosClient.post("/auth/login", payload);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await axiosClient.get("/auth/me");
  return response.data;
};

export const requestPasswordReset = async (email) => {
  const response = await axiosClient.post("/auth/forgot-password", {
    email,
  });

  return response.data;
};

export const getPasswordResetStatus = async (token) => {
  const response = await axiosClient.get(
    `/auth/password-reset/${encodeURIComponent(token)}`,
  );

  return response.data;
};

export const completePasswordReset = async ({
  token,
  password,
  passwordConfirmation,
}) => {
  const response = await axiosClient.post(
    `/auth/password-reset/${encodeURIComponent(token)}`,
    {
      password,
      passwordConfirmation,
    },
  );

  return response.data;
};
