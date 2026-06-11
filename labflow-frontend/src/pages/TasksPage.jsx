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

import { fetchTasks, createTask, updateTask, deleteTask } from "../api/taskApi";
import { fetchProjects } from "../api/projectApi";
import { fetchUsers } from "../api/userApi";
import { fetchProjectMembers } from "../api/projectMemberApi";
import {
  canEditProjectTaskRecord,
  getCurrentUserProjectRole,
} from "../utils/projectRoleAccess";
import TaskFormModal from "../components/tasks/TaskFormModal";
import { useAuth } from "../context/useAuth";
import { TASK_STATUS_OPTIONS } from "../constants/statusOptions";
import { TASK_STATUS_COLORS } from "../constants/statusColors";
import { TASK_PRIORITY_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph, Text } = Typography;

const TasksPage = () => {
  const { user: currentUser } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [formProjectMembers, setFormProjectMembers] = useState([]);

  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingFormProjectMembers, setIsLoadingFormProjectMembers] =
    useState(false);

  const [editingTask, setEditingTask] = useState(null);
  const [formProjectId, setFormProjectId] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState(undefined);
  const [selectedStatus, setSelectedStatus] = useState(undefined);

  const [projectRoleByProjectId, setProjectRoleByProjectId] = useState({});

  const isAdminOrSupervisor = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  // Only admins and supervisors can delete tasks
  const canDeleteTasks = isAdminOrSupervisor;

  // Converts projects into options for Ant Design Select.
  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  // Builds the filter object used by the task API
  const taskFilters = useMemo(() => {
    const filters = {};

    if (selectedProjectId) {
      filters.projectId = selectedProjectId;
    }

    if (selectedStatus) {
      filters.status = selectedStatus;
    }

    return filters;
  }, [selectedProjectId, selectedStatus]);

  // Loads projects so tasks can be linked to a project in the form
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

  const loadFormProjectMembers = useCallback(async (projectId) => {
    if (!projectId) {
      setFormProjectMembers([]);
      return;
    }

    try {
      setIsLoadingFormProjectMembers(true);

      const result = await fetchProjectMembers({ projectId });

      setFormProjectMembers(result.data.projectMembers);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load project members.";

      message.error(messageText);
      setFormProjectMembers([]);
    } finally {
      setIsLoadingFormProjectMembers(false);
    }
  }, []);

  // Loads users so tasks can be assigned to lab members
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

  const loadProjectRolesForTasks = useCallback(
    async (taskList) => {
      if (!currentUser?.id) {
        setProjectRoleByProjectId({});
        return;
      }

      if (isAdminOrSupervisor) {
        setProjectRoleByProjectId({});
        return;
      }

      const projectIds = [
        ...new Set(
          taskList.map((taskItem) => taskItem.projectId).filter(Boolean),
        ),
      ];

      if (projectIds.length === 0) {
        setProjectRoleByProjectId({});
        return;
      }

      const results = await Promise.allSettled(
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

      const roleEntries = results.map((result, index) => {
        const projectId = Number(projectIds[index]);

        if (result.status === "fulfilled") {
          return result.value;
        }

        return [projectId, null];
      });

      setProjectRoleByProjectId(Object.fromEntries(roleEntries));
    },
    [currentUser, isAdminOrSupervisor],
  );

  // Loads tasks from the backend using the current filters
  const loadTasks = useCallback(async () => {
    try {
      setIsLoadingTasks(true);
      setErrorMessage("");

      const result = await fetchTasks(taskFilters);
      const fetchedTasks = result.data.tasks;

      setTasks(fetchedTasks);

      await loadProjectRolesForTasks(fetchedTasks);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load tasks.";

      setErrorMessage(messageText);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [taskFilters, loadProjectRolesForTasks]);

  // Load projects after the first render
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadProjects();
    });
  }, [loadProjects]);

  // Reload tasks whenever task filters change.
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadTasks();
    });
  }, [loadTasks]);

  // Load users after the first render.
  // These users populate the task assignee dropdown.
  useEffect(() => {
    queueMicrotask(() => {
      loadUsers();
    });
  }, [loadUsers]);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormProjectId(null);
    setFormProjectMembers([]);
    setIsModalOpen(true);
  };

  const openEditModal = useCallback(
    async (task) => {
      setEditingTask(task);

      const nextProjectId = task.projectId || null;

      setFormProjectId(nextProjectId);

      if (nextProjectId) {
        await loadFormProjectMembers(nextProjectId);
      } else {
        setFormProjectMembers([]);
      }

      setIsModalOpen(true);
    },
    [loadFormProjectMembers],
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const handleSubmit = async (payload) => {
    try {
      setIsSubmitting(true);

      if (editingTask) {
        await updateTask(editingTask.id, payload);
        message.success("Task updated successfully.");
      } else {
        await createTask(payload);
        message.success("Task created successfully.");
      }

      closeModal();
      await loadTasks();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save task.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (taskId) => {
      try {
        await deleteTask(taskId);

        message.success("Task deleted successfully.");

        await loadTasks();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete task.";

        message.error(messageText);
      }
    },
    [loadTasks],
  );

  const canEditTaskRecord = useCallback(
    (record) => {
      if (!record) {
        return false;
      }

      if (isAdminOrSupervisor) {
        return true;
      }

      // Standalone tasks are not controlled by project membership.
      // Researchers can edit standalone tasks assigned to them.
      if (!record.projectId) {
        return Number(record.assignedToId) === Number(currentUser?.id);
      }

      const projectRole = projectRoleByProjectId[Number(record.projectId)];

      return canEditProjectTaskRecord({
        currentUser: currentUser,
        projectRole,
        task: record,
      });
    },
    [isAdminOrSupervisor, projectRoleByProjectId, currentUser],
  );

  // Table columns are memoized because they include action callbacks.
  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: "Task",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <Link to={`/tasks/${record.id}`}>
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
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 260,
        render: (project, record) =>
          record.project ? (
            <Link to={`/projects/${record.project.id}`}>
              {record.project.title}
            </Link>
          ) : (
            <Text type="secondary">No project</Text>
          ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (status) => (
          <Tag color={TASK_STATUS_COLORS[status]}>{formatLabel(status)}</Tag>
        ),
      },
      {
        title: "Priority",
        dataIndex: "priority",
        key: "priority",
        width: 120,
        render: (priority) => (
          <Tag color={TASK_PRIORITY_COLORS[priority]}>
            {formatLabel(priority)}
          </Tag>
        ),
      },
      {
        title: "Assigned To",
        dataIndex: "assignedTo",
        key: "assignedTo",
        width: 180,
        render: (assignedTo) => assignedTo?.name || "Unassigned",
      },
      {
        title: "Due Date",
        dataIndex: "dueDate",
        key: "dueDate",
        width: 130,
        render: (value) => value || "Not set",
      },
      {
        title: "Actions",
        key: "actions",
        width: canDeleteTasks ? 220 : 140,
        render: (_, record) => (
          <Space>
            <Link to={`/tasks/${record.id}`}>
              <Button size="small">View</Button>
            </Link>

            <Button
              size="small"
              onClick={() => openEditModal(record)}
              disabled={!canEditTaskRecord(record)}
            >
              Edit
            </Button>

            {canDeleteTasks && (
              <Popconfirm
                title="Delete task?"
                description="This cannot be undone."
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(record.id)}
                disabled={
                  currentUser.role === "supervisor" && !record.projectId
                }
              >
                <Button
                  size="small"
                  danger
                  disabled={
                    currentUser.role === "supervisor" && !record.projectId
                  }
                >
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ];
    return baseColumns;
  }, [
    canDeleteTasks,
    canEditTaskRecord,
    handleDelete,
    openEditModal,
    currentUser,
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
              Tasks
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Track lab tasks, optional project links, assignees, priorities,
              deadlines, and status.
            </Paragraph>
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            New Task
          </Button>
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
            style={{ width: 180 }}
            options={TASK_STATUS_OPTIONS}
            value={selectedStatus}
            onChange={setSelectedStatus}
          />

          <Button onClick={loadTasks}>Refresh</Button>
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
          dataSource={tasks}
          loading={isLoadingTasks}
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
          }}
        />
      </Card>

      <TaskFormModal
        open={isModalOpen}
        mode={editingTask ? "edit" : "create"}
        task={editingTask}
        currentUser={currentUser}
        projects={projects}
        users={users}
        formProjectMembers={formProjectMembers}
        formProjectId={formProjectId}
        isSubmitting={isSubmitting}
        isLoadingProjects={isLoadingProjects}
        isLoadingUsers={isLoadingUsers}
        isLoadingFormProjectMembers={isLoadingFormProjectMembers}
        onCancel={closeModal}
        onProjectChange={async (nextProjectId) => {
          setFormProjectId(nextProjectId);
          await loadFormProjectMembers(nextProjectId);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export default TasksPage;
