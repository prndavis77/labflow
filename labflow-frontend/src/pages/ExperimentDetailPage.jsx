import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchExperimentById } from "../api/experimentApi";
import {
  createNotebookEntry,
  deleteNotebookEntry,
  fetchNotebookEntries,
  updateNotebookEntry,
} from "../api/notebookEntryApi";
import { useAuth } from "../context/AuthContext";
import { NOTEBOOK_ENTRY_TYPE_OPTIONS } from "../constants/statusOptions";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  EXPERIMENT_STATUS_COLORS,
  REVIEW_STATUS_COLORS,
  NOTEBOOK_ENTRY_TYPE_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const ExperimentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [experiment, setExperiment] = useState(null);
  const [notebookEntries, setNotebookEntries] = useState([]);

  // Stores the selected notebook entry type filter
  // Undefined means all notebook entries are shown
  const [selectedNotebookEntryType, setSelectedNotebookEntryType] =
    useState(undefined);

  const [isLoadingExperiment, setIsLoadingExperiment] = useState(false);
  const [isLoadingNotebookEntries, setIsLoadingNotebookEntries] =
    useState(false);
  const [isSubmittingNotebookEntry, setIsSubmittingNotebookEntry] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [notebookErrorMessage, setNotebookErrorMessage] = useState("");

  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [editingNotebookEntry, setEditingNotebookEntry] = useState(null);

  const [notebookForm] = Form.useForm();

  // Admins and supervisors can modify all notebook entries
  // Researchers can modify only entries they authored
  const canModifyNotebookEntry = useCallback(
    (entry) => {
      if (!user || !entry) {
        return false;
      }

      if (["admin", "supervisor"].includes(user.role)) {
        return true;
      }

      return Number(entry.authorId) === Number(user.id);
    },
    [user],
  );

  // Loads one experiment by route ID
  const loadExperimentDetail = useCallback(async () => {
    try {
      setIsLoadingExperiment(true);
      setErrorMessage("");

      const result = await fetchExperimentById(id);

      setExperiment(result.data.experiment);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load experiment details.";

      setErrorMessage(message);
    } finally {
      setIsLoadingExperiment(false);
    }
  }, [id]);

  // Loads notebook entries for the current experiment
  const loadNotebookEntries = useCallback(async () => {
    try {
      setIsLoadingNotebookEntries(true);
      setNotebookErrorMessage("");

      const result = await fetchNotebookEntries({
        experimentId: id,
      });

      setNotebookEntries(result.data.notebookEntries);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load notebook entries.";

      setNotebookErrorMessage(messageText);
    } finally {
      setIsLoadingNotebookEntries(false);
    }
  }, [id]);

  // Load experiment details after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadExperimentDetail();
      loadNotebookEntries();
    });
  }, [loadExperimentDetail, loadNotebookEntries]);

  const openCreateNotebookModal = () => {
    setEditingNotebookEntry(null);

    // Reset form state so old edit values do not appear in the create form
    notebookForm.resetFields();

    // Give new notebook entries sensible defaults
    notebookForm.setFieldsValue({
      entryType: "general_note",
      contentFormat: "plain_text",
    });

    setIsNotebookModalOpen(true);
  };

  const openEditNotebookModal = useCallback(
    (entry) => {
      setEditingNotebookEntry(entry);

      // Fill the form with the selected notebook entry values
      notebookForm.setFieldsValue({
        title: entry.title,
        entryType: entry.entryType,
        content: entry.content,
        contentFormat: entry.contentFormat || "plain_text",
      });

      setIsNotebookModalOpen(true);
    },
    [notebookForm],
  );

  const closeNotebookModal = () => {
    setIsNotebookModalOpen(false);
    setEditingNotebookEntry(null);
    notebookForm.resetFields();
  };

  const handleNotebookSubmit = async (values) => {
    try {
      setIsSubmittingNotebookEntry(true);

      // The backend derives projectId from experimentId and authorId from the logged-in user
      const payload = {
        title: values.title,
        entryType: values.entryType,
        content: values.content,
        contentFormat: "plain_text",
        experimentId: Number(id),
      };

      if (editingNotebookEntry) {
        await updateNotebookEntry(editingNotebookEntry.id, payload);
        message.success("Notebook entry updated successfully.");
      } else {
        await createNotebookEntry(payload);
        message.success("Notebook entry created successfully.");
      }

      closeNotebookModal();
      await loadNotebookEntries();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save notebook entry.";

      message.error(messageText);
    } finally {
      setIsSubmittingNotebookEntry(false);
    }
  };

  const handleDeleteNotebookEntry = useCallback(
    async (entryId) => {
      try {
        await deleteNotebookEntry(entryId);

        message.success("Notebook entry deleted successfully.");

        await loadNotebookEntries();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete notebook entry.";

        message.error(messageText);
      }
    },
    [loadNotebookEntries],
  );

  // Filters notebook entries by selected entry type
  // If no type is selected, all entries are shown
  const filteredNotebookEntries = useMemo(() => {
    if (!selectedNotebookEntryType) {
      return notebookEntries;
    }

    return notebookEntries.filter(
      (entry) => entry.entryType === selectedNotebookEntryType,
    );
  }, [notebookEntries, selectedNotebookEntryType]);

  // Converts notebook entries into Ant Design Timeline items
  const notebookTimelineItems = useMemo(() => {
    return filteredNotebookEntries.map((entry) => ({
      key: entry.id,
      children: (
        <Card size="small">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1 }}>
              <Space wrap style={{ marginBottom: 8 }}>
                <Tag color={NOTEBOOK_ENTRY_TYPE_COLORS[entry.entryType]}>
                  {formatLabel(entry.entryType)}
                </Tag>

                <Text type="secondary">
                  Author: {entry.author?.name || "Unknown"}
                </Text>

                <Text type="secondary">
                  Created: {formatDateTime(entry.createdAt)}
                </Text>
              </Space>

              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                {entry.title}
              </Title>

              <Paragraph
                style={{
                  whiteSpace: "pre-line",
                  marginBottom: 0,
                }}
              >
                {entry.content}
              </Paragraph>

              {entry.updatedAt !== entry.createdAt && (
                <Text
                  type="secondary"
                  style={{ display: "block", marginTop: 8 }}
                >
                  Updated: {formatDateTime(entry.updatedAt)}
                </Text>
              )}
            </div>

            {canModifyNotebookEntry(entry) && (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditNotebookModal(entry)}
                >
                  Edit
                </Button>

                <Popconfirm
                  title="Delete notebook entry?"
                  description="This cannot be undone."
                  okText="Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDeleteNotebookEntry(entry.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            )}
          </div>
        </Card>
      ),
    }));
  }, [
    canModifyNotebookEntry,
    handleDeleteNotebookEntry,
    filteredNotebookEntries,
    openEditNotebookModal,
  ]);

  if (errorMessage) {
    return (
      <Card>
        <Alert type="error" message={errorMessage} showIcon />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/experiments")}
          style={{ marginTop: 16 }}
        >
          Back to Experiments
        </Button>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card loading={isLoadingExperiment && !experiment}>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/experiments")}
          >
            Back to Experiments
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadExperimentDetail();
              loadNotebookEntries();
            }}
            loading={isLoadingExperiment || isLoadingNotebookEntries}
          >
            Refresh
          </Button>
        </Space>

        {experiment && (
          <>
            <Title level={2} style={{ marginBottom: 4 }}>
              {experiment.title}
            </Title>

            <Paragraph>
              {experiment.objective || "No objective provided."}
            </Paragraph>

            <Descriptions bordered column={2}>
              <Descriptions.Item label="Experiment Status">
                <Tag color={EXPERIMENT_STATUS_COLORS[experiment.status]}>
                  {formatLabel(experiment.status)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Review Status">
                <Tag color={REVIEW_STATUS_COLORS[experiment.reviewStatus]}>
                  {formatLabel(experiment.reviewStatus)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Notebook Entries">
                {notebookEntries.length}
              </Descriptions.Item>

              <Descriptions.Item label="Project">
                {experiment.project ? (
                  <Link to={`/projects/${experiment.project.id}`}>
                    {experiment.project.title}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Researcher">
                {experiment.researcher?.name || "Not assigned"}
              </Descriptions.Item>

              <Descriptions.Item label="Linked Task">
                {experiment.task ? (
                  <Link to={`/tasks/${experiment.task.id}`}>
                    {experiment.task.title}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Protocol Used">
                {experiment.protocol ? (
                  <Link to={`/protocols/${experiment.protocol.id}`}>
                    {experiment.protocol.title} v{experiment.protocol.version}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Started At">
                {formatDate(experiment.startedAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Completed At">
                {formatDate(experiment.completedAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Created By">
                {experiment.createdBy?.name || "Unknown"}
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                {formatDateTime(experiment.createdAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Updated At">
                {formatDateTime(experiment.updatedAt)}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Experiment Notes" style={{ marginTop: 24 }}>
              <Paragraph style={{ whiteSpace: "pre-line", marginBottom: 0 }}>
                {experiment.notes || "No notes recorded."}
              </Paragraph>
            </Card>
          </>
        )}
      </Card>

      <Card
        title={`Experiment Notebook (${filteredNotebookEntries.length})`}
        extra={
          <Space wrap>
            <Select
              allowClear
              placeholder="Filter by entry type"
              style={{ width: 220 }}
              options={NOTEBOOK_ENTRY_TYPE_OPTIONS}
              value={selectedNotebookEntryType}
              onChange={setSelectedNotebookEntryType}
            />

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateNotebookModal}
            >
              New Entry
            </Button>
          </Space>
        }
      >
        {notebookErrorMessage && (
          <Alert
            type="error"
            message={notebookErrorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {isLoadingNotebookEntries ? (
          <Card loading />
        ) : notebookEntries.length === 0 ? (
          <Empty description="No notebook entries recorded for this experiment yet." />
        ) : filteredNotebookEntries.length === 0 ? (
          <Empty description="No notebook entries match the selected filter." />
        ) : (
          <Timeline items={notebookTimelineItems} />
        )}
      </Card>

      <Modal
        title={
          editingNotebookEntry ? "Edit Notebook Entry" : "Create Notebook Entry"
        }
        open={isNotebookModalOpen}
        onCancel={closeNotebookModal}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form
          layout="vertical"
          form={notebookForm}
          onFinish={handleNotebookSubmit}
        >
          <Form.Item
            label="Entry Title"
            name="title"
            rules={[
              {
                required: true,
                message: "Please enter a notebook entry title.",
              },
              {
                min: 3,
                message: "Notebook entry title must be at least 3 characters.",
              },
            ]}
          >
            <Input placeholder="Initial HPLC setup observation" />
          </Form.Item>

          <Form.Item
            label="Entry Type"
            name="entryType"
            rules={[
              {
                required: true,
                message: "Please select an entry type.",
              },
            ]}
          >
            <Select options={NOTEBOOK_ENTRY_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            label="Content"
            name="content"
            rules={[
              {
                required: true,
                message: "Please enter notebook content.",
              },
            ]}
          >
            <TextArea
              rows={8}
              placeholder="Record observations, procedures, results, issues, conclusions, or supervisor comments."
            />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeNotebookModal}>Cancel</Button>

            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmittingNotebookEntry}
            >
              {editingNotebookEntry ? "Save Changes" : "Create Entry"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
};

export default ExperimentDetailPage;
