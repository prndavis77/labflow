import { Alert, DatePicker, Form, Input, Modal, Select, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { createExperiment, updateExperiment } from "../../api/experimentApi";
import {
  EXPERIMENT_STATUS_OPTIONS,
  EDITABLE_REVIEW_STATUS_OPTIONS,
} from "../../constants/statusOptions";
import { fetchProjectMembers } from "../../api/projectMemberApi";
import {
  getCurrentUserProjectRole,
  canCreateExperimentInProject,
} from "../../utils/projectRoleAccess";

const ExperimentFormModal = ({
  open,
  experiment,
  projects = [],
  users = [],
  tasks = [],
  protocols = [],
  defaultProjectId,
  currentUser,
  isLoadingProjects = false,
  isLoadingUsers = false,
  isLoadingTasks = false,
  isLoadingProtocols = false,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formProjectMembers, setFormProjectMembers] = useState([]);
  const [isLoadingProjectMembers, setIsLoadingProjectMembers] = useState(false);

  const isEditing = Boolean(experiment);

  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: Number(project.id),
    }));
  }, [projects]);

  const researcherOptions = useMemo(() => {
    return users.map((user) => ({
      label: `${user.name} (${user.email})`,
      value: Number(user.id),
    }));
  }, [users]);

  const watchedProjectId = Form.useWatch("projectId", form);

  const loadFormProjectMembers = async (projectId) => {
    if (!projectId) {
      setFormProjectMembers([]);
      return;
    }

    try {
      setIsLoadingProjectMembers(true);

      const result = await fetchProjectMembers({
        projectId,
      });

      setFormProjectMembers(result.data.projectMembers);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load project members.";

      message.error(messageText);
      setFormProjectMembers([]);
    } finally {
      setIsLoadingProjectMembers(false);
    }
  };

  const currentUserFormProjectRole = useMemo(() => {
    return getCurrentUserProjectRole(
      formProjectMembers,
      currentUser,
      watchedProjectId,
    );
  }, [formProjectMembers, currentUser, watchedProjectId]);

  const canCreateForSelectedProject =
    isEditing ||
    !watchedProjectId ||
    canCreateExperimentInProject(currentUser, currentUserFormProjectRole);

  const shouldBlockCreateForSelectedProject =
    !isEditing && watchedProjectId && !canCreateForSelectedProject;

  // Converts tasks into options
  // If a project is selected in the form, the list is narrowed to that project
  const taskOptions = useMemo(() => {
    return tasks
      .filter((task) => {
        if (!watchedProjectId) {
          return true;
        }

        return Number(task.projectId) === Number(watchedProjectId);
      })
      .map((task) => ({
        label: task.title,
        value: Number(task.id),
      }));
  }, [tasks, watchedProjectId]);

  // Converts protocols into options
  // If a project is selected in the form, the list is narrowed to that project
  const protocolOptions = useMemo(() => {
    return protocols
      .filter((protocol) => {
        if (!watchedProjectId) {
          return true;
        }

        if (Number(protocol.projectId) === Number(watchedProjectId)) {
          return true;
        }

        if (!protocol.projectId) {
          return true;
        }

        return false;
      })
      .map((protocol) => ({
        label: protocol.equipment
          ? `${protocol.title} v${protocol.version} (${protocol.equipment.name})`
          : `${protocol.title} v${protocol.version}`,
        value: protocol.id,
      }));
  }, [protocols, watchedProjectId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      if (experiment) {
        form.setFieldsValue({
          title: experiment.title,
          objective: experiment.objective,
          notes: experiment.notes,
          status: experiment.status,
          startedAt: experiment.startedAt ? dayjs(experiment.startedAt) : null,
          completedAt: experiment.completedAt
            ? dayjs(experiment.completedAt)
            : null,
          projectId: experiment.projectId,
          researcherId: experiment.researcherId,
          taskId: experiment.taskId || null,
          protocolId: experiment.protocolId || null,
        });

        return;
      }

      form.resetFields();

      form.setFieldsValue({
        status: "planned",
        reviewStatus: "not_submitted",
        projectId: defaultProjectId ? Number(defaultProjectId) : undefined,
        researcherId: currentUser?.id ? Number(currentUser.id) : undefined,
      });
    });
  }, [experiment, form, open, defaultProjectId, currentUser?.id]);

  useEffect(() => {
    if (!open || isEditing) {
      return;
    }

    queueMicrotask(() => {
      loadFormProjectMembers(watchedProjectId);
    });
  }, [open, isEditing, watchedProjectId]);

  const handleSubmit = async (values) => {
    if (shouldBlockCreateForSelectedProject) {
      message.error(
        "You do not have permission to create experiments for this project.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        title: values.title,
        objective: values.objective,
        notes: values.notes,
        status: values.status,
        startedAt: values.startedAt
          ? values.startedAt.format("YYYY-MM-DD")
          : null,
        completedAt: values.completedAt
          ? values.completedAt.format("YYYY-MM-DD")
          : null,
        researcherId: values.researcherId,
        taskId: values.taskId || null,
        protocolId: values.protocolId || null,
      };
      if (!isEditing) {
        payload.projectId = values.projectId;
        payload.reviewStatus = values.reviewStatus || "not_submitted";
      }

      if (isEditing) {
        await updateExperiment(experiment.id, payload);
        message.success("Experiment updated successfully.");
      } else {
        await createExperiment(payload);
        message.success("Experiment created successfully.");
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save experiment.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEditing ? "Edit Experiment" : "Create Experiment"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={isSubmitting}
      okText={isEditing ? "Save Changes" : "Create Experiment"}
      okButtonProps={{
        disabled: shouldBlockCreateForSelectedProject,
      }}
      destroyOnHidden
      width={760}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item
          label="Title"
          name="title"
          rules={[
            {
              required: true,
              message: "Experiment title is required.",
            },
          ]}
        >
          <Input placeholder="Enter experiment title" />
        </Form.Item>

        <Form.Item label="Objective" name="objective">
          <Input.TextArea
            rows={3}
            placeholder="Describe the experiment objective"
          />
        </Form.Item>

        <Form.Item label="Notes" name="notes">
          <Input.TextArea rows={4} placeholder="Add experiment notes" />
        </Form.Item>

        <Form.Item
          label="Project"
          name="projectId"
          rules={[
            {
              required: true,
              message: "Please select a project.",
            },
          ]}
        >
          <Select
            placeholder="Select project"
            loading={isLoadingProjects || isLoadingProjectMembers}
            options={projectOptions}
            disabled={isEditing} // Disable changing project when editing
          />
        </Form.Item>

        {shouldBlockCreateForSelectedProject && (
          <Alert
            type="warning"
            showIcon
            message="You cannot create experiments for this project."
            description="Only admins, project supervisors, project leads, and workflow-authorized project members can create project-linked experiments."
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item
          label="Researcher"
          name="researcherId"
          rules={[
            {
              required: true,
              message: "Please select a researcher.",
            },
          ]}
        >
          <Select
            placeholder="Select researcher"
            loading={isLoadingUsers}
            options={researcherOptions}
          />
        </Form.Item>

        <Form.Item label="Linked Task" name="taskId">
          <Select
            allowClear
            placeholder="Optionally link a task"
            loading={isLoadingTasks}
            options={taskOptions}
          />
        </Form.Item>

        <Form.Item label="Linked Protocol" name="protocolId">
          <Select
            allowClear
            placeholder="Optionally link a protocol"
            loading={isLoadingProtocols}
            options={protocolOptions}
          />
        </Form.Item>

        <Form.Item
          label="Status"
          name="status"
          rules={[
            {
              required: true,
              message: "Please select a status.",
            },
          ]}
        >
          <Select options={EXPERIMENT_STATUS_OPTIONS} />
        </Form.Item>

        {!isEditing && (
          <Form.Item
            label="Review Status"
            name="reviewStatus"
            rules={[
              {
                required: true,
                message: "Please select a review status.",
              },
            ]}
          >
            <Select options={EDITABLE_REVIEW_STATUS_OPTIONS} />
          </Form.Item>
        )}

        <Form.Item label="Started Date" name="startedAt">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Completed Date" name="completedAt">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ExperimentFormModal;
