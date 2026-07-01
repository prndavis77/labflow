import {
  Alert,
  Button,
  Card,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { archiveExperiment, fetchExperiments } from "../api/experimentApi";
import { fetchProjects } from "../api/projectApi";
import { fetchProjectMembers } from "../api/projectMemberApi";
import { fetchTasks } from "../api/taskApi";
import { fetchUsers } from "../api/userApi";
import { fetchProtocols } from "../api/protocolApi";
import { useAuth } from "../context/useAuth";
import {
  getCurrentUserProjectRole,
  canEditExperimentInProject,
} from "../utils/projectRoleAccess";
import ExperimentFormModal from "../components/experiments/ExperimentFormModal";
import { EXPERIMENT_STATUS_OPTIONS } from "../constants/statusOptions";
import { EXPERIMENT_STATUS_COLORS } from "../constants/statusColors";
import { REVIEW_STATUS_OPTIONS } from "../constants/statusOptions";
import { REVIEW_STATUS_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;

const ExperimentsPage = () => {
  const { user: currentUser } = useAuth();

  const [experiments, setExperiments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [users, setUsers] = useState([]);

  const [isLoadingExperiments, setIsLoadingExperiments] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingProtocols, setIsLoadingProtocols] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState(null);

  const [selectedProjectId, setSelectedProjectId] = useState(undefined);
  const [selectedStatus, setSelectedStatus] = useState(undefined);
  const [selectedReviewStatus, setSelectedReviewStatus] = useState(undefined);

  const [projectRoleByProjectId, setProjectRoleByProjectId] = useState({});

  const isAdminOrSupervisor = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  const canCreateExperiments =
    isAdminOrSupervisor || currentUser?.role === "researcher";

  const canEditExperiments =
    isAdminOrSupervisor || currentUser?.role === "researcher";

  // Only admins and supervisors can archive experiment records
  const canArchiveExperiments = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  // Converts projects into options for Ant Design Select components
  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  // Builds the filter object used by the experiment API
  const experimentFilters = useMemo(() => {
    const filters = {};

    if (selectedProjectId) {
      filters.projectId = selectedProjectId;
    }

    if (selectedStatus) {
      filters.status = selectedStatus;
    }

    if (selectedReviewStatus) {
      filters.reviewStatus = selectedReviewStatus;
    }

    return filters;
  }, [selectedProjectId, selectedStatus, selectedReviewStatus]);

  const loadProjectRolesForExperiments = useCallback(
    async (protocolList) => {
      if (isAdminOrSupervisor) {
        setProjectRoleByProjectId({});
        return;
      }

      const projectIds = [
        ...new Set(
          protocolList
            .map((protocolItem) => protocolItem.projectId)
            .filter(Boolean),
        ),
      ];

      if (projectIds.length === 0) {
        setProjectRoleByProjectId({});
        return;
      }

      try {
        const results = await Promise.all(
          projectIds.map(async (projectId) => {
            const result = await fetchProjectMembers({ projectId });

            const projectRole = getCurrentUserProjectRole(
              result.data.projectMembers,
              currentUser,
              projectId,
            );

            return [Number(projectId), projectRole];
          }),
        );

        setProjectRoleByProjectId(Object.fromEntries(results));
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to load project roles.";

        message.error(messageText);
      }
    },
    [currentUser, isAdminOrSupervisor],
  );

  // Loads projects for filters and the experiment form
  const loadProjects = useCallback(async () => {
    try {
      setIsLoadingProjects(true);

      const result = await fetchProjects();

      setProjects(result.data.projects);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load projects.";

      message.error(messageText);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Loads tasks so an experiment can optionally be linked to a task
  const loadTasks = useCallback(async () => {
    try {
      setIsLoadingTasks(true);

      const result = await fetchTasks();

      setTasks(result.data.tasks);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load tasks.";

      message.error(messageText);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  // Loads protocols so an experiment can optionally reference the method used
  const loadProtocols = useCallback(async () => {
    try {
      setIsLoadingProtocols(true);

      const result = await fetchProtocols();

      setProtocols(result.data.protocols);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load protocols.";

      message.error(messageText);
    } finally {
      setIsLoadingProtocols(false);
    }
  }, []);

  // Loads users so an experiment can be assigned to a researcher
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

  // Loads experiments from the backend using the current filters
  const loadExperiments = useCallback(async () => {
    try {
      setIsLoadingExperiments(true);
      setErrorMessage("");

      const result = await fetchExperiments(experimentFilters);
      const fetchedExperiments = result.data.experiments;

      setExperiments(fetchedExperiments);

      await loadProjectRolesForExperiments(fetchedExperiments);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load experiments.";

      setErrorMessage(messageText);
    } finally {
      setIsLoadingExperiments(false);
    }
  }, [experimentFilters, loadProjectRolesForExperiments]);

  const canEditExperimentRecord = useCallback(
    (record) => {
      if (!record) {
        return false;
      }

      if (isAdminOrSupervisor) {
        return true;
      }

      const projectRole = projectRoleByProjectId[Number(record.projectId)];

      return canEditExperimentInProject(currentUser, projectRole);
    },
    [currentUser, isAdminOrSupervisor, projectRoleByProjectId],
  );

  // Load supporting dropdown data after the first render
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadProjects();
      loadTasks();
      loadUsers();
      loadProtocols();
    });
  }, [loadProjects, loadTasks, loadUsers, loadProtocols]);

  // Reload experiments whenever filters change
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadExperiments();
    });
  }, [loadExperiments]);

  const openCreateModal = () => {
    setEditingExperiment(null);
    setIsModalOpen(true);
  };

  const openEditModal = useCallback((experiment) => {
    setEditingExperiment(experiment);
    setIsModalOpen(true);
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExperiment(null);
  };

  const handleExperimentSaved = async () => {
    closeModal();
    await loadExperiments();
    await loadTasks();
    await loadProtocols();
  };

  const handleArchive = useCallback(
    async (experimentId) => {
      try {
        await archiveExperiment(experimentId);

        message.success("Experiment archived successfully.");

        await loadExperiments();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to archive experiment.";

        message.error(messageText);
      }
    },
    [loadExperiments],
  );

  // Table columns are memoized because they include action callbacks
  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: "Experiment",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <Link to={`/experiments/${record.id}`}>
              <strong>{title}</strong>
            </Link>

            {record.objective && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.objective}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 240,
        render: (project) =>
          project ? (
            <Link to={`/projects/${project.id}`}>{project.title}</Link>
          ) : (
            "Not linked"
          ),
      },
      {
        title: "Researcher",
        dataIndex: "researcher",
        key: "researcher",
        width: 180,
        render: (researcher) => researcher?.name || "Not assigned",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 150,
        render: (status) => (
          <Tag color={EXPERIMENT_STATUS_COLORS[status]}>
            {formatLabel(status)}
          </Tag>
        ),
      },
      {
        title: "Review",
        dataIndex: "reviewStatus",
        key: "reviewStatus",
        width: 160,
        render: (reviewStatus) => (
          <Tag color={REVIEW_STATUS_COLORS[reviewStatus]}>
            {formatLabel(reviewStatus)}
          </Tag>
        ),
      },
      {
        title: "Started",
        dataIndex: "startedAt",
        key: "startedAt",
        width: 120,
        render: (value) => value || "Not set",
      },
      {
        title: "Completed",
        dataIndex: "completedAt",
        key: "completedAt",
        width: 120,
        render: (value) => value || "Not set",
      },
      {
        title: "Task",
        dataIndex: "task",
        key: "task",
        width: 220,
        render: (task) =>
          task ? (
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
          ) : (
            "Not linked"
          ),
      },
      {
        title: "Protocol",
        dataIndex: "protocol",
        key: "protocol",
        width: 240,
        render: (protocol) =>
          protocol ? (
            <Link to={`/protocols/${protocol.id}`}>
              {protocol.title} v{protocol.version}
            </Link>
          ) : (
            "Not linked"
          ),
      },
      {
        title: "Actions",
        key: "actions",
        width: canArchiveExperiments ? 220 : 140,
        render: (_, record) => (
          <Space>
            <Link to={`/experiments/${record.id}`}>
              <Button size="small">View</Button>
            </Link>

            {canEditExperiments && (
              <Button
                size="small"
                onClick={() => openEditModal(record)}
                disabled={!canEditExperimentRecord(record)}
              >
                Edit
              </Button>
            )}

            {canArchiveExperiments && (
              <Popconfirm
                title="Archive  experiment?"
                description="This will hide the experiment from normal experiment lists. It will not be permanently deleted."
                okText="Archive"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleArchive(record.id)}
              >
                <Button size="small" danger>
                  Archive
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ];

    return baseColumns;
  }, [
    canArchiveExperiments,
    handleArchive,
    openEditModal,
    canEditExperiments,
    canEditExperimentRecord,
  ]);

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
              Experiments
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Track project-linked lab experiments, researchers, experiment
              status, notes, and supervisor review.
            </Paragraph>
          </div>

          {canCreateExperiments && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              New Experiment
            </Button>
          )}
        </div>

        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="Filter by project"
            style={{ width: 320 }}
            loading={isLoadingProjects}
            options={projectOptions}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
          />

          <Select
            allowClear
            placeholder="Filter by status"
            style={{ width: 200 }}
            options={EXPERIMENT_STATUS_OPTIONS}
            value={selectedStatus}
            onChange={setSelectedStatus}
          />

          <Select
            allowClear
            placeholder="Filter by review"
            style={{ width: 220 }}
            options={REVIEW_STATUS_OPTIONS}
            value={selectedReviewStatus}
            onChange={setSelectedReviewStatus}
          />

          <Button onClick={loadExperiments}>Refresh</Button>
        </Space>

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
          dataSource={experiments}
          loading={isLoadingExperiments}
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
          }}
          scroll={{
            x: 1400,
          }}
        />
      </Card>

      <ExperimentFormModal
        open={isModalOpen}
        experiment={editingExperiment}
        projects={projects}
        users={users}
        tasks={tasks}
        protocols={protocols}
        defaultProjectId={selectedProjectId}
        currentUser={currentUser}
        isLoadingProjects={isLoadingProjects}
        isLoadingUsers={isLoadingUsers}
        isLoadingTasks={isLoadingTasks}
        isLoadingProtocols={isLoadingProtocols}
        onCancel={closeModal}
        onSuccess={handleExperimentSaved}
      />
    </>
  );
};

export default ExperimentsPage;
