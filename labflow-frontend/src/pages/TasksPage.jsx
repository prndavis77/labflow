import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
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
import dayjs from "dayjs";

import { fetchTasks, createTask, updateTask, deleteTask } from "../api/taskApi";
import { fetchProjects } from "../api/projectApi";
import { fetchUsers } from "../api/userApi";
import { useAuth } from "../context/AuthContext";
import { TASK_STATUS_OPTIONS } from "../constants/statusOptions";
import { TASK_PRIORITY_OPTIONS } from "../constants/statusOptions";
import { TASK_STATUS_COLORS } from "../constants/statusColors";
import { TASK_PRIORITY_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const TasksPage = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(undefined);
  const [selectedStatus, setSelectedStatus] = useState(undefined);

  const [form] = Form.useForm();

  // Researchers can create and update tasks.
  // Only admins and supervisors can delete tasks.
  const canDeleteTasks = ["admin", "supervisor"].includes(user?.role);

  // Converts projects into options for Ant Design Select.
  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  // Converts users into options for the assignee Select field
  const userOptions = useMemo(() => {
    return users.map((userItem) => ({
      label: `${userItem.name} (${userItem.role})`,
      value: userItem.id,
    }));
  }, [users]);

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

  // Loads tasks from the backend using the current filters
  const loadTasks = useCallback(async () => {
    try {
      setIsLoadingTasks(true);
      setErrorMessage("");

      const result = await fetchTasks(taskFilters);

      setTasks(result.data.tasks);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load tasks.";

      setErrorMessage(messageText);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [taskFilters]);

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

    // Reset form state so previous edit values do not leak into the create form
    form.resetFields();

    // Give new tasks sensible default values
    form.setFieldsValue({
      status: "todo",
      priority: "medium",
      projectId: selectedProjectId || undefined,
    });

    setIsModalOpen(true);
  };

  const openEditModal = useCallback(
    (task) => {
      setEditingTask(task);

      // DatePicker requires dayjs objects, not raw date strings
      form.setFieldsValue({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? dayjs(task.dueDate) : null,
        projectId: task.projectId,
        assignedToId: task.assignedToId || undefined,
      });

      setIsModalOpen(true);
    },
    [form],
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      setIsSubmitting(true);

      // Convert form values into the format expected by the backend
      const payload = {
        title: values.title,
        description: values.description,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate ? values.dueDate.format("YYYY-MM-DD") : null,
        projectId: values.projectId,
        assignedToId: values.assignedToId || null,
      };

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
        render: (project) => project?.title || "Not linked",
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

            <Button size="small" onClick={() => openEditModal(record)}>
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
              >
                <Button size="small" danger>
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ];
    return baseColumns;
  }, [canDeleteTasks, handleDelete, openEditModal]);

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
              Track project-linked lab tasks, priorities, deadlines, and review
              status.
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

      <Modal
        title={editingTask ? "Edit Task" : "Create Task"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item
            label="Task Title"
            name="title"
            rules={[
              {
                required: true,
                message: "Please enter a task title.",
              },
              {
                min: 3,
                message: "Task title must be at least 3 characters.",
              },
            ]}
          >
            <Input placeholder="Prepare caffeine calibration standards" />
          </Form.Item>

          <Form.Item
            label="Project"
            name="projectId"
            rules={[
              {
                required: true,
                message: "Please select a project.",
              },
            ]}
          >
            <Select
              placeholder="Select project"
              loading={isLoadingProjects}
              options={projectOptions}
            />
          </Form.Item>

          <Form.Item label="Assign To" name="assignedToId">
            <Select
              allowClear
              placeholder="Assign to a lab member"
              loading={isLoadingUsers}
              options={userOptions}
            />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea
              rows={4}
              placeholder="Describe the task, expected output, or lab work required."
            />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[
              {
                required: true,
                message: "Please select a task status.",
              },
            ]}
          >
            <Select options={TASK_STATUS_OPTIONS} />
          </Form.Item>

          <Form.Item
            label="Priority"
            name="priority"
            rules={[
              {
                required: true,
                message: "Please select a priority.",
              },
            ]}
          >
            <Select options={TASK_PRIORITY_OPTIONS} />
          </Form.Item>

          <Form.Item label="Due Date" name="dueDate">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeModal}>Cancel</Button>

            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              {editingTask ? "Save Changes" : "Create Task"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default TasksPage;
