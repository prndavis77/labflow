import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo } from "react";

import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "../../constants/statusOptions";
import {
  getCurrentUserProjectRole,
  canCreateProjectTask,
} from "../../utils/projectRoleAccess";

const { TextArea } = Input;

const TaskFormModal = ({
  open,
  mode,
  task,
  currentUser,
  projects,
  users,
  formProjectMembers,
  formProjectId,
  isSubmitting,
  isLoadingProjects,
  isLoadingUsers,
  isLoadingFormProjectMembers,
  onCancel,
  onSubmit,
  onProjectChange,
}) => {
  const [form] = Form.useForm();

  const isEditingTask = mode === "edit";
  const isAdminOrSupervisor = ["admin", "supervisor"].includes(
    currentUser?.role,
  );

  const currentUserFormProjectRole = useMemo(() => {
    return getCurrentUserProjectRole(
      formProjectMembers,
      currentUser,
      formProjectId,
    );
  }, [formProjectMembers, currentUser, formProjectId]);

  const canAssignTaskForSelectedProject = canCreateProjectTask(
    currentUser,
    currentUserFormProjectRole,
  );

  const canCreateTaskForFormProject =
    isAdminOrSupervisor ||
    !formProjectId ||
    canCreateProjectTask(currentUser, currentUserFormProjectRole);

  const isMemberSelfEditingAssignedProjectTask = useMemo(() => {
    if (!task || !task.projectId || !currentUser?.id) {
      return false;
    }

    if (currentUser?.role !== "researcher") {
      return false;
    }

    return (
      currentUserFormProjectRole === "member" &&
      Number(task.assignedToId) === Number(currentUser.id)
    );
  }, [task, currentUser, currentUserFormProjectRole]);

  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  const userOptions = useMemo(() => {
    return users.map((userItem) => ({
      label: `${userItem.name} (${userItem.role})`,
      value: userItem.id,
    }));
  }, [users]);

  const formAssigneeOptions = useMemo(() => {
    if (!formProjectId) {
      if (isAdminOrSupervisor) {
        return userOptions;
      }

      return [
        {
          label: `${currentUser?.name} (${currentUser?.role})`,
          value: currentUser?.id,
        },
      ];
    }

    if (isAdminOrSupervisor || currentUserFormProjectRole === "lead") {
      return formProjectMembers
        .map((member) => {
          const memberUser = member.user;

          if (!memberUser) {
            return null;
          }

          return {
            label: `${memberUser.name} (${member.projectRole})`,
            value: memberUser.id,
          };
        })
        .filter(Boolean);
    }

    return [
      {
        label: `${currentUser?.name} (${currentUser?.role})`,
        value: currentUser?.id,
      },
    ];
  }, [
    currentUserFormProjectRole,
    formProjectId,
    formProjectMembers,
    isAdminOrSupervisor,
    currentUser,
    userOptions,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (task) {
      form.setFieldsValue({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? dayjs(task.dueDate) : null,
        projectId: task.projectId || undefined,
        assignedToId: task.assignedToId || currentUser?.id,
      });

      return;
    }

    form.resetFields();

    form.setFieldsValue({
      status: "todo",
      priority: "medium",
      assignedToId: isAdminOrSupervisor ? undefined : currentUser?.id,
    });
  }, [open, task, form, currentUser?.id, isAdminOrSupervisor]);

  const handleFinish = (values) => {
    const resolvedAssignedToId =
      values.assignedToId || (!isAdminOrSupervisor ? currentUser?.id : null);

    const payload = isMemberSelfEditingAssignedProjectTask
      ? {
          status: values.status,
          description: values.description,
        }
      : {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          dueDate: values.dueDate ? values.dueDate.format("YYYY-MM-DD") : null,
          assignedToId: resolvedAssignedToId,
        };

    if (!isEditingTask) {
      payload.projectId = values.projectId || null;
    }

    onSubmit(payload);
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={isEditingTask ? "Edit Task" : "Create Task"}
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnHidden
    >
      <Form layout="vertical" form={form} onFinish={handleFinish}>
        <Form.Item
          label="Task Title"
          name="title"
          rules={[
            {
              required: true,
              message: "Please enter a task title.",
            },
            {
              min: 3,
              message: "Task title must be at least 3 characters.",
            },
          ]}
        >
          <Input
            placeholder="Prepare caffeine calibration standards"
            disabled={isMemberSelfEditingAssignedProjectTask}
          />
        </Form.Item>

        <Form.Item label="Project" name="projectId">
          <Select
            allowClear
            placeholder="Optionally link this task to a project"
            loading={isLoadingProjects}
            options={projectOptions}
            disabled={isEditingTask}
            onChange={async (nextProjectId) => {
              const normalizedProjectId = nextProjectId || null;

              if (!isAdminOrSupervisor) {
                form.setFieldValue("assignedToId", currentUser?.id);
              }

              await onProjectChange(normalizedProjectId);
            }}
          />
        </Form.Item>

        {formProjectId && !canCreateTaskForFormProject && !isEditingTask && (
          <Alert
            type="warning"
            showIcon
            message="You cannot create project-linked tasks for this project."
            description="Only admins, project supervisors, and project leads can create and assign project-linked tasks."
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item label="Assign To" name="assignedToId">
          <Select
            allowClear={isAdminOrSupervisor}
            placeholder="Assign to a lab member"
            loading={isLoadingUsers || isLoadingFormProjectMembers}
            options={formAssigneeOptions}
            disabled={
              isMemberSelfEditingAssignedProjectTask ||
              !canAssignTaskForSelectedProject
            }
          />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <TextArea
            rows={4}
            placeholder="Describe the task, expected output, or lab work required."
          />
        </Form.Item>

        <Form.Item
          label="Status"
          name="status"
          rules={[
            {
              required: true,
              message: "Please select a task status.",
            },
          ]}
        >
          <Select options={TASK_STATUS_OPTIONS} />
        </Form.Item>

        <Form.Item
          label="Priority"
          name="priority"
          rules={[
            {
              required: true,
              message: "Please select a priority.",
            },
          ]}
        >
          <Select
            options={TASK_PRIORITY_OPTIONS}
            disabled={isMemberSelfEditingAssignedProjectTask}
          />
        </Form.Item>

        <Form.Item label="Due Date" name="dueDate">
          <DatePicker
            style={{ width: "100%" }}
            disabled={isMemberSelfEditingAssignedProjectTask}
          />
        </Form.Item>

        <Space style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleCancel}>Cancel</Button>

          <Button
            type="primary"
            htmlType="submit"
            loading={isSubmitting}
            disabled={!canCreateTaskForFormProject && !isEditingTask}
          >
            {isEditingTask ? "Save Changes" : "Create Task"}
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};

export default TaskFormModal;
