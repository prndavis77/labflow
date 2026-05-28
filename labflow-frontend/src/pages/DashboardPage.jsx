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
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  ProjectOutlined,
  ReloadOutlined,
  RightOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import dayjs from "dayjs";

import { fetchDashboardSummary } from "../api/dashboardApi";
import { useAuth } from "../context/AuthContext";
import {
  APPROVAL_STATUS_COLORS,
  NOTEBOOK_ENTRY_TYPE_COLORS,
  REVIEW_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
} from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;

// Formats ISO date strings for readable dashboard display
function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }

  return dayjs(value).format("YYYY-MM-DD HH:mm");
}

// Formats date-only values for readable dashboard display
function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return dayjs(value).format("YYYY-MM-DD");
}

const DashboardPage = () => {
  const { user } = useAuth();

  // Only admins and supervisors should see direct review queue shortcuts
  const canAccessReviewQueue = ["admin", "supervisor"].includes(user?.role);

  const [dashboardData, setDashboardData] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Loads dashboard summary data from the backend
  const loadDashboardSummary = useCallback(async () => {
    try {
      setIsLoadingDashboard(true);
      setErrorMessage("");

      const result = await fetchDashboardSummary();

      setDashboardData(result.data);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load dashboard summary.";

      setErrorMessage(message);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  // Load dashboard data after the first render
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadDashboardSummary();
    });
  }, [loadDashboardSummary]);

  // Provide safe defaults so the UI can render before the API returns
  const metrics = dashboardData?.metrics || {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    openTasks: 0,
    overdueTasks: 0,
    experimentsNeedingReview: 0,
    pendingProtocols: 0,
    totalEquipment: 0,
    unavailableEquipment: 0,
    equipmentInUseNow: 0,
    upcomingBookings: 0,
  };

  // Provide safe defaults for dashboard lists
  const lists = dashboardData?.lists || {
    tasksDueSoon: [],
    experimentsNeedingReview: [],
    pendingProtocols: [],
    upcomingBookings: [],
    recentProjects: [],
    recentTasks: [],
    recentExperiments: [],
    recentNotebookEntries: [],
  };

  // Combines the main review-related dashboard counts into one attention number
  const reviewAttentionCount =
    metrics.experimentsNeedingReview + metrics.pendingProtocols;

  // Columns for upcoming task summaries
  const taskColumns = useMemo(
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

            <div style={{ color: "#666", marginTop: 4 }}>
              {record.project?.title || "No project"}
            </div>
          </div>
        ),
      },
      {
        title: "Assigned To",
        dataIndex: "assignedTo",
        key: "assignedTo",
        width: 160,
        render: (assignedTo) => assignedTo?.name || "Unassigned",
      },
      {
        title: "Priority",
        dataIndex: "priority",
        key: "priority",
        width: 110,
        render: (priority) => (
          <Tag color={TASK_PRIORITY_COLORS[priority]}>
            {formatLabel(priority)}
          </Tag>
        ),
      },
      {
        title: "Due",
        dataIndex: "dueDate",
        key: "dueDate",
        width: 120,
        render: formatDate,
      },
    ],
    [],
  );

  // Columns for experiment review summaries
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

            <div style={{ color: "#666", marginTop: 4 }}>
              {record.project ? (
                <Link to={`/projects/${record.project.id}`}>
                  {record.project.title}
                </Link>
              ) : (
                "No project"
              )}
            </div>
          </div>
        ),
      },
      {
        title: "Researcher",
        dataIndex: "researcher",
        key: "researcher",
        width: 160,
        render: (researcher) => researcher?.name || "Not assigned",
      },
      {
        title: "Review",
        dataIndex: "reviewStatus",
        key: "reviewStatus",
        width: 160,
        render: (reviewStatus) => (
          <Tag color={REVIEW_STATUS_COLORS[reviewStatus]}>
            {formatLabel(reviewStatus)}
          </Tag>
        ),
      },
      {
        title: "Action",
        key: "action",
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

  // Columns for recent notebook entry summaries
  const notebookEntryColumns = useMemo(
    () => [
      {
        title: "Notebook Entry",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            {record.experiment ? (
              <Link to={`/experiments/${record.experiment.id}`}>
                <strong>{title}</strong>
              </Link>
            ) : (
              <strong>{title}</strong>
            )}

            {record.content && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.content.length > 140
                  ? `${record.content.slice(0, 140)}...`
                  : record.content}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Type",
        dataIndex: "entryType",
        key: "entryType",
        width: 160,
        render: (entryType) => (
          <Tag color={NOTEBOOK_ENTRY_TYPE_COLORS[entryType]}>
            {formatLabel(entryType)}
          </Tag>
        ),
      },
      {
        title: "Experiment",
        dataIndex: "experiment",
        key: "experiment",
        width: 240,
        render: (experiment) =>
          experiment ? (
            <Link to={`/experiments/${experiment.id}`}>{experiment.title}</Link>
          ) : (
            "Not linked"
          ),
      },
      {
        title: "Author",
        dataIndex: "author",
        key: "author",
        width: 160,
        render: (author) => author?.name || "Unknown",
      },
      {
        title: "Updated",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 160,
        render: formatDateTime,
      },
    ],
    [],
  );

  // Columns for protocol review summaries
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
            </Link>{" "}
            · v{record.version}
            <div style={{ color: "#666", marginTop: 4 }}>
              {record.project ? (
                <Link to={`/projects/${record.project.id}`}>
                  {record.project.title}
                </Link>
              ) : (
                "General / Not linked"
              )}
            </div>
          </div>
        ),
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
        title: "Action",
        key: "action",
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

  // Columns for upcoming equipment booking summaries
  const bookingColumns = useMemo(
    () => [
      {
        title: "Booking",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <strong>{title}</strong>
            <div style={{ color: "#666", marginTop: 4 }}>
              {record.equipment ? (
                <Link to={`/equipment/${record.equipment.id}`}>
                  {record.equipment.name}
                </Link>
              ) : (
                "No equipment"
              )}{" "}
              · {record.user?.name || "Unknown user"}
            </div>
          </div>
        ),
      },
      {
        title: "Start",
        dataIndex: "startTime",
        key: "startTime",
        width: 160,
        render: formatDateTime,
      },
      {
        title: "End",
        dataIndex: "endTime",
        key: "endTime",
        width: 160,
        render: formatDateTime,
      },
    ],
    [],
  );
  // Columns for recent project summaries
  const recentProjectColumns = useMemo(
    () => [
      {
        title: "Project",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <Link to={`/projects/${record.id}`}>
              <strong>{title}</strong>
            </Link>

            <div style={{ color: "#666", marginTop: 4 }}>
              Supervisor: {record.supervisor?.name || "Not assigned"}
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status) => <Tag>{formatLabel(status)}</Tag>,
      },
      {
        title: "Target End",
        dataIndex: "targetEndDate",
        key: "targetEndDate",
        width: 130,
        render: formatDate,
      },
    ],
    [],
  );

  // Columns for recent task summaries
  const recentTaskColumns = useMemo(
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

            <div style={{ color: "#666", marginTop: 4 }}>
              {record.project?.title || "No project"}
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status) => (
          <Tag color={TASK_STATUS_COLORS[status]}>{formatLabel(status)}</Tag>
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
              Dashboard
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Welcome back, {user?.name}. Here is the current overview of lab
              projects, tasks, experiments, protocols, and equipment bookings.
            </Paragraph>
          </div>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadDashboardSummary}
            loading={isLoadingDashboard}
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
              title="Active Projects"
              value={metrics.activeProjects}
              prefix={<ProjectOutlined />}
              suffix={`/ ${metrics.totalProjects}`}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Open Tasks"
              value={metrics.openTasks}
              prefix={<ClockCircleOutlined />}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Overdue Tasks"
              value={metrics.overdueTasks}
              prefix={<WarningOutlined />}
              valueStyle={{
                color: metrics.overdueTasks > 0 ? "#cf1322" : undefined,
              }}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Review Attention"
              value={reviewAttentionCount}
              prefix={<AuditOutlined />}
              valueStyle={{
                color: reviewAttentionCount > 0 ? "#fa8c16" : undefined,
              }}
              loading={isLoadingDashboard}
            />

            {canAccessReviewQueue && (
              <Link to="/review">
                <Button
                  type={reviewAttentionCount > 0 ? "primary" : "default"}
                  size="small"
                  icon={<RightOutlined />}
                  style={{ marginTop: 12 }}
                >
                  Open Review Queue
                </Button>
              </Link>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Experiments Needing Review"
              value={metrics.experimentsNeedingReview}
              prefix={<ExperimentOutlined />}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending Protocols"
              value={metrics.pendingProtocols}
              prefix={<FileTextOutlined />}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Upcoming Bookings"
              value={metrics.upcomingBookings}
              prefix={<CalendarOutlined />}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Instrument Total"
              value={metrics.totalEquipment}
              prefix={<ToolOutlined />}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Instruments In Use Now"
              value={metrics.equipmentInUseNow}
              prefix={<ToolOutlined />}
              valueStyle={{
                color: metrics.equipmentInUseNow > 0 ? "#1677ff" : undefined,
              }}
              loading={isLoadingDashboard}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          {metrics.unavailableEquipment > 0 && (
            <Card>
              <Statistic
                title="Instruments Offline"
                value={metrics.unavailableEquipment}
                prefix={<WarningOutlined />}
                valueStyle={{
                  color:
                    metrics.unavailableEquipment > 0 ? "#fa8c16" : undefined,
                }}
                loading={isLoadingDashboard}
              />
            </Card>
          )}
        </Col>
      </Row>

      {canAccessReviewQueue && reviewAttentionCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Review items need attention"
          description={
            <span>
              There are {reviewAttentionCount} experiment or protocol review
              items waiting for action.{" "}
              <Link to="/review">Open the Review Queue</Link> to approve items
              or request changes.
            </span>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Tasks Due Soon">
            {lists.tasksDueSoon.length === 0 ? (
              <Empty description="No upcoming tasks" />
            ) : (
              <Table
                rowKey="id"
                columns={taskColumns}
                dataSource={lists.tasksDueSoon}
                loading={isLoadingDashboard}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Experiments Needing Review"
            extra={
              canAccessReviewQueue ? (
                <Link to="/review">
                  <Button size="small">Open Review Queue</Button>
                </Link>
              ) : null
            }
          >
            {lists.experimentsNeedingReview.length === 0 ? (
              <Empty description="No experiments need review" />
            ) : (
              <Table
                rowKey="id"
                columns={experimentColumns}
                dataSource={lists.experimentsNeedingReview}
                loading={isLoadingDashboard}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Protocols Pending Review"
            extra={
              canAccessReviewQueue ? (
                <Link to="/review">
                  <Button size="small">Open Review Queue</Button>
                </Link>
              ) : null
            }
          >
            {lists.pendingProtocols.length === 0 ? (
              <Empty description="No protocols pending review" />
            ) : (
              <Table
                rowKey="id"
                columns={protocolColumns}
                dataSource={lists.pendingProtocols}
                loading={isLoadingDashboard}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="Upcoming Equipment Bookings">
            {lists.upcomingBookings.length === 0 ? (
              <Empty description="No upcoming bookings" />
            ) : (
              <Table
                rowKey="id"
                columns={bookingColumns}
                dataSource={lists.upcomingBookings}
                loading={isLoadingDashboard}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Recent Projects">
            {lists.recentProjects.length === 0 ? (
              <Empty description="No recent projects" />
            ) : (
              <Table
                rowKey="id"
                columns={recentProjectColumns}
                dataSource={lists.recentProjects}
                loading={isLoadingDashboard}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="Recently Updated Tasks">
            {lists.recentTasks.length === 0 ? (
              <Empty description="No recent tasks" />
            ) : (
              <Table
                rowKey="id"
                columns={recentTaskColumns}
                dataSource={lists.recentTasks}
                loading={isLoadingDashboard}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Recently Updated Experiments">
        {lists.recentExperiments.length === 0 ? (
          <Empty description="No recent experiments" />
        ) : (
          <Table
            rowKey="id"
            columns={experimentColumns}
            dataSource={lists.recentExperiments}
            loading={isLoadingDashboard}
            pagination={false}
            size="small"
          />
        )}
      </Card>

      <Card title="Recent Notebook Entries">
        {lists.recentNotebookEntries.length === 0 ? (
          <Empty description="No recent notebook entries" />
        ) : (
          <Table
            rowKey="id"
            columns={notebookEntryColumns}
            dataSource={lists.recentNotebookEntries}
            loading={isLoadingDashboard}
            pagination={false}
            size="small"
            scroll={{
              x: 900,
            }}
          />
        )}
      </Card>

      <Card>
        <Space>
          <CheckCircleOutlined style={{ color: "#52c41a" }} />
          <span>
            Dashboard data is loaded from the backend summary endpoint, not
            calculated only in the browser.
          </span>
        </Space>
      </Card>
    </Space>
  );
};

export default DashboardPage;
