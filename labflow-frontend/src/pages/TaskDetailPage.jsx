import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchTaskById } from "../api/taskApi";
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

  const [task, setTask] = useState(null);
  const [relatedExperiments, setRelatedExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Loads the selected task and experiments linked to that task
  const loadTaskDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      // Fetch task and experiment data in parallel
      // The experiment endpoint currently supports general fetching, so we filter by taskId on the frontend
      const [taskResult, experimentsResult] = await Promise.all([
        fetchTaskById(id),
        fetchExperiments({ taskId: id }),
      ]);

      const fetchedTask = taskResult.data.task;

      const taskExperiments = experimentsResult.data.experiments;

      setTask(fetchedTask);
      setRelatedExperiments(taskExperiments);
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
  }, [loadTaskDetail]);

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
    </Space>
  );
};

export default TaskDetailPage;
