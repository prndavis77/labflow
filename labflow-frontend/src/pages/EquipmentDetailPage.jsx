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
import dayjs from "dayjs";

import { fetchEquipmentById } from "../api/equipmentApi";
import { fetchEquipmentBookings } from "../api/equipmentBookingApi";
import { fetchProtocols } from "../api/protocolApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  APPROVAL_STATUS_COLORS,
  BOOKING_STATUS_COLORS,
  EQUIPMENT_STATUS_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph } = Typography;

const EquipmentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [equipment, setEquipment] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [protocols, setProtocols] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Loads the selected equipment item, its bookings, and linked equipment SOPs
  const loadEquipmentDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      // Fetch related records in parallel.
      const [equipmentResult, bookingsResult, protocolsResult] =
        await Promise.all([
          fetchEquipmentById(id),
          fetchEquipmentBookings({ equipmentId: id }),
          fetchProtocols({ equipmentId: id }),
        ]);

      setEquipment(equipmentResult.data.equipment);
      setBookings(bookingsResult.data.bookings);
      setProtocols(protocolsResult.data.protocols);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load equipment details.";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Load equipment detail data after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadEquipmentDetail();
    });
  }, [loadEquipmentDetail]);

  // Separates future/current bookings from completed past time slots
  const upcomingBookings = useMemo(() => {
    const now = dayjs();

    return bookings.filter((booking) => {
      if (booking.status !== "confirmed") {
        return false;
      }

      return dayjs(booking.endTime).isAfter(now);
    });
  }, [bookings]);

  // Past bookings are bookings that already ended or were completed/cancelled
  const pastBookings = useMemo(() => {
    const now = dayjs();

    return bookings.filter((booking) => {
      if (booking.status === "completed" || booking.status === "cancelled") {
        return true;
      }

      return dayjs(booking.endTime).isBefore(now);
    });
  }, [bookings]);

  // Columns for upcoming and past equipment bookings
  const bookingColumns = useMemo(
    () => [
      {
        title: "Booking",
        dataIndex: "title",
        key: "title",
        render: (title, record) => (
          <div>
            <strong>{title}</strong>

            {record.purpose && (
              <div style={{ color: "#666", marginTop: 4 }}>
                {record.purpose}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "User",
        dataIndex: "user",
        key: "user",
        width: 170,
        render: (bookingUser) => bookingUser?.name || "Unknown",
      },
      {
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 240,
        render: (project) =>
          project ? (
            <Link to={`/projects/${project.id}`}>{project.title}</Link>
          ) : (
            "Not linked"
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

  // Columns for protocols linked directly to this equipment item
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
        width: 240,
        render: (project) =>
          project ? (
            <Link to={`/projects/${project.id}`}>{project.title}</Link>
          ) : (
            "General / Not linked"
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
        title: "Approved At",
        dataIndex: "approvedAt",
        key: "approvedAt",
        width: 140,
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
          onClick={() => navigate("/equipment")}
          style={{ marginTop: 16 }}
        >
          Back to Equipment
        </Button>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card loading={isLoading && !equipment}>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/equipment")}
          >
            Back to Equipment
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadEquipmentDetail}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Space>

        {equipment ? (
          <>
            <Title level={2} style={{ marginBottom: 4 }}>
              {equipment.name}
            </Title>

            <Paragraph>
              {equipment.notes || "No equipment notes provided."}
            </Paragraph>

            <Descriptions bordered column={2}>
              <Descriptions.Item label="Type">
                {equipment.type}
              </Descriptions.Item>

              <Descriptions.Item label="Status">
                <Tag color={EQUIPMENT_STATUS_COLORS[equipment.status]}>
                  {formatLabel(equipment.status)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Location">
                {equipment.location || "Not set"}
              </Descriptions.Item>

              <Descriptions.Item label="Upcoming / Active Bookings">
                {upcomingBookings.length}
              </Descriptions.Item>

              <Descriptions.Item label="Linked SOPs">
                {protocols.length}
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                {formatDateTime(equipment.createdAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Updated At">
                {formatDateTime(equipment.updatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="Equipment not found" />
        )}
      </Card>

      <Card title="Upcoming and Active Bookings">
        {upcomingBookings.length === 0 ? (
          <Empty description="No upcoming or active bookings for this equipment." />
        ) : (
          <Table
            rowKey="id"
            columns={bookingColumns}
            dataSource={upcomingBookings}
            loading={isLoading}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 1300 }}
          />
        )}
      </Card>

      <Card title="Equipment SOPs and Protocols">
        {protocols.length === 0 ? (
          <Empty description="No SOPs or protocols linked to this equipment yet." />
        ) : (
          <Table
            rowKey="id"
            columns={protocolColumns}
            dataSource={protocols}
            loading={isLoading}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 1000 }}
          />
        )}
      </Card>

      <Card title="Past Bookings">
        {pastBookings.length === 0 ? (
          <Empty description="No past bookings for this equipment yet." />
        ) : (
          <Table
            rowKey="id"
            columns={bookingColumns}
            dataSource={pastBookings}
            loading={isLoading}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            scroll={{ x: 1300 }}
          />
        )}
      </Card>
    </Space>
  );
};

export default EquipmentDetailPage;
