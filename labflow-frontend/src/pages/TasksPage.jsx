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
import { fetchProjectMembers } from "../api/projectMemberApi";
import {
  getCurrentUserProjectRole,
  canEditProjectTaskRecord,
  canCreateProjectTask,
} from "../utils/projectRoleAccess";
import { useAuth } from "../context/useAuth";
import { TASK_STATUS_OPTIONS } from "../constants/statusOptions";
import { TASK_PRIORITY_OPTIONS } from "../constants/statusOptions";
import { TASK_STATUS_COLORS } from "../constants/statusColors";
import { TASK_PRIORITY_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

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

  const [form] = Form.useForm();

  const isEditingTask = Boolean(editingTask);

  const isAdminOrSupervisor = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  // Only admins and supervisors can delete tasks
  const canDeleteTasks = isAdminOrSupervisor;

  const currentUserFormProjectRole = useMemo(() => {
    return getCurrentUserProjectRole(
      formProjectMembers,
      currentUser,
      formProjectId,
    );
  }, [formProjectMembers, currentUser, formProjectId]);

  const canAssignTaskForSelectedProject = canCreateProjectTask(
    currentUser,
    currentUserFormProjectRole,
  );

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

  const formAssigneeOptions = useMemo(() => {
    if (isAdminOrSupervisor) {
      return userOptions;
    }

    if (!formProjectId) {
      return [
        {
          label: `${currentUser?.name} (${currentUser?.role})`,
          value: currentUser?.id,
        },
      ];
    }

    if (currentUserFormProjectRole === "lead") {
      return formProjectMembers
        .map((member) => {
          const memberUser = member.user;

          if (!memberUser) {
            return null;
          }

          return {
            label: `${memberUser.name} (${member.projectRole})`,
            value: memberUser.id,
          };
        })
        .filter(Boolean);
    }

    return [
      {
        label: `${currentUser?.name} (${currentUser?.role})`,
        value: currentUser?.id,
      },
    ];
  }, [
    currentUserFormProjectRole,
    formProjectId,
    formProjectMembers,
    isAdminOrSupervisor,
    currentUser,
    userOptions,
  ]);

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

  const canCreateTaskForFormProject =
    isAdminOrSupervisor ||
    !formProjectId ||
    canCreateProjectTask(currentUser, currentUserFormProjectRole);

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

    // Reset form state so previous edit values do not leak into the create form
    form.resetFields();

    // Give new tasks default values
    form.setFieldsValue({
      status: "todo",
      priority: "medium",
      assignedToId: isAdminOrSupervisor ? undefined : currentUser?.id,
    });

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

      // DatePicker requires dayjs objects, not raw date strings
      form.setFieldsValue({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? dayjs(task.dueDate) : null,
        projectId: task.projectId || undefined,
        assignedToId: task.assignedToId || currentUser?.id,
      });

      setIsModalOpen(true);
    },
    [form, loadFormProjectMembers, currentUser?.id],
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    form.resetFields();
  };

  const isMemberSelfEditingAssignedProjectTask = useMemo(() => {
    if (!editingTask || !editingTask.projectId || !currentUser?.id) {
      return false;
    }

    if (currentUser?.role !== "researcher") {
      return false;
    }

    const projectRole = projectRoleByProjectId[Number(editingTask.projectId)];

    return (
      projectRole === "member" &&
      Number(editingTask.assignedToId) === Number(currentUser.id)
    );
  }, [editingTask, currentUser, projectRoleByProjectId]);

  const handleSubmit = async (values) => {
    try {
      setIsSubmitting(true);

      const resolvedAssignedToId =
        values.assignedToId || (!isAdminOrSupervisor ? currentUser?.id : null);

      // Convert form values into the format expected by the backend
      const payload = isMemberSelfEditingAssignedProjectTask
        ? { status: values.status, description: values.description }
        : {
            title: values.title,
            description: values.description,
            status: values.status,
            priority: values.priority,
            dueDate: values.dueDate
              ? values.dueDate.format("YYYY-MM-DD")
              : null,
            assignedToId: resolvedAssignedToId,
          };

      if (!isEditingTask) {
        payload.projectId = values.projectId || null;
      }

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
  }, [canDeleteTasks, canEditTaskRecord, handleDelete, openEditModal]);

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
            <Input
              placeholder="Prepare caffeine calibration standards"
              disabled={isMemberSelfEditingAssignedProjectTask}
            />
          </Form.Item>

          <Form.Item label="Project" name="projectId">
            <Select
              allowClear
              placeholder="Optionally link this task to a project"
              loading={isLoadingProjects}
              options={projectOptions}
              disabled={isEditingTask}
              onChange={async (nextProjectId) => {
                const normalizedProjectId = nextProjectId || null;

                setFormProjectId(normalizedProjectId);

                if (!isAdminOrSupervisor) {
                  form.setFieldValue("assignedToId", currentUser?.id);
                }

                await loadFormProjectMembers(normalizedProjectId);
              }}
            />
          </Form.Item>

          {formProjectId && !canCreateTaskForFormProject && !isEditingTask && (
            <Alert
              type="warning"
              showIcon
              message="You cannot create project-linked tasks for this project."
              description="Only admins, project supervisors, and project leads can create and assign project-linked tasks."
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item label="Assign To" name="assignedToId">
            <Select
              allowClear={isAdminOrSupervisor}
              placeholder="Assign to a lab member"
              loading={isLoadingUsers || isLoadingFormProjectMembers}
              options={formAssigneeOptions}
              disabled={
                isMemberSelfEditingAssignedProjectTask ||
                !canAssignTaskForSelectedProject
              }
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
            <Select
              options={TASK_PRIORITY_OPTIONS}
              disabled={isMemberSelfEditingAssignedProjectTask}
            />
          </Form.Item>

          <Form.Item label="Due Date" name="dueDate">
            <DatePicker
              style={{ width: "100%" }}
              disabled={isMemberSelfEditingAssignedProjectTask}
            />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeModal}>Cancel</Button>

            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              disabled={!canCreateTaskForFormProject && !isEditingTask}
            >
              {editingTask ? "Save Changes" : "Create Task"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default TasksPage;
