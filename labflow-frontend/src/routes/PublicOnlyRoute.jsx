import { Navigate } from "react-router";
import { Spin } from "antd";
import { useAuth } from "../context/AuthContext";

// PublicOnlyRoute prevents logged-in users from seeing login/register pages
const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PublicOnlyRoute;
