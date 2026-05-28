import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ExperimentOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Link } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchExperiments } from "../api/experimentApi";
import { fetchProtocols } from "../api/protocolApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  APPROVAL_STATUS_COLORS,
  EXPERIMENT_STATUS_COLORS,
  REVIEW_STATUS_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph } = Typography;

const ReviewQueuePage = () => {
  const [pendingExperiments, setPendingExperiments] = useState([]);
  const [changesRequestedExperiments, setChangesRequestedExperiments] =
    useState([]);
  const [pendingProtocols, setPendingProtocols] = useState([]);
  const [changesRequestedProtocols, setChangesRequestedProtocols] = useState(
    [],
  );

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      ] = await Promise.all([
        fetchExperiments({ reviewStatus: "pending" }),
        fetchExperiments({ reviewStatus: "changes_requested" }),
        fetchProtocols({ approvalStatus: "pending_review" }),
        fetchProtocols({ approvalStatus: "changes_requested" }),
      ]);

      setPendingExperiments(pendingExperimentResult.data.experiments);
      setChangesRequestedExperiments(
        changesRequestedExperimentResult.data.experiments,
      );
      setPendingProtocols(pendingProtocolResult.data.protocols);
      setChangesRequestedProtocols(
        changesRequestedProtocolResult.data.protocols,
      );
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load review queue.";

      setErrorMessage(messageText);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const totalReviewCount = experimentReviewCount + protocolReviewCount;

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
        width: 100,
        render: (_, record) => (
          <Link to={`/experiments/${record.id}`}>
            <Button size="small">View</Button>
          </Link>
        ),
      },
    ],
    [],
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
        width: 100,
        render: (_, record) => (
          <Link to={`/protocols/${record.id}`}>
            <Button size="small">View</Button>
          </Link>
        ),
      },
    ],
    [],
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
              Review experiments and protocols that are pending review or need
              changes.
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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Review Items"
              value={totalReviewCount}
              prefix={<WarningOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Experiments Pending"
              value={pendingExperiments.length}
              prefix={<ExperimentOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Protocols Pending"
              value={pendingProtocols.length}
              prefix={<FileTextOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
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
        </Col>
      </Row>

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
    </Space>
  );
};

export default ReviewQueuePage;
