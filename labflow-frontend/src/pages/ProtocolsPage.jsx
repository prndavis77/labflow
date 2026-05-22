import {
  Alert,
  Button,
  Card,
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

import {
  createProtocol,
  deleteProtocol,
  fetchProtocols,
  updateProtocol,
} from "../api/protocolApi";
import { fetchProjects } from "../api/projectApi";
import { useAuth } from "../context/AuthContext";
import { APPROVAL_STATUS_OPTIONS } from "../constants/statusOptions";
import { APPROVAL_STATUS_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const ProtocolsPage = () => {
  const { user } = useAuth();

  const [protocols, setProtocols] = useState([]);
  const [projects, setProjects] = useState([]);

  const [isLoadingProtocols, setIsLoadingProtocols] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState(null);

  const [selectedProjectId, setSelectedProjectId] = useState(undefined);
  const [selectedApprovalStatus, setSelectedApprovalStatus] =
    useState(undefined);

  const [form] = Form.useForm();

  // Only admins and supervisors can manage protocols
  // Researchers can view protocols but cannot create, edit, or delete them
  const canManageProtocols = ["admin", "supervisor"].includes(user?.role);

  // Converts projects into options for Ant Design Select components
  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  // Builds the filter object used by the protocol API.
  const protocolFilters = useMemo(() => {
    const filters = {};

    if (selectedProjectId) {
      filters.projectId = selectedProjectId;
    }

    if (selectedApprovalStatus) {
      filters.approvalStatus = selectedApprovalStatus;
    }

    return filters;
  }, [selectedProjectId, selectedApprovalStatus]);

  // Loads projects for filters and the protocol form
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

  // Loads protocols from the backend using the current filters
  const loadProtocols = useCallback(async () => {
    try {
      setIsLoadingProtocols(true);
      setErrorMessage("");

      const result = await fetchProtocols(protocolFilters);

      setProtocols(result.data.protocols);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load protocols.";

      setErrorMessage(messageText);
    } finally {
      setIsLoadingProtocols(false);
    }
  }, [protocolFilters]);

  // Load projects after the first render
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadProjects();
    });
  }, [loadProjects]);

  // Reload protocols whenever filters change
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadProtocols();
    });
  }, [loadProtocols]);

  const openCreateModal = () => {
    setEditingProtocol(null);

    // Reset form state so previous edit values do not leak into the create form
    form.resetFields();

    // Give new protocols sensible defaults
    form.setFieldsValue({
      version: "1.0",
      approvalStatus: "draft",
      projectId: selectedProjectId || undefined,
    });

    setIsModalOpen(true);
  };

  const openEditModal = useCallback(
    (protocol) => {
      setEditingProtocol(protocol);

      // Fill the form with the selected protocol's current values
      form.setFieldsValue({
        title: protocol.title,
        version: protocol.version,
        purpose: protocol.purpose,
        content: protocol.content,
        approvalStatus: protocol.approvalStatus,
        projectId: protocol.projectId,
      });

      setIsModalOpen(true);
    },
    [form],
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProtocol(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      setIsSubmitting(true);

      // Convert form values into the format expected by the backend
      const payload = {
        title: values.title,
        version: values.version,
        purpose: values.purpose,
        content: values.content,
        approvalStatus: values.approvalStatus,
        projectId: values.projectId,
      };

      if (editingProtocol) {
        await updateProtocol(editingProtocol.id, payload);
        message.success("Protocol updated successfully.");
      } else {
        await createProtocol(payload);
        message.success("Protocol created successfully.");
      }

      closeModal();
      await loadProtocols();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save protocol.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (protocolId) => {
      try {
        await deleteProtocol(protocolId);

        message.success("Protocol deleted successfully.");

        await loadProtocols();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete protocol.";

        message.error(messageText);
      }
    },
    [loadProtocols],
  );

  // Table columns are memoized because they include action callbacks
  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: "Protocol",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <strong>{title}</strong>
            {record.purpose && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.purpose}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Version",
        dataIndex: "version",
        key: "version",
        width: 100,
        render: (version) => (version ? `v${version}` : "Not set"),
      },
      {
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 260,
        render: (project) => project?.title || "Not linked",
      },
      {
        title: "Approval",
        dataIndex: "approvalStatus",
        key: "approvalStatus",
        width: 170,
        render: (approvalStatus) => (
          <Tag color={APPROVAL_STATUS_COLORS[approvalStatus]}>
            {formatLabel(approvalStatus)}
          </Tag>
        ),
      },
      {
        title: "Created By",
        dataIndex: "createdBy",
        key: "createdBy",
        width: 180,
        render: (createdBy) => createdBy?.name || "Unknown",
      },
      {
        title: "Approved By",
        dataIndex: "approvedBy",
        key: "approvedBy",
        width: 180,
        render: (approvedBy) => approvedBy?.name || "Not approved",
      },
      {
        title: "Approved At",
        dataIndex: "approvedAt",
        key: "approvedAt",
        width: 130,
        render: (value) => value || "Not approved",
      },
    ];

    if (!canManageProtocols) {
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
              title="Delete protocol?"
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
  }, [canManageProtocols, handleDelete, openEditModal]);

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
              Protocols
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Manage reusable lab methods, SOPs, protocol versions, and approval
              status.
            </Paragraph>
          </div>

          {canManageProtocols && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              New Protocol
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
            placeholder="Filter by approval"
            style={{ width: 220 }}
            options={APPROVAL_STATUS_OPTIONS}
            value={selectedApprovalStatus}
            onChange={setSelectedApprovalStatus}
          />

          <Button onClick={loadProtocols}>Refresh</Button>
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
          dataSource={protocols}
          loading={isLoadingProtocols}
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
          }}
          scroll={{
            x: 1300,
          }}
        />
      </Card>

      <Modal
        title={editingProtocol ? "Edit Protocol" : "Create Protocol"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        width={800}
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item
            label="Protocol Title"
            name="title"
            rules={[
              {
                required: true,
                message: "Please enter a protocol title.",
              },
              {
                min: 3,
                message: "Protocol title must be at least 3 characters.",
              },
            ]}
          >
            <Input placeholder="HPLC Caffeine Quantification Method" />
          </Form.Item>

          <Space style={{ display: "flex", gap: 16 }} align="start">
            <Form.Item
              label="Version"
              name="version"
              rules={[
                {
                  required: true,
                  message: "Please enter a version.",
                },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="1.0" />
            </Form.Item>

            <Form.Item
              label="Approval Status"
              name="approvalStatus"
              rules={[
                {
                  required: true,
                  message: "Please select approval status.",
                },
              ]}
              style={{ flex: 1 }}
            >
              <Select options={APPROVAL_STATUS_OPTIONS} />
            </Form.Item>
          </Space>

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

          <Form.Item label="Purpose" name="purpose">
            <TextArea
              rows={3}
              placeholder="Explain what this protocol is used for and when researchers should apply it."
            />
          </Form.Item>

          <Form.Item
            label="Protocol Content"
            name="content"
            rules={[
              {
                required: true,
                message: "Please enter the protocol content.",
              },
            ]}
          >
            <TextArea
              rows={10}
              placeholder={
                "1. Prepare reagents...\n2. Set instrument parameters...\n3. Run calibration standards...\n4. Analyze samples..."
              }
            />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeModal}>Cancel</Button>

            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              {editingProtocol ? "Save Changes" : "Create Protocol"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default ProtocolsPage;
