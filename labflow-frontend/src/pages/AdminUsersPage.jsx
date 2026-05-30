import {
  Alert,
  Button,
  Card,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchUsers, updateUserRole } from "../api/userApi";
import { USER_ROLE_OPTIONS } from "../constants/statusOptions";
import { USER_ROLE_COLORS } from "../constants/statusColors";
import { useAuth } from "../context/AuthContext";
import { formatDateTime, formatLabel } from "../utils/formatters";

const { Title, Paragraph, Text } = Typography;

const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(undefined);

  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Loads all users for admin management
  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      setErrorMessage("");

      const result = await fetchUsers();

      setUsers(result.data.users);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load users.";

      setErrorMessage(messageText);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Load users after first render
  useEffect(() => {
    queueMicrotask(() => {
      loadUsers();
    });
  }, [loadUsers]);

  // Filters users by selected role
  const filteredUsers = useMemo(() => {
    if (!selectedRoleFilter) {
      return users;
    }

    return users.filter((user) => user.role === selectedRoleFilter);
  }, [users, selectedRoleFilter]);

  // Changes a user's role through the admin-only backend endpoint
  const handleRoleChange = useCallback(
    async (targetUser, nextRole) => {
      try {
        setIsUpdatingRole(true);

        await updateUserRole(targetUser.id, nextRole);

        message.success("User role updated successfully.");

        await loadUsers();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to update user role.";

        setErrorMessage(messageText);
      } finally {
        setIsUpdatingRole(false);
      }
    },
    [loadUsers],
  );

  const userColumns = useMemo(
    () => [
      {
        title: "User",
        dataIndex: "name",
        key: "name",
        render: (name, record) => (
          <div>
            <Space>
              <UserOutlined />
              <strong>{name}</strong>
            </Space>

            <div style={{ color: "#666", marginTop: 4 }}>{record.email}</div>

            {Number(record.id) === Number(currentUser?.id) && (
              <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                Current signed-in admin
              </Text>
            )}
          </div>
        ),
      },
      {
        title: "Role",
        dataIndex: "role",
        key: "role",
        width: 160,
        render: (role) => (
          <Tag color={USER_ROLE_COLORS[role]}>{formatLabel(role)}</Tag>
        ),
      },
      {
        title: "Department",
        dataIndex: "department",
        key: "department",
        width: 220,
        render: (department) => department || "Not set",
      },
      {
        title: "Created",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        render: formatDateTime,
      },
      {
        title: "Updated",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 180,
        render: formatDateTime,
      },
      {
        title: "Change Role",
        key: "changeRole",
        width: 360,
        render: (_, record) => {
          const isCurrentUser = Number(record.id) === Number(currentUser?.id);

          if (isCurrentUser) {
            return (
              <Text type="secondary">
                You cannot change your own role here.
              </Text>
            );
          }

          return (
            <Space wrap>
              {USER_ROLE_OPTIONS.filter(
                (option) => option.value !== record.role,
              ).map((option) => (
                <Popconfirm
                  key={option.value}
                  title="Change user role?"
                  description={`Change ${record.name}'s role to ${option.label}?`}
                  okText="Change Role"
                  cancelText="Cancel"
                  onConfirm={() => handleRoleChange(record, option.value)}
                >
                  <Button size="small" loading={isUpdatingRole}>
                    Make {option.label}
                  </Button>
                </Popconfirm>
              ))}
            </Space>
          );
        },
      },
    ],
    [currentUser?.id, handleRoleChange, isUpdatingRole],
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              Admin User Management
            </Title>

            <Paragraph style={{ marginBottom: 0 }}>
              View users and manage user roles. Role changes affect what users
              can access and modify across LabFlow.
            </Paragraph>
          </div>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadUsers}
            loading={isLoadingUsers}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {errorMessage && <Alert type="error" message={errorMessage} showIcon />}

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="Filter by role"
            style={{ width: 220 }}
            options={USER_ROLE_OPTIONS}
            value={selectedRoleFilter}
            onChange={setSelectedRoleFilter}
          />
        </Space>

        <Table
          rowKey="id"
          columns={userColumns}
          dataSource={filteredUsers}
          loading={isLoadingUsers}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </Space>
  );
};

export default AdminUsersPage;
