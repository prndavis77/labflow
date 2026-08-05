import { useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";

import { AuthContext } from "./AuthContext";
import { getCurrentUser, loginUser, registerUser } from "../api/authApi";
import {
  SESSION_INVALIDATED_EVENT,
  SESSION_INVALIDATED_NOTICE_KEY,
} from "../api/axiosClient";

export const AuthProvider = ({ children }) => {
  // Keep token in state so React reacts consistently when login/logout changes it
  const [token, setToken] = useState(() => {
    return localStorage.getItem("labflow_token");
  });

  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const handleSessionInvalidated = () => {
      localStorage.removeItem("labflow_token");

      setToken(null);
      setUser(null);
      setIsAuthLoading(false);
    };

    window.addEventListener(
      SESSION_INVALIDATED_EVENT,
      handleSessionInvalidated,
    );

    return () => {
      window.removeEventListener(
        SESSION_INVALIDATED_EVENT,
        handleSessionInvalidated,
      );
    };
  }, []);

  useEffect(() => {
    const sessionNotice = sessionStorage.getItem(
      SESSION_INVALIDATED_NOTICE_KEY,
    );

    if (!sessionNotice) {
      return;
    }

    sessionStorage.removeItem(SESSION_INVALIDATED_NOTICE_KEY);

    message.warning(sessionNotice);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      try {
        if (!token) {
          if (isMounted) {
            setUser(null);
          }

          return;
        }

        const result = await getCurrentUser();

        if (isMounted) {
          setUser(result.data.user);
        }
      } catch (error) {
        const isSessionInvalidated =
          error.response?.status === 401 &&
          error.response?.data?.code === "SESSION_INVALIDATED";

        if (!isSessionInvalidated) {
          console.error("Failed to load current user:", error);

          localStorage.removeItem("labflow_token");

          if (isMounted) {
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = useCallback(async (credentials) => {
    const result = await loginUser(credentials);

    localStorage.setItem("labflow_token", result.data.token);

    setToken(result.data.token);
    setUser(result.data.user);

    return result.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await registerUser(payload);

    localStorage.setItem("labflow_token", result.data.token);

    setToken(result.data.token);
    setUser(result.data.user);

    return {
      user: result.data.user,
      emailVerification: result.data.emailVerification || null,
    };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("labflow_token");

    setToken(null);
    setUser(null);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return null;
    }

    const result = await getCurrentUser();
    const currentUser = result.data.user;

    setUser(currentUser);

    return currentUser;
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      isAuthLoading,
      login,
      register,
      logout,
      refreshCurrentUser,
    }),
    [user, token, isAuthLoading, login, register, logout, refreshCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
