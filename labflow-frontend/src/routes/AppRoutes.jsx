import { Routes, Route, Navigate } from "react-router";
import DashboardPage from "../pages/DashboardPage";
import ProjectsPage from "../pages/ProjectsPage";
import ExperimentsPage from "../pages/ExperimentsPage";
import TasksPage from "../pages/TasksPage";
import EquipmentPage from "../pages/EquipmentPage";
import EquipmentDetailPage from "../pages/EquipmentDetailPage";
import ProtocolsPage from "../pages/ProtocolsPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ProjectDetailPage from "../pages/ProjectDetailPage";
import ExperimentDetailPage from "../pages/ExperimentDetailPage";
import ProtocolDetailPage from "../pages/ProtocolDetailPage";
import TaskDetailPage from "../pages/TaskDetailPage";
import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";
import NotFoundPage from "../pages/NotFoundPage";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <ProjectDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/experiments"
        element={
          <ProtectedRoute>
            <ExperimentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/experiments/:id"
        element={
          <ProtectedRoute>
            <ExperimentDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <TasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <ProtectedRoute>
            <TaskDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipment"
        element={
          <ProtectedRoute>
            <EquipmentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipment/:id"
        element={
          <ProtectedRoute>
            <EquipmentDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/protocols"
        element={
          <ProtectedRoute>
            <ProtocolsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/protocols/:id"
        element={
          <ProtectedRoute>
            <ProtocolDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <NotFoundPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
