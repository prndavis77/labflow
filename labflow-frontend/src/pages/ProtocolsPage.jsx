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
import { PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { deleteProtocol, fetchProtocols } from "../api/protocolApi";
import { fetchProjects } from "../api/projectApi";
import { fetchProjectMembers } from "../api/projectMemberApi";
import {
  getCurrentUserProjectRole,
  canEditProjectLinkedWork,
} from "../utils/projectRoleAccess";
import { fetchEquipment } from "../api/equipmentApi";
import { useAuth } from "../context/AuthContext";
import ProtocolFormModal from "../components/protocols/ProtocolFormModal";
import { APPROVAL_STATUS_OPTIONS } from "../constants/statusOptions";
import { APPROVAL_STATUS_COLORS } from "../constants/statusColors";
import { formatLabel } from "../utils/formatters";

const { Title, Paragraph } = Typography;

const ProtocolsPage = () => {
  const { user: currentUser } = useAuth();

  const [protocols, setProtocols] = useState([]);
  const [projects, setProjects] = useState([]);

  const [equipment, setEquipment] = useState([]);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(undefined);

  const [isLoadingProtocols, setIsLoadingProtocols] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState(null);

  const [selectedProjectId, setSelectedProjectId] = useState(undefined);
  const [selectedApprovalStatus, setSelectedApprovalStatus] =
    useState(undefined);

  const [projectRoleByProjectId, setProjectRoleByProjectId] = useState({});

  const isAdminOrSupervisor = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  // Admins and supervisors can create and edit protocols by role
  // Researchers depend on configurable workflow permissions
  const canCreateProtocols =
    ["admin", "supervisor"].includes(currentUser?.role) ||
    Boolean(currentUser?.canCreateProtocols);

  const canEditProtocols =
    isAdminOrSupervisor || Boolean(currentUser?.canEditProtocols);

  // Only admins and supervisors can delete protocols by role
  const canDeleteProtocols = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  // Converts projects into options for Ant Design Select components
  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  // Converts equipment into options for equipment-specific SOPs
  const equipmentOptions = useMemo(() => {
    return equipment.map((item) => ({
      label: `${item.name} (${item.type})`,
      value: item.id,
    }));
  }, [equipment]);

  // Builds the filter object used by the protocol API.
  const protocolFilters = useMemo(() => {
    const filters = {};

    if (selectedProjectId) {
      filters.projectId = selectedProjectId;
    }

    if (selectedEquipmentId) {
      filters.equipmentId = selectedEquipmentId;
    }

    if (selectedApprovalStatus) {
      filters.approvalStatus = selectedApprovalStatus;
    }

    return filters;
  }, [selectedProjectId, selectedEquipmentId, selectedApprovalStatus]);

  // Loads projects for filters and the protocol form
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

  const loadProjectRolesForProtocols = useCallback(
    async (protocolList) => {
      if (isAdminOrSupervisor) {
        setProjectRoleByProjectId({});
        return;
      }

      const projectIds = [
        ...new Set(
          protocolList
            .map((protocolItem) => protocolItem.projectId)
            .filter(Boolean),
        ),
      ];

      if (projectIds.length === 0) {
        setProjectRoleByProjectId({});
        return;
      }

      try {
        const results = await Promise.all(
          projectIds.map(async (projectId) => {
            const result = await fetchProjectMembers({ projectId });

            const projectRole = getCurrentUserProjectRole(
              result.data.projectMembers,
              currentUser,
              projectId,
            );

            return [Number(projectId), projectRole];
          }),
        );

        setProjectRoleByProjectId(Object.fromEntries(results));
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to load project roles.";

        message.error(messageText);
      }
    },
    [currentUser, isAdminOrSupervisor],
  );

  // Loads equipment so protocols can optionally be linked to instruments
  const loadEquipment = useCallback(async () => {
    try {
      setIsLoadingEquipment(true);

      const result = await fetchEquipment();

      setEquipment(result.data.equipment);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load equipment.";

      message.error(messageText);
    } finally {
      setIsLoadingEquipment(false);
    }
  }, []);

  // Loads protocols from the backend using the current filters
  const loadProtocols = useCallback(async () => {
    try {
      setIsLoadingProtocols(true);
      setErrorMessage("");

      const result = await fetchProtocols(protocolFilters);
      const fetchedProtocols = result.data.protocols;

      setProtocols(fetchedProtocols);

      await loadProjectRolesForProtocols(fetchedProtocols);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load protocols.";

      setErrorMessage(messageText);
    } finally {
      setIsLoadingProtocols(false);
    }
  }, [protocolFilters, loadProjectRolesForProtocols]);

  // Load projects after the first render
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadProjects();
      loadEquipment();
    });
  }, [loadProjects, loadEquipment]);

  // Reload protocols whenever filters change
  // queueMicrotask avoids direct synchronous state updates inside the effect body
  useEffect(() => {
    queueMicrotask(() => {
      loadProtocols();
    });
  }, [loadProtocols]);

  const openCreateModal = () => {
    setEditingProtocol(null);
    setIsModalOpen(true);
  };

  const openEditModal = useCallback((protocol) => {
    setEditingProtocol(protocol);
    setIsModalOpen(true);
  }, []);

  const closeModal = async () => {
    setIsModalOpen(false);
    setEditingProtocol(null);
  };

  const handleProtocolSaved = async () => {
    closeModal();
    await loadProtocols();
  };

  const handleDelete = useCallback(
    async (protocolId) => {
      try {
        await deleteProtocol(protocolId);

        message.success("Protocol deleted successfully.");

        await loadProtocols();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to delete protocol.";

        message.error(messageText);
      }
    },
    [loadProtocols],
  );

  const canEditProtocolRecord = useCallback(
    (record) => {
      if (!record) {
        return false;
      }

      if (isAdminOrSupervisor) {
        return true;
      }

      if (!currentUser?.canEditProtocols) {
        return false;
      }

      // General SOPs are not controlled by project membership.
      if (!record.projectId) {
        return true;
      }

      const projectRole = projectRoleByProjectId[Number(record.projectId)];

      return canEditProjectLinkedWork(currentUser, projectRole);
    },
    [currentUser, isAdminOrSupervisor, projectRoleByProjectId],
  );

  // Table columns are memoized because they include action callbacks
  const columns = useMemo(() => {
    const baseColumns = [
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
        render: (version) => (version ? `v${version}` : "Not set"),
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
        render: (equipmentItem) =>
          equipmentItem ? (
            <Link to={`/equipment/${equipmentItem.id}`}>
              {equipmentItem.name} ({equipmentItem.type})
            </Link>
          ) : (
            "Not linked"
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
        title: "Created By",
        dataIndex: "createdBy",
        key: "createdBy",
        width: 180,
        render: (createdBy) => createdBy?.name || "Unknown",
      },
      {
        title: "Approved By",
        dataIndex: "approvedBy",
        key: "approvedBy",
        width: 180,
        render: (approvedBy) => approvedBy?.name || "Not approved",
      },
      {
        title: "Approved At",
        dataIndex: "approvedAt",
        key: "approvedAt",
        width: 130,
        render: (value) => value || "Not approved",
      },
    ];

    return [
      ...baseColumns,
      {
        title: "Actions",
        key: "actions",
        width: canEditProtocols ? 220 : 90,
        render: (_, record) => (
          <Space>
            <Link to={`/protocols/${record.id}`}>
              <Button size="small">View</Button>
            </Link>

            {canEditProtocols && (
              <Button
                size="small"
                onClick={() => openEditModal(record)}
                disabled={!canEditProtocolRecord(record)}
              >
                Edit
              </Button>
            )}

            {canDeleteProtocols && (
              <Popconfirm
                title="Delete protocol?"
                description="This cannot be undone."
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(record.id)}
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
  }, [
    canEditProtocols,
    canDeleteProtocols,
    handleDelete,
    openEditModal,
    canEditProtocolRecord,
  ]);

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
              Protocols
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Manage reusable lab methods, SOPs, protocol versions, and approval
              status.
            </Paragraph>
          </div>

          {canCreateProtocols && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              New Protocol
            </Button>
          )}
        </div>

        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="Filter by project"
            style={{ width: 320 }}
            loading={isLoadingProjects}
            options={projectOptions}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
          />

          <Select
            allowClear
            placeholder="Filter by equipment"
            style={{ width: 300 }}
            loading={isLoadingEquipment}
            options={equipmentOptions}
            value={selectedEquipmentId}
            onChange={setSelectedEquipmentId}
          />

          <Select
            allowClear
            placeholder="Filter by approval"
            style={{ width: 220 }}
            options={APPROVAL_STATUS_OPTIONS}
            value={selectedApprovalStatus}
            onChange={setSelectedApprovalStatus}
          />

          <Button onClick={loadProtocols}>Refresh</Button>
        </Space>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          rowKey="id"
          columns={columns}
          dataSource={protocols}
          loading={isLoadingProtocols}
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
          }}
          scroll={{
            x: 1300,
          }}
        />
      </Card>

      <ProtocolFormModal
        open={isModalOpen}
        protocol={editingProtocol}
        projects={projects}
        equipment={equipment}
        isLoadingProjects={isLoadingProjects}
        isLoadingEquipment={isLoadingEquipment}
        onCancel={closeModal}
        onSuccess={handleProtocolSaved}
      />
    </>
  );
};

export default ProtocolsPage;
