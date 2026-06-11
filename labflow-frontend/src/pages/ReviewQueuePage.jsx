import {
  Alert,
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ExperimentOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/useAuth";

import { fetchExperiments, updateExperiment } from "../api/experimentApi";
import { fetchProtocols, updateProtocol } from "../api/protocolApi";
import { fetchTasks } from "../api/taskApi";
import { canReviewProjectLinkedRecord } from "../utils/projectRoleAccess";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  APPROVAL_STATUS_COLORS,
  EXPERIMENT_STATUS_COLORS,
  REVIEW_STATUS_COLORS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph } = Typography;

const ReviewQueuePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingExperiments, setPendingExperiments] = useState([]);
  const [changesRequestedExperiments, setChangesRequestedExperiments] =
    useState([]);
  const [pendingProtocols, setPendingProtocols] = useState([]);
  const [changesRequestedProtocols, setChangesRequestedProtocols] = useState(
    [],
  );

  const [tasksAwaitingCompletionReview, setTasksAwaitingCompletionReview] =
    useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingReviewStatus, setIsUpdatingReviewStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canReviewRecords = canReviewProjectLinkedRecord(user);

  // Loads review-related experiments and protocols
  // This page is intentionally focused on records that need supervisor attention
  const loadReviewQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const [
        pendingExperimentResult,
        changesRequestedExperimentResult,
        pendingProtocolResult,
        changesRequestedProtocolResult,
        tasksAwaitingCompletionReviewResult,
      ] = await Promise.all([
        fetchExperiments({ reviewStatus: "pending" }),
        fetchExperiments({ reviewStatus: "changes_requested" }),
        fetchProtocols({ approvalStatus: "pending_review" }),
        fetchProtocols({ approvalStatus: "changes_requested" }),
        fetchTasks({ status: "completion_requested" }),
      ]);

      setPendingExperiments(pendingExperimentResult.data.experiments);
      setChangesRequestedExperiments(
        changesRequestedExperimentResult.data.experiments,
      );
      setPendingProtocols(pendingProtocolResult.data.protocols);
      setChangesRequestedProtocols(
        changesRequestedProtocolResult.data.protocols,
      );
      setTasksAwaitingCompletionReview(
        tasksAwaitingCompletionReviewResult.data.tasks,
      );
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load review queue.";

      setErrorMessage(messageText);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Approves an experiment directly from the review queue.
  const handleApproveExperiment = useCallback(
    async (experiment) => {
      try {
        setIsUpdatingReviewStatus(true);

        await updateExperiment(experiment.id, {
          reviewStatus: "approved",
          status: "completed",
        });

        message.success("Experiment approved.");

        await loadReviewQueue();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to approve experiment.";

        message.error(messageText);
      } finally {
        setIsUpdatingReviewStatus(false);
      }
    },
    [loadReviewQueue],
  );

  // Updates a protocol's approval status directly from the review queue
  const handleApproveProtocol = useCallback(
    async (protocol) => {
      try {
        setIsUpdatingReviewStatus(true);

        await updateProtocol(protocol.id, {
          approvalStatus: "approved",
        });

        message.success("Protocol approved.");

        await loadReviewQueue();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to approve protocol.";

        message.error(messageText);
      } finally {
        setIsUpdatingReviewStatus(false);
      }
    },
    [loadReviewQueue],
  );

  // Load review queue data after the first render
  useEffect(() => {
    queueMicrotask(() => {
      loadReviewQueue();
    });
  }, [loadReviewQueue]);

  const experimentReviewCount =
    pendingExperiments.length + changesRequestedExperiments.length;

  const protocolReviewCount =
    pendingProtocols.length + changesRequestedProtocols.length;

  const taskCompletionReviewCount = tasksAwaitingCompletionReview.length;

  const totalReviewCount =
    experimentReviewCount + protocolReviewCount + taskCompletionReviewCount;

  // Columns for experiments that need review attention
  const experimentColumns = useMemo(
    () => [
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
        width: 260,
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
        width: 170,
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
        width: 130,
        render: formatDate,
      },
      {
        title: "Updated",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 170,
        render: formatDateTime,
      },
      {
        title: "Actions",
        key: "actions",
        width: 290,
        render: (_, record) => (
          <Space>
            <Link to={`/experiments/${record.id}`}>
              <Button size="small">Review</Button>
            </Link>

            {canReviewRecords && record.reviewStatus !== "approved" && (
              <Popconfirm
                title="Approve experiment?"
                description="This will mark the experiment review as approved and set the experiment status to completed."
                okText="Approve"
                cancelText="Cancel"
                onConfirm={() => handleApproveExperiment(record)}
              >
                <Button
                  size="small"
                  type="primary"
                  loading={isUpdatingReviewStatus}
                >
                  Approve
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [handleApproveExperiment, isUpdatingReviewStatus, canReviewRecords],
  );

  // Columns for protocols that need review attention
  const protocolColumns = useMemo(
    () => [
      {
        title: "Protocol",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <Link to={`/protocols/${record.id}`}>
              <strong>{title}</strong>
            </Link>

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
        render: (version) => `v${version}`,
      },
      {
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 260,
        render: (project) =>
          project ? (
            <Link to={`/projects/${project.id}`}>{project.title}</Link>
          ) : (
            "General / Not linked"
          ),
      },
      {
        title: "Equipment",
        dataIndex: "equipment",
        key: "equipment",
        width: 240,
        render: (equipment) =>
          equipment ? (
            <Link to={`/equipment/${equipment.id}`}>
              {equipment.name} ({equipment.type})
            </Link>
          ) : (
            "Not linked"
          ),
      },
      {
        title: "Approval",
        dataIndex: "approvalStatus",
        key: "approvalStatus",
        width: 180,
        render: (approvalStatus) => (
          <Tag color={APPROVAL_STATUS_COLORS[approvalStatus]}>
            {formatLabel(approvalStatus)}
          </Tag>
        ),
      },
      {
        title: "Updated",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 170,
        render: formatDateTime,
      },
      {
        title: "Actions",
        key: "actions",
        width: 290,
        render: (_, record) => (
          <Space>
            <Link to={`/protocols/${record.id}`}>
              <Button size="small">Review</Button>
            </Link>

            {canReviewRecords && record.approvalStatus !== "approved" && (
              <Popconfirm
                title="Approve protocol?"
                description="This will approve the protocol and record approval metadata."
                okText="Approve"
                cancelText="Cancel"
                onConfirm={() => handleApproveProtocol(record)}
              >
                <Button
                  size="small"
                  type="primary"
                  loading={isUpdatingReviewStatus}
                >
                  Approve
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [handleApproveProtocol, isUpdatingReviewStatus, canReviewRecords],
  );

  const taskCompletionColumns = useMemo(
    () => [
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
        title: "Assigned To",
        dataIndex: "assignedTo",
        key: "assignedTo",
        width: 180,
        render: (assignedTo) => assignedTo?.name || "Unassigned",
      },
      {
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 220,
        render: (project) =>
          project ? (
            <Link to={`/projects/${project.id}`}>{project.title}</Link>
          ) : (
            "No project"
          ),
      },
      {
        title: "Priority",
        dataIndex: "priority",
        key: "priority",
        width: 130,
        render: (priority) => (
          <Tag color={TASK_PRIORITY_COLORS[priority]}>
            {formatLabel(priority)}
          </Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 150,
        render: (status) => (
          <Tag color={TASK_STATUS_COLORS[status]}>{formatLabel(status)}</Tag>
        ),
      },
      {
        title: "Due Date",
        dataIndex: "dueDate",
        key: "dueDate",
        width: 130,
        render: formatDate,
      },
      {
        title: "Action",
        key: "action",
        width: 140,
        render: (_, record) =>
          canReviewRecords ? (
            <Button type="link" onClick={() => navigate(`/tasks/${record.id}`)}>
              Review Task
            </Button>
          ) : null,
      },
    ],
    [navigate, canReviewRecords],
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              Review Queue
            </Title>

            <Paragraph style={{ marginBottom: 0 }}>
              Use the Review button to inspect experiments, protocols, or task
              completion requests before taking action. Change requests and task
              completion decisions are handled on the detail pages.
            </Paragraph>
          </div>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadReviewQueue}
            loading={isLoading}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {errorMessage && <Alert type="error" message={errorMessage} showIcon />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <Card>
          <Statistic
            title="Total Review Items"
            value={totalReviewCount}
            prefix={<WarningOutlined />}
            loading={isLoading}
          />
        </Card>

        <Card>
          <Statistic
            title="Experiments Pending"
            value={pendingExperiments.length}
            prefix={<ExperimentOutlined />}
            loading={isLoading}
          />
        </Card>

        <Card>
          <Statistic
            title="Protocols Pending"
            value={pendingProtocols.length}
            prefix={<FileTextOutlined />}
            loading={isLoading}
          />
        </Card>

        <Card>
          <Statistic
            title="Task Completion Requests"
            value={tasksAwaitingCompletionReview.length}
            prefix={<FileTextOutlined />}
            loading={isLoading}
          />
        </Card>

        <Card>
          <Statistic
            title="Changes Requested"
            value={
              changesRequestedExperiments.length +
              changesRequestedProtocols.length
            }
            prefix={<WarningOutlined />}
            loading={isLoading}
          />
        </Card>
      </div>

      <Card title={`Experiments Pending Review (${pendingExperiments.length})`}>
        {pendingExperiments.length === 0 ? (
          <Empty description="No experiments are currently pending review." />
        ) : (
          <Table
            rowKey="id"
            columns={experimentColumns}
            dataSource={pendingExperiments}
            loading={isLoading}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Card
        title={`Experiments With Changes Requested (${changesRequestedExperiments.length})`}
      >
        {changesRequestedExperiments.length === 0 ? (
          <Empty description="No experiments currently have requested changes." />
        ) : (
          <Table
            rowKey="id"
            columns={experimentColumns}
            dataSource={changesRequestedExperiments}
            loading={isLoading}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Card title={`Protocols Pending Review (${pendingProtocols.length})`}>
        {pendingProtocols.length === 0 ? (
          <Empty description="No protocols are currently pending review." />
        ) : (
          <Table
            rowKey="id"
            columns={protocolColumns}
            dataSource={pendingProtocols}
            loading={isLoading}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Card
        title={`Protocols With Changes Requested (${changesRequestedProtocols.length})`}
      >
        {changesRequestedProtocols.length === 0 ? (
          <Empty description="No protocols currently have requested changes." />
        ) : (
          <Table
            rowKey="id"
            columns={protocolColumns}
            dataSource={changesRequestedProtocols}
            loading={isLoading}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Card
        title={`Task Completion Requests (${tasksAwaitingCompletionReview.length})`}
        loading={isLoading}
      >
        {tasksAwaitingCompletionReview.length === 0 ? (
          <Empty description="No task completion requests." />
        ) : (
          <Table
            rowKey="id"
            columns={taskCompletionColumns}
            dataSource={tasksAwaitingCompletionReview}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 900 }}
          />
        )}
      </Card>
    </Space>
  );
};

export default ReviewQueuePage;
