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
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from "../api/projectApi";
import { useAuth } from "../context/AuthContext";
import { PROJECT_STATUS_OPTIONS } from "../constants/statusOptions";
import { PROJECT_STATUS_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const ProjectsPage = () => {
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [form] = Form.useForm();

  // Admins and supervisors can manage projects
  // Researchers can view projects but cannot create, edit, or delete them
  const canManageProjects = ["admin", "supervisor"].includes(user?.role);

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

  // Load projects when the page first renders.
  useEffect(() => {
    queueMicrotask(() => {
      loadProjects();
    });
  }, [loadProjects]);

  function openCreateModal() {
    setEditingProject(null);

    // Reset the form so old values do not appear when creating a new project.
    form.resetFields();

    // Give new projects a sensible default status.
    form.setFieldsValue({
      status: "planning",
    });

    setIsModalOpen(true);
  }

  // Opens the modal in edit mode and fills the form with the selected project's data.
  const openEditModal = useCallback(
    (project) => {
      setEditingProject(project);

      // DatePicker expects dayjs objects, so date strings from the API must be converted
      form.setFieldsValue({
        title: project.title,
        description: project.description,
        status: project.status,
        startDate: project.startDate ? dayjs(project.startDate) : null,
        targetEndDate: project.targetEndDate
          ? dayjs(project.targetEndDate)
          : null,
      });

      setIsModalOpen(true);
    },
    [form],
  );

  function closeModal() {
    setIsModalOpen(false);
    setEditingProject(null);
    form.resetFields();
  }

  async function handleSubmit(values) {
    try {
      setIsSubmitting(true);

      // Convert Ant Design DatePicker values into YYYY-MM-DD strings for the backend
      const payload = {
        title: values.title,
        description: values.description,
        status: values.status,
        startDate: values.startDate
          ? values.startDate.format("YYYY-MM-DD")
          : null,
        targetEndDate: values.targetEndDate
          ? values.targetEndDate.format("YYYY-MM-DD")
          : null,
      };

      if (editingProject) {
        await updateProject(editingProject.id, payload);
        message.success("Project updated successfully.");
      } else {
        await createProject(payload);
        message.success("Project created successfully.");
      }

      closeModal();
      await loadProjects();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save project.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDelete = useCallback(
    async (projectId) => {
      try {
        await deleteProject(projectId);

        message.success("Project deleted successfully.");

        await loadProjects();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete project.";

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
            <strong>{title}</strong>
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
        render: (supervisor) => supervisor?.name || "Not assigned",
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

    if (!canManageProjects) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        title: "Actions",
        key: "actions",
        width: 180,
        render: (_, record) => (
          <Space>
            <Button size="small" onClick={() => openEditModal(record)}>
              Edit
            </Button>

            <Popconfirm
              title="Delete project?"
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
          </Space>
        ),
      },
    ];
  }, [canManageProjects, handleDelete, openEditModal]);

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

      <Modal
        title={editingProject ? "Edit Project" : "Create Project"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item
            label="Project Title"
            name="title"
            rules={[
              { required: true, message: "Please enter a project title" },
              {
                min: 3,
                message: "Project title must be at least 3 characters.",
              },
            ]}
          >
            <Input placeholder="HPLC Method Development for Caffeine Analysis" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea
              rows={4}
              placeholder="Briefly describe the research objective, scope, or study goal."
            />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[
              { required: true, message: "Please select a project status." },
            ]}
          >
            <Select options={PROJECT_STATUS_OPTIONS} />
          </Form.Item>

          <Form.Item label="Start Date" name="startDate">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Target End Date" name="targetEndDate">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeModal}>Cancel</Button>

            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              {editingProject ? "Save Changes" : "Create Project"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default ProjectsPage;
