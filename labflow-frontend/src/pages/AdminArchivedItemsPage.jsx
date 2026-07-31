import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";

import {
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getArchivedItems,
  restoreArchivedItem,
} from "../services/archivedItemService";

import { formatDateTime, formatLabel } from "../utils/formatters";

const { RangePicker } = DatePicker;
const { Title, Paragraph, Text } = Typography;

const ENTITY_TABS = [
  {
    key: "project",
    label: "Projects",
  },
  {
    key: "task",
    label: "Tasks",
  },
  {
    key: "experiment",
    label: "Experiments",
  },
  {
    key: "protocol",
    label: "Protocols",
  },
  {
    key: "attachment",
    label: "Attachments",
  },
];

const getItemName = (entityType, item) => {
  if (entityType === "attachment") {
    return item.originalFileName || item.fileName || "Unnamed attachment";
  }

  return item.title || "Untitled record";
};

const getRestoreDescription = (entityType) => {
  switch (entityType) {
    case "project":
      return (
        "The project will return to normal lists. Tasks, experiments, " +
        "protocols, and attachments archived separately will remain archived."
      );

    case "attachment":
      return (
        "The file will return to its linked record after LabFlow verifies " +
        "that the stored object still exists."
      );

    default:
      return (
        "The selected record will return to normal lists. Related archived " +
        "records will not be restored automatically."
      );
  }
};

const getEntityTagColor = (entityType) => {
  switch (entityType) {
    case "project":
      return "blue";

    case "task":
      return "gold";

    case "experiment":
      return "purple";

    case "protocol":
      return "cyan";

    case "attachment":
      return "geekblue";

    default:
      return "default";
  }
};

const getContextText = (entityType, record) => {
  switch (entityType) {
    case "project":
      return record.supervisor?.name
        ? `Supervisor: ${record.supervisor.name}`
        : "No supervisor";

    case "task":
      if (record.project) {
        return record.project.isArchived
          ? `${record.project.title} (archived)`
          : record.project.title;
      }

      return "Standalone task";

    case "experiment":
      if (!record.project) {
        return "Project unavailable";
      }

      return record.project.isArchived
        ? `${record.project.title} (archived)`
        : record.project.title;

    case "protocol":
      if (record.project) {
        return record.project.isArchived
          ? `${record.project.title} (archived)`
          : record.project.title;
      }

      if (record.equipment) {
        return `Equipment: ${record.equipment.name}`;
      }

      return "General protocol";

    case "attachment":
      return `${formatLabel(record.entityType)} #${record.entityId}`;

    default:
      return "Not available";
  }
};

const AdminArchivedItemsPage = () => {
  const [entityType, setEntityType] = useState("project");

  const [items, setItems] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [searchInput, setSearchInput] = useState("");

  const [selectedDateRange, setSelectedDateRange] = useState(null);

  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    archivedFrom: undefined,
    archivedTo: undefined,
  });

  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");

  const loadArchivedItems = useCallback(
    async ({
      selectedEntityType = entityType,
      page = 1,
      limit = pagination.limit,
      filters = appliedFilters,
    } = {}) => {
      try {
        setLoading(true);
        setErrorMessage("");

        const data = await getArchivedItems({
          entityType: selectedEntityType,
          page,
          limit,
          ...filters,
        });

        setItems(data.items || []);

        setPagination({
          page: data.pagination?.page || page,
          limit: data.pagination?.limit || limit,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        });
      } catch (error) {
        const messageText =
          error.response?.data?.message ||
          "An error occurred while loading archived items.";

        setErrorMessage(messageText);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, entityType, pagination.limit],
  );

  useEffect(() => {
    queueMicrotask(() => {
      loadArchivedItems({
        selectedEntityType: entityType,
        page: 1,
        limit: pagination.limit,
        filters: appliedFilters,
      });
    });
  }, [entityType, appliedFilters, loadArchivedItems, pagination.limit]);

  const handleEntityTypeChange = (nextEntityType) => {
    setEntityType(nextEntityType);

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handleApplyFilters = () => {
    const archivedFrom = selectedDateRange?.[0]?.format("YYYY-MM-DD");

    const archivedTo = selectedDateRange?.[1]?.format("YYYY-MM-DD");

    setAppliedFilters({
      search: searchInput.trim(),
      archivedFrom,
      archivedTo,
    });

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSelectedDateRange(null);

    setAppliedFilters({
      search: "",
      archivedFrom: undefined,
      archivedTo: undefined,
    });

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handleTableChange = (tablePagination) => {
    loadArchivedItems({
      page: tablePagination.current,
      limit: tablePagination.pageSize,
    });
  };

  const handleRestore = useCallback(
    async (record) => {
      try {
        setRestoringId(record.id);

        const result = await restoreArchivedItem({
          entityType,
          id: record.id,
        });

        if (result.data?.restored === false) {
          message.info(result.message || "The record is already active.");
        } else {
          message.success(
            result.message || "Archived item restored successfully.",
          );
        }

        const remainingOnPage = items.length - 1;

        const nextPage =
          remainingOnPage === 0 && pagination.page > 1
            ? pagination.page - 1
            : pagination.page;

        await loadArchivedItems({
          page: nextPage,
          limit: pagination.limit,
        });
      } catch (error) {
        const responseData = error.response?.data;

        const messageText =
          responseData?.message ||
          "An error occurred while restoring the archived item.";

        if (responseData?.code === "ARCHIVED_PARENT") {
          message.warning(messageText);
        } else if (responseData?.code === "STORAGE_OBJECT_MISSING") {
          message.error(messageText);
        } else if (responseData?.code === "ATTACHMENT_NOT_AVAILABLE") {
          message.warning(messageText);
        } else if (responseData?.code === "STORAGE_UNAVAILABLE") {
          message.error(
            "File storage is temporarily unavailable. Try again later.",
          );
        } else {
          message.error(messageText);
        }
      } finally {
        setRestoringId(null);
      }
    },
    [
      entityType,
      items.length,
      loadArchivedItems,
      pagination.limit,
      pagination.page,
    ],
  );

  const commonColumns = useMemo(
    () => [
      {
        title: entityType === "attachment" ? "File" : "Name",
        key: "name",
        width: 300,
        render: (_, record) => (
          <div>
            <Text strong>{getItemName(entityType, record)}</Text>

            {entityType === "attachment" && record.category && (
              <div style={{ marginTop: 4 }}>
                <Tag>{formatLabel(record.category)}</Tag>
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Type",
        key: "type",
        width: 130,
        render: () => (
          <Tag color={getEntityTagColor(entityType)}>
            {formatLabel(entityType)}
          </Tag>
        ),
      },
      {
        title: "Context",
        key: "context",
        width: 280,
        render: (_, record) => (
          <Text>{getContextText(entityType, record)}</Text>
        ),
      },
      {
        title: "Archived By",
        dataIndex: "archivedBy",
        key: "archivedBy",
        width: 190,
        render: (archivedBy) => archivedBy?.name || "Unknown user",
      },
      {
        title: "Archived At",
        dataIndex: "archivedAt",
        key: "archivedAt",
        width: 190,
        render: formatDateTime,
      },
      {
        title: "Reason",
        dataIndex: "archiveReason",
        key: "archiveReason",
        width: 260,
        render: (archiveReason) =>
          archiveReason || <Text type="secondary">No reason recorded</Text>,
      },
      {
        title: "Action",
        key: "action",
        fixed: "right",
        width: 130,
        render: (_, record) => (
          <Popconfirm
            title={`Restore ${formatLabel(entityType)}?`}
            description={getRestoreDescription(entityType)}
            okText="Restore"
            cancelText="Cancel"
            onConfirm={() => handleRestore(record)}
          >
            <Button
              type="primary"
              size="small"
              icon={<UndoOutlined />}
              loading={restoringId === record.id}
              disabled={restoringId !== null && restoringId !== record.id}
            >
              Restore
            </Button>
          </Popconfirm>
        ),
      },
    ],
    [entityType, handleRestore, restoringId],
  );

  const columns = useMemo(() => {
    if (entityType === "attachment") {
      return commonColumns.filter((column) => column.key !== "reason");
    }

    return commonColumns;
  }, [commonColumns, entityType]);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              Archived Items
            </Title>

            <Paragraph style={{ marginBottom: 0 }}>
              Review and restore archived projects, tasks, experiments,
              protocols, and attachments. Restoring an item does not
              automatically restore related records.
            </Paragraph>
          </div>

          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() =>
              loadArchivedItems({
                page: pagination.page,
                limit: pagination.limit,
              })
            }
          >
            Refresh
          </Button>
        </div>
      </Card>

      {errorMessage && <Alert type="error" message={errorMessage} showIcon />}

      <Card>
        <Tabs
          activeKey={entityType}
          items={ENTITY_TABS}
          onChange={handleEntityTypeChange}
        />

        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={
              entityType === "attachment" ? "Search filename" : "Search title"
            }
            style={{ width: 280 }}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onPressEnter={handleApplyFilters}
          />

          <RangePicker
            value={selectedDateRange}
            onChange={setSelectedDateRange}
            placeholder={["Archived from", "Archived to"]}
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleApplyFilters}
          >
            Apply
          </Button>

          <Button onClick={handleResetFilters}>Reset</Button>
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <InboxOutlined />
            <span>
              Archived{" "}
              {ENTITY_TABS.find((tab) => tab.key === entityType)?.label}
            </span>
          </Space>
        }
      >
        {items.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`No archived ${ENTITY_TABS.find(
              (tab) => tab.key === entityType,
            )?.label.toLowerCase()} found.`}
          />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            scroll={{ x: 1300 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) =>
                `${total} archived item${total === 1 ? "" : "s"}`,
            }}
            onChange={handleTableChange}
          />
        )}
      </Card>
    </Space>
  );
};

export default AdminArchivedItemsPage;
