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
import dayjs from "dayjs";

import {
  createExperiment,
  deleteExperiment,
  fetchExperiments,
  updateExperiment,
} from "../api/experimentApi";
import { fetchProjects } from "../api/projectApi";
import { fetchTasks } from "../api/taskApi";
import { fetchUsers } from "../api/userApi";
import { fetchProtocols } from "../api/protocolApi";
import { useAuth } from "../context/AuthContext";
import { EXPERIMENT_STATUS_OPTIONS } from "../constants/statusOptions";
import { EXPERIMENT_STATUS_COLORS } from "../constants/statusColors";
import { REVIEW_STATUS_OPTIONS } from "../constants/statusOptions";
import { REVIEW_STATUS_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const ExperimentsPage = () => {
  const { user } = useAuth();

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState(null);

  const [selectedProjectId, setSelectedProjectId] = useState(undefined);
  const [selectedStatus, setSelectedStatus] = useState(undefined);
  const [selectedReviewStatus, setSelectedReviewStatus] = useState(undefined);

  const [form] = Form.useForm();

  // Watches the selected project inside the experiment form.
  // This allows linked task and protocol dropdowns to update immediately.
  const selectedExperimentFormProjectId = Form.useWatch("projectId", form);

  // Only admins and supervisors can delete experiment records
  // Researchers can create and update experiments, but not delete them
  const canDeleteExperiments = ["admin", "supervisor"].includes(user?.role);

  // Converts projects into options for Ant Design Select components
  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  // Converts users into researcher options
  // Later, this should be scoped to project members or lab members
  const userOptions = useMemo(() => {
    return users.map((userItem) => ({
      label: `${userItem.name} (${userItem.role})`,
      value: userItem.id,
    }));
  }, [users]);

  // Converts tasks into options
  // If a project is selected in the form, the list is narrowed to that project
  const taskOptions = useMemo(() => {
    const selectedFormProjectId = selectedExperimentFormProjectId;

    return tasks
      .filter((task) => {
        if (!selectedFormProjectId) {
          return true;
        }

        return Number(task.projectId) === Number(selectedFormProjectId);
      })
      .map((task) => ({
        label: task.title,
        value: task.id,
      }));
  }, [tasks, selectedExperimentFormProjectId]);

  // Converts protocols into options
  // If a project is selected in the form, the list is narrowed to that project
  const protocolOptions = useMemo(() => {
    const selectedFormProjectId = selectedExperimentFormProjectId;

    return protocols
      .filter((protocol) => {
        if (!selectedFormProjectId) {
          return true;
        }

        return Number(protocol.projectId) === Number(selectedFormProjectId);
      })
      .map((protocol) => ({
        label: `${protocol.title} v${protocol.version}`,
        value: protocol.id,
      }));
  }, [protocols, selectedExperimentFormProjectId]);

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

      setExperiments(result.data.experiments);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load experiments.";

      setErrorMessage(messageText);
    } finally {
      setIsLoadingExperiments(false);
    }
  }, [experimentFilters]);

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

    // Reset form state so previous edit values do not leak into the create form
    form.resetFields();

    // Give new experiments sensible defaults
    form.setFieldsValue({
      status: "planned",
      reviewStatus: "not_submitted",
      projectId: selectedProjectId || undefined,
      researcherId: user?.id,
    });

    setIsModalOpen(true);
  };

  const openEditModal = useCallback(
    (experiment) => {
      setEditingExperiment(experiment);

      // DatePicker requires dayjs objects, not raw date strings.
      form.setFieldsValue({
        title: experiment.title,
        objective: experiment.objective,
        notes: experiment.notes,
        status: experiment.status,
        reviewStatus: experiment.reviewStatus,
        startedAt: experiment.startedAt ? dayjs(experiment.startedAt) : null,
        completedAt: experiment.completedAt
          ? dayjs(experiment.completedAt)
          : null,
        projectId: experiment.projectId,
        researcherId: experiment.researcherId,
        taskId: experiment.taskId || undefined,
        protocolId: experiment.protocolId || undefined,
      });

      setIsModalOpen(true);
    },
    [form],
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExperiment(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      setIsSubmitting(true);
      // Convert form values into the format expected by the backend.
      const payload = {
        title: values.title,
        objective: values.objective,
        notes: values.notes,
        status: values.status,
        reviewStatus: values.reviewStatus,
        startedAt: values.startedAt
          ? values.startedAt.format("YYYY-MM-DD")
          : null,
        completedAt: values.completedAt
          ? values.completedAt.format("YYYY-MM-DD")
          : null,
        projectId: values.projectId,
        researcherId: values.researcherId,
        taskId: values.taskId || null,
        protocolId: values.protocolId || null,
      };

      if (editingExperiment) {
        await updateExperiment(editingExperiment.id, payload);
        message.success("Experiment updated successfully.");
      } else {
        await createExperiment(payload);
        message.success("Experiment created successfully.");
      }

      closeModal();
      await loadExperiments();
      await loadTasks();
      await loadProtocols();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save experiment.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (experimentId) => {
      try {
        await deleteExperiment(experimentId);

        message.success("Experiment deleted successfully.");

        await loadExperiments();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete experiment.";

        message.error(messageText);
      }
    },
    [loadExperiments],
  );

  const handleProjectChange = (projectId) => {
    // Changing project should clear the linked task if the old task belongs to another project
    form.setFieldsValue({
      projectId,
      taskId: undefined,
      protocolId: undefined,
    });
  };

  // Table columns are memoized because they include action callbacks
  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: "Experiment",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <strong>{title}</strong>
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
        render: (project) => project?.title || "Not linked",
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
        render: (task) => task?.title || "Not linked",
      },
      {
        title: "Protocol",
        dataIndex: "protocol",
        key: "protocol",
        width: 240,
        render: (protocol) =>
          protocol ? `${protocol.title} v${protocol.version}` : "Not linked",
      },
      {
        title: "Actions",
        key: "actions",
        width: canDeleteExperiments ? 180 : 90,
        render: (_, record) => (
          <Space>
            <Button size="small" onClick={() => openEditModal(record)}>
              Edit
            </Button>

            {canDeleteExperiments && (
              <Popconfirm
                title="Delete experiment?"
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
  }, [canDeleteExperiments, handleDelete, openEditModal]);

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

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            New Experiment
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

      <Modal
        title={editingExperiment ? "Edit Experiment" : "Create Experiment"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item
            label="Experiment Title"
            name="title"
            rules={[
              {
                required: true,
                message: "Please enter an experiment title.",
              },
              {
                min: 3,
                message: "Experiment title must be at least 3 characters.",
              },
            ]}
          >
            <Input placeholder="Caffeine calibration curve run 1" />
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
              onChange={handleProjectChange}
            />
          </Form.Item>

          <Form.Item
            label="Researcher"
            name="researcherId"
            rules={[
              {
                required: true,
                message: "Please select a researcher.",
              },
            ]}
          >
            <Select
              placeholder="Select researcher"
              loading={isLoadingUsers}
              options={userOptions}
            />
          </Form.Item>

          <Form.Item label="Linked Task" name="taskId">
            <Select
              allowClear
              placeholder="Optionally link this experiment to a task"
              loading={isLoadingTasks}
              options={taskOptions}
            />
          </Form.Item>

          <Form.Item label="Protocol Used" name="protocolId">
            <Select
              allowClear
              placeholder="Optionally link the protocol used"
              loading={isLoadingProtocols}
              options={protocolOptions}
            />
          </Form.Item>

          <Form.Item label="Objective" name="objective">
            <TextArea
              rows={3}
              placeholder="Describe what this experiment is intended to test, measure, compare, or validate."
            />
          </Form.Item>

          <Form.Item label="Notes" name="notes">
            <TextArea
              rows={4}
              placeholder="Record setup details, observations, deviations, or early results."
            />
          </Form.Item>

          <Space style={{ display: "flex", gap: 16 }} align="start">
            <Form.Item
              label="Experiment Status"
              name="status"
              rules={[
                {
                  required: true,
                  message: "Please select experiment status.",
                },
              ]}
              style={{ flex: 1 }}
            >
              <Select options={EXPERIMENT_STATUS_OPTIONS} />
            </Form.Item>

            <Form.Item
              label="Review Status"
              name="reviewStatus"
              rules={[
                {
                  required: true,
                  message: "Please select review status.",
                },
              ]}
              style={{ flex: 1 }}
            >
              <Select options={REVIEW_STATUS_OPTIONS} />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", gap: 16 }} align="start">
            <Form.Item label="Started At" name="startedAt" style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              label="Completed At"
              name="completedAt"
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeModal}>Cancel</Button>

            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              {editingExperiment ? "Save Changes" : "Create Experiment"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default ExperimentsPage;
