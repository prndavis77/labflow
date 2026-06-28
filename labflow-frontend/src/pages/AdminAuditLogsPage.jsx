import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

import { getAuditLogs } from "../services/auditLogService";

import { ACTION_OPTIONS } from "../constants/actionOptions.js";

import { ENTITY_TYPE_OPTIONS } from "../constants/entityTypeOptions.js";

import { formatDateTime } from "../utils/formatters";

const { Title, Text } = Typography;

const getActionColor = (action) => {
  if (action?.includes("approved") || action?.includes("confirmed")) {
    return "green";
  }

  if (action?.includes("changes_requested") || action?.includes("reopened")) {
    return "orange";
  }

  if (action?.includes("deactivated")) {
    return "red";
  }

  if (action?.includes("reactivated")) {
    return "blue";
  }

  return "default";
};

const AdminAuditLogsPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
  });

  const [loading, setLoading] = useState(false);

  const [selectedAction, setSelectedAction] = useState(undefined);
  const [selectedEntityType, setSelectedEntityType] = useState(undefined);

  const [actorName, setActorName] = useState("");
  const [targetName, setTargetName] = useState("");
  const [error, setError] = useState("");

  const auditLogFilters = useMemo(() => {
    const filters = {};

    if (selectedAction) {
      filters.action = selectedAction;
    }

    if (selectedEntityType) {
      filters.entityType = selectedEntityType;
    }

    if (actorName.trim()) {
      filters.actorName = actorName.trim();
    }

    if (targetName.trim()) {
      filters.targetName = targetName.trim();
    }

    return filters;
  }, [selectedAction, selectedEntityType, actorName, targetName]);

  const loadAuditLogs = useCallback(
    async ({ page = 1, limit = pagination.limit } = {}) => {
      try {
        setLoading(true);
        setError("");

        const data = await getAuditLogs({
          page,
          limit,
          ...auditLogFilters,
        });

        setAuditLogs(data.auditLogs || []);
        setPagination({
          page: data.pagination?.page || page,
          limit: data.pagination?.limit || limit,
          total: data.pagination?.total || 0,
        });
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "An error occurred while loading audit logs.",
        );
      } finally {
        setLoading(false);
      }
    },
    [auditLogFilters, pagination.limit],
  );

  useEffect(() => {
    queueMicrotask(() => {
      loadAuditLogs({ page: 1, limit: pagination.limit });
    });
  }, [loadAuditLogs, pagination.limit]);

  const columns = useMemo(
    () => [
      {
        title: "Time",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 190,
        render: formatDateTime,
      },
      {
        title: "Action",
        dataIndex: "action",
        key: "action",
        width: 240,
        render: (action) => <Tag color={getActionColor(action)}>{action}</Tag>,
      },
      {
        title: "Actor",
        dataIndex: "actor",
        key: "actor",
        width: 180,
        render: (actor) => actor?.name || "System",
      },
      {
        title: "Target",
        dataIndex: "targetUser",
        key: "targetUser",
        width: 180,
        render: (targetUser) => targetUser?.name || "N/A",
      },
      {
        title: "Entity",
        key: "entity",
        width: 160,
        render: (_, record) => (
          <Text>
            {record.entityType} #{record.entityId}
          </Text>
        ),
      },
      {
        title: "Summary",
        dataIndex: "summary",
        key: "summary",
      },
    ],
    [],
  );

  const handleTableChange = (tablePagination) => {
    loadAuditLogs({
      page: tablePagination.current,
      limit: tablePagination.pageSize,
    });
  };

  const handleReset = () => {
    setSelectedAction(undefined);
    setSelectedEntityType(undefined);
    setActorName("");
    setTargetName("");
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={2}>Audit Logs</Title>
        <Text type="secondary">
          View admin actions, review decisions, and other tracked workflow
          events.
        </Text>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      <Card>
        <Space style={{ marginBottom: 0 }} wrap>
          <Select
            allowClear
            placeholder="All actions"
            style={{ width: 280 }}
            options={ACTION_OPTIONS}
            value={selectedAction}
            onChange={setSelectedAction}
          />

          <Select
            allowClear
            placeholder="All entities"
            style={{ width: 180 }}
            options={ENTITY_TYPE_OPTIONS}
            value={selectedEntityType}
            onChange={setSelectedEntityType}
          />

          <Input
            placeholder="Actor name"
            style={{ width: 140 }}
            value={actorName}
            onChange={(event) => setActorName(event.target.value)}
          />

          <Input
            placeholder="Target name"
            style={{ width: 140 }}
            value={targetName}
            onChange={(event) => setTargetName(event.target.value)}
          />

          <Button onClick={handleReset}>Reset</Button>

          <Button onClick={() => loadAuditLogs()}>Refresh</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={auditLogs}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
          }}
          onChange={handleTableChange}
        />
      </Card>
    </Space>
  );
};

export default AdminAuditLogsPage;
