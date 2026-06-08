import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/useAuth";
import { fetchProjectById } from "../api/projectApi";
import { fetchTasks } from "../api/taskApi";
import { fetchExperiments } from "../api/experimentApi";
import { fetchProtocols } from "../api/protocolApi";
import { fetchEquipmentBookings } from "../api/equipmentBookingApi";
import { fetchNotebookEntries } from "../api/notebookEntryApi";
import { fetchUsers } from "../api/userApi";
import ProjectFormModal from "../components/projects/ProjectFormModal";
import {
  createProjectMember,
  deleteProjectMember,
  fetchProjectMembers,
  updateProjectMember,
} from "../api/projectMemberApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import {
  getCurrentUserProjectRole,
  canManageProjectMembers,
} from "../utils/projectRoleAccess";

import { PROJECT_MEMBER_ROLE_OPTIONS } from "../constants/statusOptions";
import {
  APPROVAL_STATUS_COLORS,
  BOOKING_STATUS_COLORS,
  EXPERIMENT_STATUS_COLORS,
  NOTEBOOK_ENTRY_TYPE_COLORS,
  PROJECT_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
  PROJECT_MEMBER_ROLE_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph } = Typography;

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [project, setProject] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notebookEntries, setNotebookEntries] = useState([]);

  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProjectMembers, setIsLoadingProjectMembers] = useState(false);
  const [isSubmittingProjectMember, setIsSubmittingProjectMember] =
    useState(false);
  const [isProjectMemberModalOpen, setIsProjectMemberModalOpen] =
    useState(false);

  const [projectMemberErrorMessage, setProjectMemberErrorMessage] =
    useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const [projectMemberForm] = Form.useForm();

  const currentUserProjectRole = useMemo(() => {
    return getCurrentUserProjectRole(projectMembers, currentUser);
  }, [projectMembers, currentUser]);

  const canManageMembersForThisProject = canManageProjectMembers(currentUser);

  const isProjectViewer = currentUserProjectRole === "viewer";

  const loadProjectMembers = useCallback(async () => {
    try {
      setIsLoadingProjectMembers(true);
      setProjectMemberErrorMessage("");

      const result = await fetchProjectMembers({
        projectId: id,
      });

      setProjectMembers(result.data.projectMembers);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load project members.";

      setProjectMemberErrorMessage(messageText);
    } finally {
      setIsLoadingProjectMembers(false);
    }
  }, [id]);

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

  // Opens the reusable project form modal in edit mode.
  const openEditModal = () => {
    if (!project) {
      return;
    }
    setIsEditProjectModalOpen(true);
  };

  const closeEditProjectModal = () => {
    setIsEditProjectModalOpen(false);
  };

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
      loadProjectMembers();
      loadUsers();
    });
  }, [loadProjectDetail, loadProjectMembers, loadUsers]);

  const handleProjectSaved = async () => {
    closeEditProjectModal();
    await loadProjectDetail();
  };

  const existingProjectMemberUserIds = useMemo(() => {
    return new Set(projectMembers.map((member) => Number(member.userId)));
  }, [projectMembers]);

  const availableUserOptions = useMemo(() => {
    return users
      .filter((user) => !existingProjectMemberUserIds.has(Number(user.id)))
      .map((user) => ({
        label: `${user.name} (${formatLabel(user.role)})`,
        value: Number(user.id),
      }));
  }, [users, existingProjectMemberUserIds]);

  const openProjectMemberModal = () => {
    projectMemberForm.resetFields();

    projectMemberForm.setFieldsValue({
      projectRole: "member",
    });

    setIsProjectMemberModalOpen(true);
  };

  const closeProjectMemberModal = () => {
    setIsProjectMemberModalOpen(false);
    projectMemberForm.resetFields();
  };

  const handleAddProjectMember = async (values) => {
    try {
      setIsSubmittingProjectMember(true);

      await createProjectMember({
        projectId: Number(id),
        userId: values.userId,
        projectRole: values.projectRole,
      });

      message.success("Project member added successfully.");

      closeProjectMemberModal();
      await loadProjectMembers();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to add project member.";

      message.error(messageText);
    } finally {
      setIsSubmittingProjectMember(false);
    }
  };

  const handleUpdateProjectMemberRole = useCallback(
    async (projectMemberId, projectRole) => {
      try {
        await updateProjectMember(projectMemberId, {
          projectRole,
        });

        message.success("Project member role updated successfully.");

        await loadProjectMembers();
      } catch (error) {
        const messageText =
          error.response?.data?.message ||
          "Failed to update project member role.";

        message.error(messageText);
      }
    },
    [loadProjectMembers],
  );

  const handleRemoveProjectMember = useCallback(
    async (projectMemberId) => {
      try {
        await deleteProjectMember(projectMemberId);

        message.success("Project member removed successfully.");

        await loadProjectMembers();
      } catch (error) {
        const messageText =
          error.response?.data?.message || "Failed to remove project member.";

        message.error(messageText);
      }
    },
    [loadProjectMembers],
  );

  const projectMemberColumns = useMemo(() => {
    const baseColumns = [
      {
        title: "User",
        key: "user",
        render: (_, record) => (
          <div>
            <strong>{record.user?.name || "Unknown user"}</strong>
            <div style={{ color: "#666" }}>{record.user?.email}</div>
          </div>
        ),
      },
      {
        title: "System Role",
        key: "systemRole",
        width: 150,
        render: (_, record) => (
          <Tag>{formatLabel(record.user?.role || "unknown")}</Tag>
        ),
      },
      {
        title: "Project Role",
        dataIndex: "projectRole",
        key: "projectRole",
        width: 220,
        render: (projectRole, record) => {
          if (!canManageMembersForThisProject) {
            return (
              <Tag color={PROJECT_MEMBER_ROLE_COLORS[projectRole]}>
                {formatLabel(projectRole)}
              </Tag>
            );
          }

          return (
            <Select
              value={projectRole}
              options={PROJECT_MEMBER_ROLE_OPTIONS}
              style={{ width: 150 }}
              onChange={(nextProjectRole) =>
                handleUpdateProjectMemberRole(record.id, nextProjectRole)
              }
            />
          );
        },
      },
      {
        title: "Added",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        render: formatDateTime,
      },
    ];

    if (!canManageMembersForThisProject) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        title: "Actions",
        key: "actions",
        width: 140,
        render: (_, record) => {
          if (!canManageMembersForThisProject) {
            return null;
          }

          return (
            <Popconfirm
              title="Remove project member?"
              description={`Remove ${
                record.user?.name || "this user"
              } from this project?`}
              okText="Remove"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleRemoveProjectMember(record.id)}
            >
              <Button size="small" danger>
                Remove
              </Button>
            </Popconfirm>
          );
        },
      },
    ];
  }, [
    handleRemoveProjectMember,
    handleUpdateProjectMemberRole,
    canManageMembersForThisProject,
  ]);

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
              {record.equipment ? (
                <Link to={`/equipment/${record.equipment.id}`}>
                  {record.equipment.name}
                </Link>
              ) : (
                "No equipment"
              )}
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
            {record.experiment ? (
              <Link to={`/experiments/${record.experiment.id}`}>
                <strong>{title}</strong>
              </Link>
            ) : (
              <strong>{title}</strong>
            )}

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
            onClick={async () => {
              await Promise.all([loadProjectDetail(), loadProjectMembers()]);
            }}
            loading={isLoading || isLoadingProjectMembers}
          >
            Refresh
          </Button>

          {canManageMembersForThisProject && project && (
            <Button icon={<EditOutlined />} onClick={openEditModal}>
              Edit Project
            </Button>
          )}
        </Space>

        {project ? (
          <>
            <Title level={2} style={{ marginBottom: 4 }}>
              {project.title}
            </Title>

            <Paragraph>
              {project.description || "No description provided."}
            </Paragraph>

            {isProjectViewer && (
              <Alert
                type="info"
                showIcon
                message="You have read-only access to this project."
                description="You can view project information and linked records, but you cannot create or edit project-linked work."
                style={{ marginBottom: 16 }}
              />
            )}

            <Descriptions bordered column={2}>
              <Descriptions.Item label="Status">
                <Tag color={PROJECT_STATUS_COLORS[project.status]}>
                  {formatLabel(project.status)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Supervisor">
                {project.supervisor
                  ? `${project.supervisor.name} (${formatLabel(project.supervisor.role)})`
                  : "Not assigned"}
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

              <Descriptions.Item label="Notebook Entries">
                {notebookEntries.length}
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

      <Card
        title={`Project Members (${projectMembers.length})`}
        extra={
          canManageMembersForThisProject && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openProjectMemberModal}
            >
              Add Member
            </Button>
          )
        }
      >
        {projectMemberErrorMessage && (
          <Alert
            type="error"
            message={projectMemberErrorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {projectMembers.length === 0 && !isLoadingProjectMembers ? (
          <Empty description="No project members added yet." />
        ) : (
          <Table
            rowKey="id"
            columns={projectMemberColumns}
            dataSource={projectMembers}
            loading={isLoadingProjectMembers}
            pagination={false}
            scroll={{ x: 800 }}
          />
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
          <Card title={`Recent Notebook Entries (${notebookEntries.length})`}>
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

      <Modal
        title="Add Project Member"
        open={isProjectMemberModalOpen}
        onCancel={closeProjectMemberModal}
        onOk={() => projectMemberForm.submit()}
        confirmLoading={isSubmittingProjectMember}
        okText="Add Member"
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={projectMemberForm}
          onFinish={handleAddProjectMember}
        >
          <Form.Item
            label="User"
            name="userId"
            rules={[
              {
                required: true,
                message: "Please select a user.",
              },
            ]}
          >
            <Select
              showSearch
              placeholder="Select user"
              loading={isLoadingUsers}
              options={availableUserOptions}
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="Project Role"
            name="projectRole"
            rules={[
              {
                required: true,
                message: "Please select a project role.",
              },
            ]}
          >
            <Select options={PROJECT_MEMBER_ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <ProjectFormModal
        open={isEditProjectModalOpen}
        project={project}
        users={users}
        isLoadingUsers={isLoadingUsers}
        onCancel={closeEditProjectModal}
        onSuccess={handleProjectSaved}
      />
    </Space>
  );
};

export default ProjectDetailPage;
