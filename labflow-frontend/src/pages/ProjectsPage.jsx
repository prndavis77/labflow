import {
  Alert,
  Button,
  Card,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { archiveProject, fetchProjects } from "../api/projectApi";
import { fetchUsers } from "../api/userApi";
import { useAuth } from "../context/useAuth";
import { PROJECT_STATUS_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";
import ProjectFormModal from "../components/projects/ProjectFormModal";

const { Title, Paragraph } = Typography;

const ProjectsPage = () => {
  const { user: currentUser } = useAuth();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Admins and supervisors can manage projects
  // Researchers can view projects but cannot create, edit, or delete them
  const canManageProjects = ["admin", "supervisor"].includes(currentUser?.role);

  // Loads all projects from the backend and stores them in component state.
  const loadProjects = useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      setErrorMessage("");

      const result = await fetchProjects();

      setProjects(result.data.projects);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load projects.";

      setErrorMessage(message);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Loads users so admins/supervisors can assign project supervisors
  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);

      const result = await fetchUsers();

      setUsers(result.data.users);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load users.";

      message.error(messageText);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Load projects when the page first renders.
  useEffect(() => {
    queueMicrotask(() => {
      loadProjects();
      loadUsers();
    });
  }, [loadProjects, loadUsers]);

  const openCreateModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  // Opens the modal in edit mode and fills the form with the selected project's data.
  const openEditModal = useCallback((project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleProjectSaved = async () => {
    closeModal();
    await loadProjects();
  };

  const handleArchive = useCallback(
    async (projectId) => {
      try {
        await archiveProject(projectId);

        message.success("Project archived successfully.");

        await loadProjects();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to archive project.";

        message.error(messageText);
      }
    },
    [loadProjects],
  );

  // Table columns are memoized so they are not recreated unnecessarily on every render
  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: "Project",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <Link to={`/projects/${record.id}`}>
              <strong>{title}</strong>
            </Link>
            {record.description && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.description}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status) => (
          <Tag color={PROJECT_STATUS_COLORS[status]}>{formatLabel(status)}</Tag>
        ),
      },
      {
        title: "Supervisor",
        dataIndex: "supervisor",
        key: "supervisor",
        width: 220,
        render: (supervisor) =>
          supervisor ? (
            <span>
              {supervisor.name} ({formatLabel(supervisor.role)})
            </span>
          ) : (
            "Not assigned"
          ),
      },
      {
        title: "Start Date",
        dataIndex: "startDate",
        key: "startDate",
        width: 130,
        render: (value) => value || "Not set",
      },
      {
        title: "Target End",
        dataIndex: "targetEndDate",
        key: "targetEndDate",
        width: 130,
        render: (value) => value || "Not set",
      },
    ];

    return [
      ...baseColumns,
      {
        title: "Actions",
        key: "actions",
        width: canManageProjects ? 220 : 90,
        render: (_, record) => (
          <Space>
            <Link to={`/projects/${record.id}`}>
              <Button size="small">View</Button>
            </Link>

            {canManageProjects && (
              <>
                <Button size="small" onClick={() => openEditModal(record)}>
                  Edit
                </Button>

                <Popconfirm
                  title="Archive project?"
                  description="This will hide the project from normal project lists. Linked tasks, experiments, protocols, bookings, and notebook entries will remain in the database."
                  okText="Archive"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleArchive(record.id)}
                >
                  <Button size="small" danger>
                    Archive
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        ),
      },
    ];
  }, [canManageProjects, handleArchive, openEditModal]);

  return (
    <>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              Projects
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Manage research projects, supervisors, timelines, and project
              status.
            </Paragraph>
          </div>

          {canManageProjects && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              New Project
            </Button>
          )}
        </div>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={isLoadingProjects}
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
          }}
        />
      </Card>

      <ProjectFormModal
        open={isModalOpen}
        project={editingProject}
        users={users}
        isLoadingUsers={isLoadingUsers}
        onCancel={closeModal}
        onSuccess={handleProjectSaved}
      />
    </>
  );
};

export default ProjectsPage;
