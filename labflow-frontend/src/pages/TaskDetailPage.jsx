import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/useAuth";
import { fetchTaskById, updateTask } from "../api/taskApi";
import { fetchExperiments } from "../api/experimentApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  EXPERIMENT_STATUS_COLORS,
  REVIEW_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph } = Typography;

const TaskDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [task, setTask] = useState(null);
  const [relatedExperiments, setRelatedExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canRequestTaskCompletion =
    task &&
    Number(task.assignedToId) === Number(currentUser?.id) &&
    task.status !== "done" &&
    task.status !== "completion_requested";

  const isTaskCompletionRequest = task?.status === "completion_requested";

  const canReviewTaskCompletion =
    isTaskCompletionRequest &&
    (currentUser?.role === "admin" ||
      (currentUser?.role === "supervisor" && task?.projectId));

  // Loads the selected task and experiments linked to that task
  const loadTaskDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const taskResult = await fetchTaskById(id);
      const fetchedTask = taskResult.data.task;

      setTask(fetchedTask);

      try {
        const experimentsResult = await fetchExperiments({ taskId: id });
        setRelatedExperiments(experimentsResult.data.experiments);
      } catch {
        setRelatedExperiments([]);
      }
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load task details.";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Load task detail data after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadTaskDetail();
    });
  }, [loadTaskDetail, currentUser?.id]);

  const handleRequestTaskCompletion = async () => {
    try {
      setIsUpdatingTask(true);

      await updateTask(task.id, {
        status: "completion_requested",
      });

      message.success("Task completion submitted for review.");

      await loadTaskDetail();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to submit task completion.";

      message.error(messageText);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleAdminTaskStatusUpdate = async (nextStatus) => {
    try {
      setIsUpdatingTask(true);

      await updateTask(task.id, {
        status: nextStatus,
      });

      message.success(
        nextStatus === "done" ? "Task marked as done." : "Task reopened.",
      );

      await loadTaskDetail();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to update task status.";

      message.error(messageText);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // Columns for experiments linked to this task.
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
    ],
    [],
  );

  if (errorMessage) {
    return (
      <Card>
        <Alert type="error" message={errorMessage} showIcon />

        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/tasks")}
          style={{ marginTop: 16 }}
        >
          Back to Tasks
        </Button>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card loading={isLoading && !task}>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/tasks")}
          >
            Back to Tasks
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadTaskDetail}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Space>

        {task ? (
          <>
            <Title level={2} style={{ marginBottom: 4 }}>
              {task.title}
            </Title>

            <Paragraph>
              {task.description || "No description provided."}
            </Paragraph>

            {(canRequestTaskCompletion || canReviewTaskCompletion) && (
              <Card
                size="small"
                title="Task Completion Workflow"
                style={{ marginBottom: 24 }}
              >
                {canRequestTaskCompletion && (
                  <Popconfirm
                    title="Mark this task as complete?"
                    description="This will notify admins and supervisors that the task is ready for review."
                    okText="Mark Complete"
                    cancelText="Cancel"
                    onConfirm={handleRequestTaskCompletion}
                  >
                    <Button type="primary" loading={isUpdatingTask}>
                      Mark Complete
                    </Button>
                  </Popconfirm>
                )}

                {canReviewTaskCompletion && (
                  <Space>
                    <Button
                      type="primary"
                      loading={isUpdatingTask}
                      onClick={() => handleAdminTaskStatusUpdate("done")}
                    >
                      Confirm Completion
                    </Button>

                    <Button
                      loading={isUpdatingTask}
                      onClick={() => handleAdminTaskStatusUpdate("in_progress")}
                    >
                      Reopen Task
                    </Button>
                  </Space>
                )}
              </Card>
            )}

            <Descriptions bordered column={2}>
              <Descriptions.Item label="Status">
                <Tag color={TASK_STATUS_COLORS[task.status]}>
                  {formatLabel(task.status)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Priority">
                <Tag color={TASK_PRIORITY_COLORS[task.priority]}>
                  {formatLabel(task.priority)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Project">
                {task.project ? (
                  <Link to={`/projects/${task.project.id}`}>
                    {task.project.title}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Assigned To">
                {task.assignedTo?.name || "Unassigned"}
              </Descriptions.Item>

              <Descriptions.Item label="Created By">
                {task.createdBy?.name || "Unknown"}
              </Descriptions.Item>

              <Descriptions.Item label="Due Date">
                {formatDate(task.dueDate)}
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                {formatDateTime(task.createdAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Updated At">
                {formatDateTime(task.updatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="Task not found" />
        )}
      </Card>

      {task?.projectId && (
        <Card title="Related Experiments">
          {relatedExperiments.length === 0 ? (
            <Empty description="No experiments linked to this task yet." />
          ) : (
            <Table
              rowKey="id"
              columns={experimentColumns}
              dataSource={relatedExperiments}
              loading={isLoading}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
              scroll={{ x: 1000 }}
            />
          )}
        </Card>
      )}
    </Space>
  );
};

export default TaskDetailPage;
