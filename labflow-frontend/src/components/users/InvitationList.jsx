import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import dayjs from "dayjs";

import { getInvitations, revokeInvitation } from "../../api/invitationApi";
import { formatLabel } from "../../utils/formatters";

const STATUS_COLORS = {
  pending: "blue",
  accepted: "green",
  revoked: "red",
  expired: "orange",
};

const InvitationList = ({ refreshKey = 0 }) => {
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await getInvitations();
      setInvitations(response.data.invitations || []);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Failed to load invitations.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadInvitations();
    });
  }, [loadInvitations, refreshKey]);

  const handleRevoke = useCallback(
    async (invitationId) => {
      try {
        await revokeInvitation(invitationId);
        message.success("Invitation revoked.");
        await loadInvitations();
      } catch (error) {
        message.error(
          error.response?.data?.message || "Failed to revoke invitation.",
        );
      }
    },
    [loadInvitations],
  );

  const columns = useMemo(
    () => [
      {
        title: "Invitee",
        dataIndex: "name",
        key: "name",
        render: (name, record) => (
          <div>
            <strong>{name}</strong>
            <div style={{ color: "#666" }}>{record.email}</div>
          </div>
        ),
      },
      {
        title: "Role",
        dataIndex: "role",
        key: "role",
        width: 130,
        render: (role) => <Tag>{formatLabel(role)}</Tag>,
      },
      {
        title: "Department",
        dataIndex: "department",
        key: "department",
        width: 180,
        render: (department) => department || "Not set",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status) => (
          <Tag color={STATUS_COLORS[status] || "default"}>
            {formatLabel(status)}
          </Tag>
        ),
      },
      {
        title: "Expires",
        dataIndex: "expiresAt",
        key: "expiresAt",
        width: 170,
        render: (expiresAt) =>
          expiresAt ? dayjs(expiresAt).format("YYYY-MM-DD HH:mm") : "Not set",
      },
      {
        title: "Invited By",
        dataIndex: "invitedBy",
        key: "invitedBy",
        width: 180,
        render: (invitedBy) => invitedBy?.name || "Unknown",
      },
      {
        title: "Created",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 170,
        render: (createdAt) =>
          createdAt ? dayjs(createdAt).format("YYYY-MM-DD HH:mm") : "Not set",
      },
      {
        title: "Accepted",
        dataIndex: "acceptedAt",
        key: "acceptedAt",
        width: 170,
        render: (acceptedAt) =>
          acceptedAt
            ? dayjs(acceptedAt).format("YYYY-MM-DD HH:mm")
            : "Not accepted",
      },
      {
        title: "Action",
        key: "action",
        width: 120,
        render: (_, record) =>
          record.status === "pending" ? (
            <Popconfirm
              title="Revoke invitation?"
              description="This invitation link will no longer be usable."
              okText="Revoke"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleRevoke(record.id)}
            >
              <Button danger size="small">
                Revoke
              </Button>
            </Popconfirm>
          ) : (
            <span style={{ color: "#999" }}>No action</span>
          ),
      },
    ],
    [handleRevoke],
  );

  return (
    <Card
      title="Invitations"
      extra={
        <Button onClick={loadInvitations} loading={isLoading}>
          Refresh
        </Button>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {errorMessage && <Alert type="error" message={errorMessage} showIcon />}

        <Table
          rowKey="id"
          columns={columns}
          dataSource={invitations}
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
          }}
        />
      </Space>
    </Card>
  );
};

export default InvitationList;
