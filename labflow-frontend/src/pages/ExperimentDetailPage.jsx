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

import { fetchExperimentById, updateExperiment } from "../api/experimentApi";
import {
  createNotebookEntry,
  deleteNotebookEntry,
  fetchNotebookEntries,
  updateNotebookEntry,
} from "../api/notebookEntryApi";
import { fetchReviewEvents } from "../api/reviewEventApi";
import { fetchProjects } from "../api/projectApi";
import { fetchProjectMembers } from "../api/projectMemberApi";
import { fetchUsers } from "../api/userApi";
import { fetchTasks } from "../api/taskApi";
import { fetchProtocols } from "../api/protocolApi";
import { useAuth } from "../context/AuthContext";
import ExperimentFormModal from "../components/experiments/ExperimentFormModal";
import { NOTEBOOK_ENTRY_TYPE_OPTIONS } from "../constants/statusOptions";
import {
  getCurrentUserProjectRole,
  canEditProjectLinkedWork,
} from "../utils/projectRoleAccess";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  EXPERIMENT_STATUS_COLORS,
  REVIEW_STATUS_COLORS,
  NOTEBOOK_ENTRY_TYPE_COLORS,
  REVIEW_EVENT_ACTION_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const ExperimentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [experiment, setExperiment] = useState(null);
  const [notebookEntries, setNotebookEntries] = useState([]);
  const [reviewEvents, setReviewEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [protocols, setProtocols] = useState([]);

  const [selectedNotebookEntryType, setSelectedNotebookEntryType] =
    useState(undefined);

  const [isLoadingExperiment, setIsLoadingExperiment] = useState(false);
  const [isLoadingNotebookEntries, setIsLoadingNotebookEntries] =
    useState(false);
  const [isLoadingReviewEvents, setIsLoadingReviewEvents] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingProtocols, setIsLoadingProtocols] = useState(false);

  const [projectMembers, setProjectMembers] = useState([]);
  const [isLoadingProjectMembers, setIsLoadingProjectMembers] = useState(false);

  const [isSubmittingNotebookEntry, setIsSubmittingNotebookEntry] =
    useState(false);
  const [isUpdatingReviewStatus, setIsUpdatingReviewStatus] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [notebookErrorMessage, setNotebookErrorMessage] = useState("");
  const [reviewHistoryErrorMessage, setReviewHistoryErrorMessage] =
    useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [editingNotebookEntry, setEditingNotebookEntry] = useState(null);
  const [isReviewCommentModalOpen, setIsReviewCommentModalOpen] =
    useState(false);

  const [notebookForm] = Form.useForm();
  const [reviewCommentForm] = Form.useForm();

  const isAdminOrSupervisor = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  const currentUserProjectRole = useMemo(() => {
    return getCurrentUserProjectRole(projectMembers, currentUser);
  }, [projectMembers, currentUser]);

  const canEditThisProjectWork = canEditProjectLinkedWork(
    currentUser,
    currentUserProjectRole,
  );

  const canEditExperiment =
    isAdminOrSupervisor ||
    (canEditThisProjectWork && Boolean(currentUser?.canEditExperiments));

  // Only admins and supervisors can perform review decisions
  const canReviewExperiment = isAdminOrSupervisor;

  const isProjectViewer = currentUserProjectRole === "viewer";

  const canSubmitExperimentForReview =
    !canReviewExperiment &&
    canEditExperiment &&
    ["not_submitted", "changes_requested"].includes(experiment?.reviewStatus);

  // Admins and supervisors can modify all notebook entries
  // Researchers can modify only entries they authored
  const canModifyNotebookEntry = useCallback(
    (entry) => {
      if (!currentUser || !entry) {
        return false;
      }

      if (["admin", "supervisor"].includes(currentUser.role)) {
        return true;
      }

      return Number(entry.authorId) === Number(currentUser.id);
    },
    [currentUser],
  );

  const loadProjectMembersForExperiment = useCallback(async (projectId) => {
    if (!projectId) {
      setProjectMembers([]);
      return;
    }

    try {
      setIsLoadingProjectMembers(true);

      const result = await fetchProjectMembers({
        projectId,
      });

      setProjectMembers(result.data.projectMembers);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load project role.";

      message.error(messageText);
    } finally {
      setIsLoadingProjectMembers(false);
    }
  }, []);

  // Loads one experiment by route ID
  const loadExperimentDetail = useCallback(async () => {
    try {
      setIsLoadingExperiment(true);
      setErrorMessage("");

      const result = await fetchExperimentById(id);

      const fetchedExperiment = result.data.experiment;

      setExperiment(fetchedExperiment);

      await loadProjectMembersForExperiment(fetchedExperiment.projectId);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load experiment details.";

      setErrorMessage(message);
    } finally {
      setIsLoadingExperiment(false);
    }
  }, [id, loadProjectMembersForExperiment]);

  const loadFormOptions = useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      setIsLoadingUsers(true);
      setIsLoadingTasks(true);
      setIsLoadingProtocols(true);

      const [projectResult, userResult, taskResult, protocolResult] =
        await Promise.all([
          fetchProjects(),
          fetchUsers(),
          fetchTasks(),
          fetchProtocols(),
        ]);

      setProjects(projectResult.data.projects);
      setUsers(userResult.data.users);
      setTasks(taskResult.data.tasks);
      setProtocols(protocolResult.data.protocols);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load edit form options.";

      message.error(messageText);
    } finally {
      setIsLoadingProjects(false);
      setIsLoadingUsers(false);
      setIsLoadingTasks(false);
      setIsLoadingProtocols(false);
    }
  }, []);

  const closeEditModal = () => {
    setIsEditModalOpen(false);
  };

  const openExperimentReviewCommentModal = () => {
    reviewCommentForm.resetFields();

    reviewCommentForm.setFieldsValue({
      reviewComment: experiment?.reviewComment || "",
    });

    setIsReviewCommentModalOpen(true);
  };

  const closeExperimentReviewCommentModal = useCallback(() => {
    setIsReviewCommentModalOpen(false);
    reviewCommentForm.resetFields();
  }, [reviewCommentForm]);

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

  // Loads review history for the current experiment
  const loadReviewEvents = useCallback(async () => {
    try {
      setIsLoadingReviewEvents(true);
      setReviewHistoryErrorMessage("");

      const result = await fetchReviewEvents({
        targetType: "experiment",
        targetId: id,
      });

      setReviewEvents(result.data.reviewEvents);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load review history.";

      setReviewHistoryErrorMessage(messageText);
    } finally {
      setIsLoadingReviewEvents(false);
    }
  }, [id]);

  // Load experiment details after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadExperimentDetail();
      loadNotebookEntries();
      loadReviewEvents();
      loadFormOptions();
    });
  }, [
    loadExperimentDetail,
    loadNotebookEntries,
    loadReviewEvents,
    loadFormOptions,
  ]);

  const handleExperimentSaved = async () => {
    setIsEditModalOpen(false);
    await loadExperimentDetail();
    await loadReviewEvents();
    await loadNotebookEntries();
  };

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

  const handleSubmitExperimentForReview = async () => {
    try {
      setIsUpdatingReviewStatus(true);

      await updateExperiment(experiment.id, {
        reviewStatus: "pending",
      });

      message.success("Experiment submitted for review.");

      await loadExperimentDetail();
      await loadReviewEvents();
    } catch (error) {
      const messageText =
        error.response?.data?.message ||
        "Failed to submit experiment for review.";

      message.error(messageText);
    } finally {
      setIsUpdatingReviewStatus(false);
    }
  };

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

  // Updates the experiment review status from the detail page.
  // Approving completes the experiment. Requesting changes keeps it in review work.
  const handleExperimentReviewAction = useCallback(
    async (nextReviewStatus, reviewComment) => {
      if (!experiment) {
        return;
      }

      try {
        setIsUpdatingReviewStatus(true);

        const payload = {
          reviewStatus: nextReviewStatus,
          status:
            nextReviewStatus === "approved" ? "completed" : experiment.status,
        };

        if (reviewComment !== undefined) {
          payload.reviewComment = reviewComment;
        }

        await updateExperiment(experiment.id, payload);

        message.success(
          nextReviewStatus === "approved"
            ? "Experiment approved."
            : "Changes requested. Experiment remains in review.",
        );

        closeExperimentReviewCommentModal();
        await loadExperimentDetail();
        await loadReviewEvents();
      } catch (error) {
        const messageText =
          error.response?.data?.message ||
          "Failed to update experiment review status.";

        message.error(messageText);
      } finally {
        setIsUpdatingReviewStatus(false);
      }
    },
    [
      experiment,
      loadExperimentDetail,
      closeExperimentReviewCommentModal,
      loadReviewEvents,
    ],
  );

  const handleExperimentChangeRequestSubmit = async (values) => {
    await handleExperimentReviewAction(
      "changes_requested",
      values.reviewComment,
    );
  };

  // Converts review history events into timeline items
  const reviewHistoryTimelineItems = useMemo(() => {
    return reviewEvents.map((event) => ({
      key: event.id,
      children: (
        <Card size="small">
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color={REVIEW_EVENT_ACTION_COLORS[event.action] || "default"}>
              {formatLabel(event.action)}
            </Tag>
            <Text type="secondary">
              Reviewer: {event.reviewer?.name || "Unknown"}
            </Text>
            <Text type="secondary">{formatDateTime(event.createdAt)}</Text>
          </Space>
          <Paragraph style={{ whiteSpace: "pre-line", marginBottom: 0 }}>
            {event.comment || "No review comment recorded."}
          </Paragraph>
        </Card>
      ),
    }));
  }, [reviewEvents]);

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

  // Review actions should only appear for experiments that are actually in review workflow.
  const shouldShowExperimentReviewActions =
    canReviewExperiment &&
    experiment &&
    ["pending", "changes_requested"].includes(experiment.reviewStatus);

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
              loadReviewEvents();
            }}
            loading={
              isLoadingExperiment ||
              isLoadingNotebookEntries ||
              isLoadingReviewEvents
            }
          >
            Refresh
          </Button>

          {canEditExperiment && experiment && (
            <Button onClick={() => setIsEditModalOpen(true)}>
              Edit Experiment
            </Button>
          )}
        </Space>

        {experiment && (
          <>
            <Title level={2} style={{ marginBottom: 4 }}>
              {experiment.title}
            </Title>

            <Paragraph>
              {experiment.objective || "No objective provided."}
            </Paragraph>

            {isProjectViewer && (
              <Alert
                type="info"
                showIcon
                message="You have read-only access to this project."
                description="You can view this experiment, but you cannot edit project-linked experiment work."
                style={{ marginBottom: 16 }}
              />
            )}

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

              <Descriptions.Item label="Latest Review Feedback" span={2}>
                {experiment.reviewComment || "No current review feedback."}
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

      <Card title={`Review History (${reviewEvents.length})`}>
        {reviewHistoryErrorMessage && (
          <Alert
            type="error"
            message={reviewHistoryErrorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {isLoadingReviewEvents ? (
          <Card loading />
        ) : reviewEvents.length === 0 ? (
          <Empty description="No review history recorded for this experiment yet." />
        ) : (
          <Timeline items={reviewHistoryTimelineItems} />
        )}
      </Card>

      <Card title="Review Workflow" style={{ marginTop: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Approval Status">
              <Tag color={EXPERIMENT_STATUS_COLORS[experiment?.reviewStatus]}>
                {formatLabel(experiment?.reviewStatus)}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Latest Review Comment">
              {experiment?.reviewComment || "No review comment yet."}
            </Descriptions.Item>
          </Descriptions>

          {canSubmitExperimentForReview && (
            <div>
              <Text strong>Author Actions</Text>

              <Paragraph
                type="secondary"
                style={{ marginTop: 4, marginBottom: 8 }}
              >
                Submit this experiment when it is ready for supervisor review.
              </Paragraph>

              <Popconfirm
                title={
                  experiment.reviewStatus === "changes_requested"
                    ? "Resubmit experiment for review"
                    : "Submit experiment for review?"
                }
                description="This will move the experiment to pending review."
                okText="Submit"
                cancelText="Cancel"
                onConfirm={handleSubmitExperimentForReview}
              >
                <Button type="primary" loading={isUpdatingReviewStatus}>
                  {experiment?.reviewStatus === "changes_requested"
                    ? "Resubmit for Review"
                    : "Submit for Review"}
                </Button>
              </Popconfirm>
            </div>
          )}

          {canReviewExperiment && shouldShowExperimentReviewActions && (
            <div>
              <Text strong>Reviewer Actions</Text>

              <Paragraph
                type="secondary"
                style={{ marginTop: 4, marginBottom: 8 }}
              >
                Approve the experiment or request changes with a required review
                note.
              </Paragraph>

              <Space wrap>
                {experiment?.reviewStatus !== "approved" && (
                  <Popconfirm
                    title="Approve experiment?"
                    description="This will approve the experiment and record approval metadata."
                    okText="Approve"
                    cancelText="Cancel"
                    onConfirm={() => handleExperimentReviewAction("approved")}
                  >
                    <Button type="primary" loading={isUpdatingReviewStatus}>
                      Approve Experiment
                    </Button>
                  </Popconfirm>
                )}

                <Button
                  danger
                  loading={isUpdatingReviewStatus}
                  onClick={openExperimentReviewCommentModal}
                >
                  {experiment?.reviewStatus === "changes_requested"
                    ? "Request More Changes"
                    : "Request Changes"}
                </Button>
              </Space>
            </div>
          )}
        </Space>
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
          experiment?.reviewStatus === "changes_requested"
            ? "Request More Changes"
            : "Request Changes"
        }
        open={isReviewCommentModalOpen}
        onCancel={closeExperimentReviewCommentModal}
        footer={null}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={reviewCommentForm}
          onFinish={handleExperimentChangeRequestSubmit}
        >
          <Form.Item
            label="Change Request Note"
            name="reviewComment"
            rules={[
              {
                required: true,
                message: "Please explain what changes are needed.",
              },
              {
                min: 10,
                message: "Please provide a more specific change request.",
              },
            ]}
          >
            <Input.TextArea
              rows={5}
              placeholder="Explain what needs to be corrected, repeated, clarified, or improved."
            />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeExperimentReviewCommentModal}>Cancel</Button>

            <Button
              type="primary"
              danger
              htmlType="submit"
              loading={isUpdatingReviewStatus}
            >
              Save Change Request
            </Button>
          </Space>
        </Form>
      </Modal>

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

      <ExperimentFormModal
        open={isEditModalOpen}
        experiment={experiment}
        projects={projects}
        users={users}
        tasks={tasks}
        protocols={protocols}
        isLoadingProjects={isLoadingProjects}
        isLoadingUsers={isLoadingUsers}
        isLoadingTasks={isLoadingTasks}
        isLoadingProtocols={isLoadingProtocols}
        onCancel={closeEditModal}
        onSuccess={handleExperimentSaved}
      />
    </Space>
  );
};

export default ExperimentDetailPage;
