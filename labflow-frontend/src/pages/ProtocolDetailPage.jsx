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

import { fetchProtocolById } from "../api/protocolApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import { APPROVAL_STATUS_COLORS } from "../constants/statusColors";

const { Title, Paragraph, Text } = Typography;

const ProtocolDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [protocol, setProtocol] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Loads one protocol by route ID
  const loadProtocolDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const result = await fetchProtocolById(id);

      setProtocol(result.data.protocol);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load protocol details.";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Load protocol details after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadProtocolDetail();
    });
  }, [loadProtocolDetail]);

  if (errorMessage) {
    return (
      <Card>
        <Alert type="error" message={errorMessage} showIcon />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/protocols")}
          style={{ marginTop: 16 }}
        >
          Back to Protocols
        </Button>
      </Card>
    );
  }

  return (
    <Card loading={isLoading && !protocol}>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/protocols")}
        >
          Back to Protocols
        </Button>

        <Button
          icon={<ReloadOutlined />}
          onClick={loadProtocolDetail}
          loading={isLoading}
        >
          Refresh
        </Button>
      </Space>

      {protocol && (
        <>
          <Title level={2} style={{ marginBottom: 4 }}>
            {protocol.title}
          </Title>

          <Paragraph>{protocol.purpose || "No purpose provided."}</Paragraph>

          <Descriptions bordered column={2}>
            <Descriptions.Item label="Version">
              v{protocol.version}
            </Descriptions.Item>

            <Descriptions.Item label="Approval Status">
              <Tag color={APPROVAL_STATUS_COLORS[protocol.approvalStatus]}>
                {formatLabel(protocol.approvalStatus)}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Project">
              {protocol.project ? (
                <Link to={`/projects/${protocol.project.id}`}>
                  {protocol.project.title}
                </Link>
              ) : (
                "Not linked"
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Created By">
              {protocol.createdBy?.name || "Unknown"}
            </Descriptions.Item>

            <Descriptions.Item label="Approved By">
              {protocol.approvedBy?.name || "Not approved"}
            </Descriptions.Item>

            <Descriptions.Item label="Approved At">
              {formatDate(protocol.approvedAt)}
            </Descriptions.Item>

            <Descriptions.Item label="Created At">
              {formatDateTime(protocol.createdAt)}
            </Descriptions.Item>

            <Descriptions.Item label="Updated At">
              {formatDateTime(protocol.updatedAt)}
            </Descriptions.Item>
          </Descriptions>

          <Card title="Protocol Content" style={{ marginTop: 24 }}>
            <Text>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  fontFamily: "inherit",
                }}
              >
                {protocol.content}
              </pre>
            </Text>
          </Card>
        </>
      )}
    </Card>
  );
};

export default ProtocolDetailPage;
