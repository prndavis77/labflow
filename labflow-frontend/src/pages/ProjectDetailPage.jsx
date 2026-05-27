import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchProjectById } from "../api/projectApi";
import { fetchTasks } from "../api/taskApi";
import { fetchExperiments } from "../api/experimentApi";
import { fetchProtocols } from "../api/protocolApi";
import { fetchEquipmentBookings } from "../api/equipmentBookingApi";
import { fetchNotebookEntries } from "../api/notebookEntryApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";

import {
  APPROVAL_STATUS_COLORS,
  BOOKING_STATUS_COLORS,
  EXPERIMENT_STATUS_COLORS,
  NOTEBOOK_ENTRY_TYPE_COLORS,
  PROJECT_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph } = Typography;

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notebookEntries, setNotebookEntries] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Loads the selected project and all related project records.
  const loadProjectDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      // Fetch related records in parallel because none of these requests depends on the others
      const [
        projectResult,
        tasksResult,
        experimentsResult,
        protocolsResult,
        bookingsResult,
        notebookEntriesResult,
      ] = await Promise.all([
        fetchProjectById(id),
        fetchTasks({ projectId: id }),
        fetchExperiments({ projectId: id }),
        fetchProtocols({ projectId: id }),
        fetchEquipmentBookings({ projectId: id }),
        fetchNotebookEntries({ projectId: id }),
      ]);

      setProject(projectResult.data.project);
      setTasks(tasksResult.data.tasks);
      setExperiments(experimentsResult.data.experiments);
      setProtocols(protocolsResult.data.protocols);
      setBookings(bookingsResult.data.bookings);
      setNotebookEntries(notebookEntriesResult.data.notebookEntries);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load project details.";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Load project detail data after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadProjectDetail();
    });
  }, [loadProjectDetail]);

  // Columns for project-linked tasks
  const taskColumns = useMemo(
    () => [
      {
        title: "Task",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <Link to={`/tasks/${record.id}`}>
            <strong>{title}</strong>
            {record.description && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.description}
              </div>
            )}
          </Link>
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
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status) => (
          <Tag color={TASK_STATUS_COLORS[status]}>{formatLabel(status)}</Tag>
        ),
      },
      {
        title: "Priority",
        dataIndex: "priority",
        key: "priority",
        width: 120,
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

  // Columns for project-linked experiments.
  const experimentColumns = useMemo(
    () => [
      {
        title: "Experiment",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <Link to={`/experiments/${record.id}`}>
            <strong>{title}</strong>
            {record.objective && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.objective}
              </div>
            )}
          </Link>
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
        width: 160,
        render: (reviewStatus) => <Tag>{formatLabel(reviewStatus)}</Tag>,
      },
    ],
    [],
  );

  // Columns for project-linked protocols
  const protocolColumns = useMemo(
    () => [
      {
        title: "Protocol",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <Link to={`/protocols/${record.id}`}>
            <strong>{title}</strong>
            {record.purpose && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.purpose}
              </div>
            )}
          </Link>
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
    ],
    [],
  );

  // Columns for project-linked equipment bookings
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
              {record.equipment?.name || "No equipment"}
            </div>
          </div>
        ),
      },
      {
        title: "User",
        dataIndex: "user",
        key: "user",
        width: 150,
        render: (bookingUser) => bookingUser?.name || "Unknown",
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
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status) => (
          <Tag color={BOOKING_STATUS_COLORS[status]}>{formatLabel(status)}</Tag>
        ),
      },
    ],
    [],
  );

  // Columns for project-linked notebook entries
  // These entries come from experiments that belong to the current project
  const notebookEntryColumns = useMemo(
    () => [
      {
        title: "Notebook Entry",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <strong>{title}</strong>

            {record.content && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.content.length > 160
                  ? `${record.content.slice(0, 160)}...`
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
        width: 170,
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
        width: 260,
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
        width: 180,
        render: (author) => author?.name || "Unknown",
      },
      {
        title: "Created",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 170,
        render: formatDateTime,
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
          onClick={() => navigate("/projects")}
          style={{ marginTop: 16 }}
        >
          Back to Projects
        </Button>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card loading={isLoading && !project}>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/projects")}
          >
            Back to Projects
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadProjectDetail}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Space>

        {project ? (
          <>
            <Title level={2} style={{ marginBottom: 4 }}>
              {project.title}
            </Title>

            <Paragraph>
              {project.description || "No description provided."}
            </Paragraph>

            <Descriptions bordered column={2}>
              <Descriptions.Item label="Status">
                <Tag color={PROJECT_STATUS_COLORS[project.status]}>
                  {formatLabel(project.status)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Supervisor">
                {project.supervisor?.name || "Not assigned"}
              </Descriptions.Item>

              <Descriptions.Item label="Start Date">
                {formatDate(project.startDate)}
              </Descriptions.Item>

              <Descriptions.Item label="Target End Date">
                {formatDate(project.targetEndDate)}
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                {formatDateTime(project.createdAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Updated At">
                {formatDateTime(project.updatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="Project not found" />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Project Tasks">
            <Table
              rowKey="id"
              columns={taskColumns}
              dataSource={tasks}
              loading={isLoading}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Project Experiments">
            <Table
              rowKey="id"
              columns={experimentColumns}
              dataSource={experiments}
              loading={isLoading}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Recent Notebook Entries">
            {notebookEntries.length === 0 ? (
              <Empty description="No notebook entries recorded for this project yet." />
            ) : (
              <Table
                rowKey="id"
                columns={notebookEntryColumns}
                dataSource={notebookEntries}
                loading={isLoading}
                pagination={{ pageSize: 5, showSizeChanger: false }}
                size="small"
              />
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Project Protocols">
            <Table
              rowKey="id"
              columns={protocolColumns}
              dataSource={protocols}
              loading={isLoading}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Project Equipment Bookings">
            <Table
              rowKey="id"
              columns={bookingColumns}
              dataSource={bookings}
              loading={isLoading}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
              scroll={{ x: 1000 }}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default ProjectDetailPage;
