import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import dayjs from "dayjs";

import {
  createEquipment,
  deleteEquipment,
  fetchEquipment,
  updateEquipment,
} from "../api/equipmentApi";
import {
  createEquipmentBooking,
  deleteEquipmentBooking,
  fetchEquipmentBookings,
  updateEquipmentBooking,
} from "../api/equipmentBookingApi";
import { fetchProjects } from "../api/projectApi";
import { fetchExperiments } from "../api/experimentApi";
import { fetchUsers } from "../api/userApi";
import { useAuth } from "../context/AuthContext";
import { EQUIPMENT_STATUS_OPTIONS } from "../constants/statusOptions";
import { EQUIPMENT_STATUS_COLORS } from "../constants/statusColors";
import { BOOKING_STATUS_OPTIONS } from "../constants/statusOptions";
import { BOOKING_STATUS_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// Formats ISO date strings for table display.
function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }

  return dayjs(value).format("YYYY-MM-DD HH:mm");
}

const EqipmentPage = () => {
  const { user } = useAuth();

  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [users, setUsers] = useState([]);

  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingExperiments, setIsLoadingExperiments] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [equipmentErrorMessage, setEquipmentErrorMessage] = useState("");
  const [bookingErrorMessage, setBookingErrorMessage] = useState("");

  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const [editingEquipment, setEditingEquipment] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState(undefined);
  const [selectedBookingStatus, setSelectedBookingStatus] = useState(undefined);

  const [equipmentForm] = Form.useForm();
  const [bookingForm] = Form.useForm();

  // Watches the selected project inside the booking form
  // This allows the experiment dropdown to update immediately
  const selectedBookingFormProjectId = Form.useWatch("projectId", bookingForm);

  // Only admins and supervisors can manage the equipment inventory
  const canManageEquipment = ["admin", "supervisor"].includes(user?.role);

  // Only admins and supervisors can delete bookings for now
  const canDeleteBookings = ["admin", "supervisor"].includes(user?.role);

  // Converts equipment into options for Select components
  const equipmentOptions = useMemo(() => {
    return equipment.map((item) => ({
      label: `${item.name} (${item.type})`,
      value: item.id,
    }));
  }, [equipment]);

  // Converts available equipment into options for booking creation
  const availableEquipmentOptions = useMemo(() => {
    return equipment
      .filter((item) => item.status === "available")
      .map((item) => ({
        label: `${item.name} (${item.type})`,
        value: item.id,
      }));
  }, [equipment]);

  // Converts projects into options for Select components
  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  // Converts users into options for booking ownership.
  const userOptions = useMemo(() => {
    return users.map((userItem) => ({
      label: `${userItem.name} (${userItem.role})`,
      value: userItem.id,
    }));
  }, [users]);

  // Converts experiments into options
  // If a project is selected in the form, narrow experiments to that project
  const experimentOptions = useMemo(() => {
    return experiments
      .filter((experiment) => {
        if (!selectedBookingFormProjectId) {
          return true;
        }

        return (
          Number(experiment.projectId) === Number(selectedBookingFormProjectId)
        );
      })
      .map((experiment) => ({
        label: experiment.title,
        value: experiment.id,
      }));
  }, [experiments, selectedBookingFormProjectId]);

  // Builds filters for equipment booking queries
  const bookingFilters = useMemo(() => {
    const filters = {};

    if (selectedEquipmentId) {
      filters.equipmentId = selectedEquipmentId;
    }

    if (selectedBookingStatus) {
      filters.status = selectedBookingStatus;
    }

    return filters;
  }, [selectedEquipmentId, selectedBookingStatus]);

  // Loads equipment inventory from the backend
  const loadEquipment = useCallback(async () => {
    try {
      setIsLoadingEquipment(true);
      setEquipmentErrorMessage("");

      const result = await fetchEquipment();

      setEquipment(result.data.equipment);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load equipment.";

      setEquipmentErrorMessage(messageText);
    } finally {
      setIsLoadingEquipment(false);
    }
  }, []);

  // Loads equipment bookings from the backend using current filters
  const loadBookings = useCallback(async () => {
    try {
      setIsLoadingBookings(true);
      setBookingErrorMessage("");

      const result = await fetchEquipmentBookings(bookingFilters);

      setBookings(result.data.bookings);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load equipment bookings.";

      setBookingErrorMessage(messageText);
    } finally {
      setIsLoadingBookings(false);
    }
  }, [bookingFilters]);

  // Loads projects for booking linkage
  const loadProjects = useCallback(async () => {
    try {
      setIsLoadingProjects(true);

      const result = await fetchProjects();

      setProjects(result.data.projects);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load projects.";

      message.error(messageText);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Loads experiments for optional booking linkage
  const loadExperiments = useCallback(async () => {
    try {
      setIsLoadingExperiments(true);

      const result = await fetchExperiments();

      setExperiments(result.data.experiments);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load experiments.";

      message.error(messageText);
    } finally {
      setIsLoadingExperiments(false);
    }
  }, []);

  // Loads users so bookings can be assigned to a user
  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);

      const result = await fetchUsers();

      setUsers(result.data.users);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load users.";

      message.error(messageText);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Load dropdown and inventory data after first render
  useEffect(() => {
    queueMicrotask(() => {
      loadEquipment();
      loadProjects();
      loadExperiments();
      loadUsers();
    });
  }, [loadEquipment, loadProjects, loadExperiments, loadUsers]);

  // Reload bookings whenever booking filters change
  useEffect(() => {
    queueMicrotask(() => {
      loadBookings();
    });
  }, [loadBookings]);

  const openCreateEquipmentModal = () => {
    setEditingEquipment(null);

    // Reset form state so old edit values do not appear
    equipmentForm.resetFields();

    // Give new equipment a sensible default status
    equipmentForm.setFieldsValue({
      status: "available",
    });

    setIsEquipmentModalOpen(true);
  };

  const openEditEquipmentModal = useCallback(
    (item) => {
      setEditingEquipment(item);

      // Fill the form with the selected equipment values.
      equipmentForm.setFieldsValue({
        name: item.name,
        type: item.type,
        location: item.location,
        status: item.status,
        notes: item.notes,
      });

      setIsEquipmentModalOpen(true);
    },
    [equipmentForm],
  );

  const closeEquipmentModal = () => {
    setIsEquipmentModalOpen(false);
    setEditingEquipment(null);
    equipmentForm.resetFields();
  };

  const handleEquipmentSubmit = async (values) => {
    try {
      setIsSubmitting(true);

      // Convert form values into the format expected by the backend.
      const payload = {
        name: values.name,
        type: values.type,
        location: values.location,
        status: values.status,
        notes: values.notes,
      };
      if (editingEquipment) {
        await updateEquipment(editingEquipment.id, payload);
        message.success("Equipment updated successfully.");
      } else {
        await createEquipment(payload);
        message.success("Equipment created successfully.");
      }

      closeEquipmentModal();
      await loadEquipment();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save equipment.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEquipment = useCallback(
    async (equipmentId) => {
      try {
        await deleteEquipment(equipmentId);

        message.success("Equipment deleted successfully.");

        await loadEquipment();
        await loadBookings();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete equipment.";

        message.error(messageText);
      }
    },
    [loadEquipment, loadBookings],
  );

  const openCreateBookingModal = () => {
    setEditingBooking(null);

    // Reset form state so old edit values do not appear
    bookingForm.resetFields();

    // Give new bookings sensible default values
    bookingForm.setFieldsValue({
      status: "confirmed",
      userId: user?.id,
      equipmentId: selectedEquipmentId || undefined,
    });

    setIsBookingModalOpen(true);
  };

  const openEditBookingModal = useCallback(
    (booking) => {
      setEditingBooking(booking);

      // RangePicker expects an array of dayjs objects.
      bookingForm.setFieldsValue({
        title: booking.title,
        equipmentId: booking.equipmentId,
        userId: booking.userId,
        status: booking.status,
        purpose: booking.purpose,
        projectId: booking.projectId || undefined,
        experimentId: booking.experimentId || undefined,
        timeRange: [dayjs(booking.startTime), dayjs(booking.endTime)],
      });

      setIsBookingModalOpen(true);
    },
    [bookingForm],
  );

  const closeBookingModal = () => {
    setIsBookingModalOpen(false);
    setEditingBooking(null);
    bookingForm.resetFields();
  };

  const handleBookingProjectChange = (projectId) => {
    // Changing project clears experiment because old experiment may belong to another project
    bookingForm.setFieldsValue({
      projectId,
      experimentId: undefined,
    });
  };

  const handleBookingSubmit = async (values) => {
    try {
      setIsSubmitting(true);

      const [startTime, endTime] = values.timeRange || [];

      // Convert form values into the format expected by the backend.
      const payload = {
        title: values.title,
        equipmentId: values.equipmentId,
        userId: values.userId,
        status: values.status,
        purpose: values.purpose,
        projectId: values.projectId || null,
        experimentId: values.experimentId || null,
        startTime: startTime ? startTime.toISOString() : null,
        endTime: endTime ? endTime.toISOString() : null,
      };

      if (editingBooking) {
        await updateEquipmentBooking(editingBooking.id, payload);
        message.success("Booking updated successfully.");
      } else {
        await createEquipmentBooking(payload);
        message.success("Booking created successfully.");
      }

      closeBookingModal();
      await loadBookings();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save booking.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBooking = useCallback(
    async (bookingId) => {
      try {
        await deleteEquipmentBooking(bookingId);

        message.success("Booking deleted successfully.");

        await loadBookings();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete booking.";

        message.error(messageText);
      }
    },
    [loadBookings],
  );

  // Equipment table columns
  const equipmentColumns = useMemo(() => {
    const baseColumns = [
      {
        title: "Equipment",
        dataIndex: "name",
        key: "name",
        render: (name, record) => (
          <div>
            <Link to={`/equipment/${record.id}`}>
              <strong>{name}</strong>
            </Link>

            {record.notes && (
              <div style={{ color: "#666", marginTop: 4 }}>{record.notes}</div>
            )}
          </div>
        ),
      },
      {
        title: "Type",
        dataIndex: "type",
        key: "type",
        width: 160,
      },
      {
        title: "Location",
        dataIndex: "location",
        key: "location",
        width: 220,
        render: (value) => value || "Not set",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 150,
        render: (status) => (
          <Tag color={EQUIPMENT_STATUS_COLORS[status]}>
            {formatLabel(status)}
          </Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: canManageEquipment ? 220 : 90,
        render: (_, record) => (
          <Space>
            <Link to={`/equipment/${record.id}`}>
              <Button size="small">View</Button>
            </Link>

            {canManageEquipment && (
              <>
                <Button
                  size="small"
                  onClick={() => openEditEquipmentModal(record)}
                >
                  Edit
                </Button>

                <Popconfirm
                  title="Delete equipment?"
                  description="This can affect existing bookings."
                  okText="Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDeleteEquipment(record.id)}
                >
                  <Button size="small" danger>
                    Delete
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        ),
      },
    ];

    return baseColumns;
  }, [canManageEquipment, handleDeleteEquipment, openEditEquipmentModal]);

  // Booking table columns
  const bookingColumns = useMemo(() => {
    const baseColumns = [
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
        title: "Equipment",
        dataIndex: "equipment",
        key: "equipment",
        width: 220,
        render: (item) =>
          item ? (
            <Link to={`/equipment/${item.id}`}>{item.name}</Link>
          ) : (
            "Not linked"
          ),
      },
      {
        title: "User",
        dataIndex: "user",
        key: "user",
        width: 180,
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
      {
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 220,
        render: (project) => project?.title || "Not linked",
      },
      {
        title: "Experiment",
        dataIndex: "experiment",
        key: "experiment",
        width: 220,
        render: (experiment) => experiment?.title || "Not linked",
      },
      {
        title: "Actions",
        key: "actions",
        width: canDeleteBookings ? 180 : 90,
        render: (_, record) => (
          <Space>
            <Button size="small" onClick={() => openEditBookingModal(record)}>
              Edit
            </Button>

            {canDeleteBookings && (
              <Popconfirm
                title="Delete booking?"
                description="This cannot be undone."
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDeleteBooking(record.id)}
              >
                <Button size="small" danger>
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ];

    return baseColumns;
  }, [canDeleteBookings, handleDeleteBooking, openEditBookingModal]);

  return (
    <>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              Equipment
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Manage shared lab instruments and schedule equipment bookings.
            </Paragraph>
          </div>
        </div>

        <Tabs
          items={[
            {
              key: "equipment",
              label: "Equipment Inventory",
              children: (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 16,
                    }}
                  >
                    <Space>
                      <Button onClick={loadEquipment}>Refresh</Button>
                    </Space>

                    {canManageEquipment && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreateEquipmentModal}
                      >
                        New Equipment
                      </Button>
                    )}
                  </div>

                  {equipmentErrorMessage && (
                    <Alert
                      type="error"
                      message={equipmentErrorMessage}
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Table
                    rowKey="id"
                    columns={equipmentColumns}
                    dataSource={equipment}
                    loading={isLoadingEquipment}
                    pagination={{
                      pageSize: 8,
                      showSizeChanger: false,
                    }}
                  />
                </>
              ),
            },
            {
              key: "bookings",
              label: "Bookings",
              children: (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    <Space wrap>
                      <Select
                        allowClear
                        placeholder="Filter by equipment"
                        style={{ width: 300 }}
                        options={equipmentOptions}
                        value={selectedEquipmentId}
                        onChange={setSelectedEquipmentId}
                        loading={isLoadingEquipment}
                      />

                      <Select
                        allowClear
                        placeholder="Filter by status"
                        style={{ width: 180 }}
                        options={BOOKING_STATUS_OPTIONS}
                        value={selectedBookingStatus}
                        onChange={setSelectedBookingStatus}
                      />

                      <Button onClick={loadBookings}>Refresh</Button>
                    </Space>

                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openCreateBookingModal}
                    >
                      New Booking
                    </Button>
                  </div>

                  {bookingErrorMessage && (
                    <Alert
                      type="error"
                      message={bookingErrorMessage}
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Table
                    rowKey="id"
                    columns={bookingColumns}
                    dataSource={bookings}
                    loading={isLoadingBookings}
                    pagination={{
                      pageSize: 8,
                      showSizeChanger: false,
                    }}
                    scroll={{
                      x: 1500,
                    }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingEquipment ? "Edit Equipment" : "Create Equipment"}
        open={isEquipmentModalOpen}
        onCancel={closeEquipmentModal}
        footer={null}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={equipmentForm}
          onFinish={handleEquipmentSubmit}
        >
          <Form.Item
            label="Equipment Name"
            name="name"
            rules={[
              {
                required: true,
                message: "Please enter the equipment name.",
              },
            ]}
          >
            <Input placeholder="HPLC Agilent 1260" />
          </Form.Item>

          <Form.Item
            label="Equipment Type"
            name="type"
            rules={[
              {
                required: true,
                message: "Please enter the equipment type.",
              },
            ]}
          >
            <Input placeholder="HPLC" />
          </Form.Item>

          <Form.Item label="Location" name="location">
            <Input placeholder="Analytical Lab Room 203" />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[
              {
                required: true,
                message: "Please select equipment status.",
              },
            ]}
          >
            <Select options={EQUIPMENT_STATUS_OPTIONS} />
          </Form.Item>

          <Form.Item label="Notes" name="notes">
            <TextArea
              rows={4}
              placeholder="Add maintenance notes, usage restrictions, or instrument details."
            />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeEquipmentModal}>Cancel</Button>

            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              {editingEquipment ? "Save Changes" : "Create Equipment"}
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingBooking ? "Edit Booking" : "Create Booking"}
        open={isBookingModalOpen}
        onCancel={closeBookingModal}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form
          layout="vertical"
          form={bookingForm}
          onFinish={handleBookingSubmit}
        >
          <Form.Item
            label="Booking Title"
            name="title"
            rules={[
              {
                required: true,
                message: "Please enter a booking title.",
              },
              {
                min: 3,
                message: "Booking title must be at least 3 characters.",
              },
            ]}
          >
            <Input placeholder="Caffeine calibration curve run" />
          </Form.Item>

          <Form.Item
            label="Equipment"
            name="equipmentId"
            rules={[
              {
                required: true,
                message: "Please select equipment.",
              },
            ]}
          >
            <Select
              placeholder="Select available equipment"
              loading={isLoadingEquipment}
              options={
                editingBooking ? equipmentOptions : availableEquipmentOptions
              }
            />
          </Form.Item>

          <Form.Item
            label="Booked By"
            name="userId"
            rules={[
              {
                required: true,
                message: "Please select the booking user.",
              },
            ]}
          >
            <Select
              placeholder="Select user"
              loading={isLoadingUsers}
              options={userOptions}
            />
          </Form.Item>

          <Form.Item
            label="Time Range"
            name="timeRange"
            rules={[
              {
                required: true,
                message: "Please select booking start and end time.",
              },
            ]}
          >
            <RangePicker
              showTime
              style={{ width: "100%" }}
              format="YYYY-MM-DD HH:mm"
            />
          </Form.Item>

          <Form.Item
            label="Booking Status"
            name="status"
            rules={[
              {
                required: true,
                message: "Please select booking status.",
              },
            ]}
          >
            <Select options={BOOKING_STATUS_OPTIONS} />
          </Form.Item>

          <Form.Item label="Project" name="projectId">
            <Select
              allowClear
              placeholder="Optionally link project"
              loading={isLoadingProjects}
              options={projectOptions}
              onChange={handleBookingProjectChange}
            />
          </Form.Item>

          <Form.Item label="Experiment" name="experimentId">
            <Select
              allowClear
              placeholder="Optionally link experiment"
              loading={isLoadingExperiments}
              options={experimentOptions}
            />
          </Form.Item>

          <Form.Item label="Purpose" name="purpose">
            <TextArea
              rows={4}
              placeholder="Explain why the equipment is being booked and what work will be performed."
            />
          </Form.Item>

          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={closeBookingModal}>Cancel</Button>

            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              {editingBooking ? "Save Changes" : "Create Booking"}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default EqipmentPage;
