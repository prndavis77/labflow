import axios from "axios";

export const SESSION_INVALIDATED_EVENT = "labflow:session-invalidated";

export const SESSION_INVALIDATED_NOTICE_KEY =
  "labflow_session_invalidated_notice";

const SESSION_INVALIDATED_CODE = "SESSION_INVALIDATED";

const SESSION_INVALIDATED_MESSAGE =
  "Your session is no longer valid. Please log in again.";

const PUBLIC_AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password/",
  "/verify-email/",
  "/accept-invite/",
];

let isHandlingInvalidatedSession = false;

const isPublicAuthPath = (pathname) => {
  return PUBLIC_AUTH_PATHS.some((path) => {
    if (path.endsWith("/")) {
      return pathname.startsWith(path);
    }

    return pathname === path;
  });
};

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("labflow_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    const isSessionInvalidated =
      status === 401 && code === SESSION_INVALIDATED_CODE;

    if (!isSessionInvalidated || isHandlingInvalidatedSession) {
      return Promise.reject(error);
    }

    isHandlingInvalidatedSession = true;

    localStorage.removeItem("labflow_token");

    sessionStorage.setItem(
      SESSION_INVALIDATED_NOTICE_KEY,
      error.response?.data?.message || SESSION_INVALIDATED_MESSAGE,
    );

    window.dispatchEvent(new CustomEvent(SESSION_INVALIDATED_EVENT));

    if (!isPublicAuthPath(window.location.pathname)) {
      window.location.replace("/login");
    } else {
      isHandlingInvalidatedSession = false;
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
