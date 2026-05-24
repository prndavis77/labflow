import {
  Alert,
  Button,
  Card,
  Descriptions,
  Space,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useState } from "react";

import { fetchExperimentById } from "../api/experimentApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  EXPERIMENT_STATUS_COLORS,
  REVIEW_STATUS_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph } = Typography;

const ExperimentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [experiment, setExperiment] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Loads one experiment by route ID
  const loadExperimentDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const result = await fetchExperimentById(id);

      setExperiment(result.data.experiment);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load experiment details.";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Load experiment details after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadExperimentDetail();
    });
  }, [loadExperimentDetail]);

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
    <Card loading={isLoading && !experiment}>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/experiments")}
        >
          Back to Experiments
        </Button>

        <Button
          icon={<ReloadOutlined />}
          onClick={loadExperimentDetail}
          loading={isLoading}
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
              {experiment.task?.title || "Not linked"}
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
  );
};

export default ExperimentDetailPage;
