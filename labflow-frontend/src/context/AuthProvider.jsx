import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import { getCurrentUser, loginUser, registerUser } from "../api/authApi";

export const AuthProvider = ({ children }) => {
  // Keep token in state so React reacts consistently when login/logout changes it
  const [token, setToken] = useState(() => {
    return localStorage.getItem("labflow_token");
  });

  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      try {
        if (!token) {
          setUser(null);
          return;
        }

        const result = await getCurrentUser();

        if (isMounted) {
          setUser(result.data.user);
        }
      } catch (error) {
        console.error("Failed to load current user:", error);
        localStorage.removeItem("labflow_token");

        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    loadCurrentUser();
  }, [token]);

  const login = async (credentials) => {
    const result = await loginUser(credentials);

    localStorage.setItem("labflow_token", result.data.token);

    setToken(result.data.token);
    setUser(result.data.user);

    return result.data.user;
  };

  const register = async (payload) => {
    const result = await registerUser(payload);

    localStorage.setItem("labflow_token", result.data.token);

    setToken(result.data.token);
    setUser(result.data.user);

    return result.data.user;
  };

  const logout = () => {
    localStorage.removeItem("labflow_token");

    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      isAuthLoading,
      login,
      register,
      logout,
    }),
    [user, token, isAuthLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
