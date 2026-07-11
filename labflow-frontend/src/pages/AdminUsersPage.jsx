import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchUsers,
  updateUserRole,
  updateUserWorkflowPermissions,
  updateUserAccountStatus,
  resetUserPassword,
} from "../api/userApi";
import { USER_ROLE_OPTIONS } from "../constants/statusOptions";
import { USER_ROLE_COLORS } from "../constants/statusColors";
import { useAuth } from "../context/useAuth";
import { formatDateTime, formatLabel } from "../utils/formatters";
import InviteUserModal from "../components/users/InviteUserModal";
import InvitationList from "../components/users/InvitationList";

const { Title, Paragraph, Text } = Typography;

const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);

  const [selectedRoleFilter, setSelectedRoleFilter] = useState(undefined);

  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const [bulkUpdatingField, setBulkUpdatingField] = useState(null);
  const [passwordResetUser, setPasswordResetUser] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [invitationRefreshKey, setInvitationRefreshKey] = useState(0);

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

  const researcherUsers = useMemo(
    () => users.filter((user) => user.role === "researcher"),
    [users],
  );

  const getBulkPermissionState = useCallback(
    (field) => {
      if (researcherUsers.length === 0) {
        return {
          checked: false,
          isMixed: false,
        };
      }

      const enabledCount = researcherUsers.filter((user) =>
        Boolean(user[field]),
      ).length;

      return {
        checked: enabledCount === researcherUsers.length,
        isMixed: enabledCount > 0 && enabledCount < researcherUsers.length,
      };
    },
    [researcherUsers],
  );

  const handleBulkWorkflowPermissionChange = useCallback(
    async (field, checked) => {
      if (researcherUsers.length === 0) {
        message.info("There are no researcher accounts to update.");
        return;
      }

      try {
        setBulkUpdatingField(field);

        const results = await Promise.allSettled(
          researcherUsers.map((researcher) =>
            updateUserWorkflowPermissions(researcher.id, {
              [field]: checked,
            }),
          ),
        );

        const failedResults = results.filter(
          (result) => result.status === "rejected",
        );

        await loadUsers();

        if (failedResults.length > 0) {
          message.warning(
            `${researcherUsers.length - failedResults.length} of ${
              researcherUsers.length
            } researcher accounts were updated.`,
          );

          return;
        }

        message.success(
          `Updated ${researcherUsers.length} researcher account${
            researcherUsers.length === 1 ? "" : "s"
          }.`,
        );
      } catch (error) {
        const messageText =
          error.response?.data?.message ||
          "Failed to update researcher permissions.";

        message.error(messageText);
      } finally {
        setBulkUpdatingField(null);
      }
    },
    [loadUsers, researcherUsers],
  );

  const renderBulkPermissionSwitch = useCallback(
    (field, label) => {
      const { checked, isMixed } = getBulkPermissionState(field);
      const isThisFieldUpdating = bulkUpdatingField === field;
      const isAnyBulkUpdateRunning = bulkUpdatingField !== null;

      return (
        <Space>
          <Switch
            size="small"
            checked={checked}
            loading={isThisFieldUpdating}
            disabled={
              researcherUsers.length === 0 ||
              isAnyBulkUpdateRunning ||
              isUpdatingPermissions
            }
            onChange={(nextChecked) =>
              handleBulkWorkflowPermissionChange(field, nextChecked)
            }
          />

          <Text>{label}</Text>

          {isMixed && <Tag>Mixed</Tag>}
        </Space>
      );
    },
    [
      bulkUpdatingField,
      getBulkPermissionState,
      handleBulkWorkflowPermissionChange,
      isUpdatingPermissions,
      researcherUsers.length,
    ],
  );

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

  // Updates one workflow permission flag for a researcher
  // Admins and supervisors do not use these flags because they have full access by role
  const handleWorkflowPermissionChange = useCallback(
    async (targetUser, field, checked) => {
      try {
        setIsUpdatingPermissions(true);

        await updateUserWorkflowPermissions(targetUser.id, {
          [field]: checked,
        });

        message.success("Workflow permission updated successfully.");

        await loadUsers();
      } catch (error) {
        const messageText =
          error.response?.data?.message ||
          "Failed to update workflow permission.";

        message.error(messageText);
      } finally {
        setIsUpdatingPermissions(false);
      }
    },
    [loadUsers],
  );

  // Renders one permission switch for researcher workflow permissions.
  const renderPermissionSwitch = useCallback(
    (record, field, label) => {
      const isBulkUpdateRunning = bulkUpdatingField !== null;

      return (
        <Space>
          <Switch
            size="small"
            checked={Boolean(record[field])}
            loading={isUpdatingPermissions}
            disabled={isUpdatingPermissions || isBulkUpdateRunning}
            onChange={(checked) =>
              handleWorkflowPermissionChange(record, field, checked)
            }
          />

          <Text>{label}</Text>
        </Space>
      );
    },
    [bulkUpdatingField, handleWorkflowPermissionChange, isUpdatingPermissions],
  );

  const handleAccountStatusChange = useCallback(
    async (targetUser) => {
      const nextStatus = !targetUser.isActive;

      const actionLabel = nextStatus ? "reactivate" : "deactivate";

      Modal.confirm({
        title: `${nextStatus ? "Reactivate" : "Deactivate"} account?`,
        content: `Are you sure you want to ${actionLabel} ${targetUser.name}?`,
        okText: nextStatus ? "Reactivate" : "Deactivate",
        okButtonProps: {
          danger: !nextStatus,
        },
        async onOk() {
          try {
            await updateUserAccountStatus(targetUser.id, nextStatus);

            message.success(
              nextStatus
                ? "User account reactivated."
                : "User account deactivated.",
            );

            await loadUsers();
          } catch (error) {
            message.error(
              error.response?.data?.message ||
                "Failed to update user account status.",
            );
          }
        },
      });
    },
    [loadUsers],
  );

  const openPasswordResetModal = useCallback((targetUser) => {
    setPasswordResetUser(targetUser);
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  const closePasswordResetModal = useCallback(() => {
    setPasswordResetUser(null);
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  const handlePasswordReset = useCallback(async () => {
    if (!passwordResetUser) {
      return;
    }

    if (!newPassword || !confirmPassword) {
      message.error("Enter and confirm the new password.");
      return;
    }

    if (newPassword.length < 8) {
      message.error("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      message.error("Passwords do not match.");
      return;
    }

    try {
      setIsResettingPassword(true);

      await resetUserPassword(passwordResetUser.id, newPassword);

      message.success("User password reset successfully.");

      closePasswordResetModal();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to reset user password.",
      );
    } finally {
      setIsResettingPassword(false);
    }
  }, [
    closePasswordResetModal,
    confirmPassword,
    newPassword,
    passwordResetUser,
  ]);

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
        title: "Experiment Permissions",
        key: "experimentPermissions",
        width: 260,
        render: (_, record) => {
          if (record.role !== "researcher") {
            return <Text type="secondary">Full access by role</Text>;
          }

          return (
            <Space direction="vertical" size="small">
              {renderPermissionSwitch(
                record,
                "canCreateExperiments",
                "Create experiments",
              )}
              {renderPermissionSwitch(
                record,
                "canEditExperiments",
                "Edit experiments",
              )}
            </Space>
          );
        },
      },
      {
        title: "Protocol Permissions",
        key: "protocolPermissions",
        width: 260,
        render: (_, record) => {
          if (record.role !== "researcher") {
            return <Text type="secondary">Full access by role</Text>;
          }

          return (
            <Space direction="vertical" size="small">
              {renderPermissionSwitch(
                record,
                "canCreateProtocols",
                "Create protocols",
              )}
              {renderPermissionSwitch(
                record,
                "canEditProtocols",
                "Edit protocols",
              )}
            </Space>
          );
        },
      },
      {
        title: "Review Requirement",
        key: "reviewRequirement",
        width: 230,
        render: (_, record) => {
          if (record.role !== "researcher") {
            return <Text type="secondary">Not required by role</Text>;
          }

          return renderPermissionSwitch(
            record,
            "requiresReview",
            "Requires review",
          );
        },
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
      {
        title: "Status",
        dataIndex: "isActive",
        key: "isActive",
        render: (isActive) =>
          isActive ? (
            <Tag color="green">Active</Tag>
          ) : (
            <Tag color="red">Inactive</Tag>
          ),
      },
      {
        title: "Account",
        key: "accountStatus",
        width: 160,
        render: (_, record) => {
          const isCurrentUser = Number(record.id) === Number(currentUser?.id);

          return (
            <Button
              size="small"
              danger={record.isActive}
              disabled={isCurrentUser}
              onClick={() => handleAccountStatusChange(record)}
            >
              {record.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          );
        },
      },
      {
        title: "Password",
        key: "password",
        width: 160,
        render: (_, record) => {
          const isCurrentUser = Number(record.id) === Number(currentUser?.id);

          return (
            <Button
              size="small"
              disabled={isCurrentUser}
              onClick={() => openPasswordResetModal(record)}
            >
              Reset Password
            </Button>
          );
        },
      },
    ],
    [
      currentUser?.id,
      handleRoleChange,
      isUpdatingRole,
      renderPermissionSwitch,
      handleAccountStatusChange,
      openPasswordResetModal,
    ],
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

            <Button type="primary" onClick={() => setInviteModalOpen(true)}>
              Invite User
            </Button>

            <Paragraph style={{ marginBottom: 4 }}>
              View users and manage user roles. Role changes affect what users
              can access and modify across LabFlow.
            </Paragraph>

            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Researcher workflow permissions control whether researcher
              accounts can independently create or edit experiments and
              protocols, and whether their new experiments and protocols require
              formal review. Admins and supervisors have full access by role.
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
        <Card
          size="small"
          title="Bulk researcher settings"
          style={{ marginBottom: 16 }}
        >
          <Paragraph type="secondary">
            These controls update the selected permission for every researcher
            account. A Mixed label means researchers currently have different
            settings.
          </Paragraph>

          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Text strong>Experiment permissions</Text>

              <div style={{ marginTop: 8 }}>
                <Space wrap size="large">
                  {renderBulkPermissionSwitch(
                    "canCreateExperiments",
                    "Allow all researchers to create experiments",
                  )}

                  {renderBulkPermissionSwitch(
                    "canEditExperiments",
                    "Allow all researchers to edit experiments",
                  )}
                </Space>
              </div>
            </div>

            <div>
              <Text strong>Protocol permissions</Text>

              <div style={{ marginTop: 8 }}>
                <Space wrap size="large">
                  {renderBulkPermissionSwitch(
                    "canCreateProtocols",
                    "Allow all researchers to create protocols",
                  )}

                  {renderBulkPermissionSwitch(
                    "canEditProtocols",
                    "Allow all researchers to edit protocols",
                  )}
                </Space>
              </div>
            </div>

            <div>
              <Text strong>Review policy</Text>

              <div style={{ marginTop: 8 }}>
                {renderBulkPermissionSwitch(
                  "requiresReview",
                  "Require experiment and protocol review for all researchers",
                )}
              </div>
            </div>
          </Space>
        </Card>

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
          scroll={{ x: 2200 }}
        />
      </Card>

      <InvitationList refreshKey={invitationRefreshKey} />

      <Modal
        title={
          passwordResetUser
            ? `Reset password for ${passwordResetUser.name}`
            : "Reset password"
        }
        open={Boolean(passwordResetUser)}
        onCancel={closePasswordResetModal}
        onOk={handlePasswordReset}
        okText="Reset Password"
        confirmLoading={isResettingPassword}
        okButtonProps={{
          danger: true,
        }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="secondary">
            Enter a temporary password for this user. The password will be
            active immediately after reset.
          </Text>

          <Input.Password
            placeholder="New temporary password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />

          <Input.Password
            placeholder="Confirm new temporary password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Space>
      </Modal>

      <InviteUserModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvitationCreated={() => {
          setInvitationRefreshKey((current) => current + 1);
        }}
      />
    </Space>
  );
};

export default AdminUsersPage;
