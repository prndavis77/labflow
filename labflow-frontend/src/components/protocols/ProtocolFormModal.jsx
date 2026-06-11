import { Alert, Form, Input, Modal, Select, message } from "antd";
import { useEffect, useMemo, useState } from "react";

import { createProtocol, updateProtocol } from "../../api/protocolApi";
import { EDITABLE_APPROVAL_STATUS_OPTIONS } from "../../constants/statusOptions";

import { fetchProjectMembers } from "../../api/projectMemberApi";
import {
  getCurrentUserProjectRole,
  canCreateProtocolInProject,
  canManageGeneralProtocol,
} from "../../utils/projectRoleAccess";

const ProtocolFormModal = ({
  open,
  protocol,
  projects = [],
  equipment = [],
  currentUser,
  isLoadingProjects = false,
  isLoadingEquipment = false,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formProjectMembers, setFormProjectMembers] = useState([]);
  const [isLoadingProjectMembers, setIsLoadingProjectMembers] = useState(false);

  const isEditing = Boolean(protocol);

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

  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      label: project.title,
      value: project.id,
    }));
  }, [projects]);

  const equipmentOptions = useMemo(() => {
    return equipment.map((item) => ({
      label: `${item.name} (${item.type})`,
      value: item.id,
    }));
  }, [equipment]);

  const currentUserFormProjectRole = useMemo(() => {
    return getCurrentUserProjectRole(
      formProjectMembers,
      currentUser,
      watchedProjectId,
    );
  }, [formProjectMembers, currentUser, watchedProjectId]);

  const canCreateForSelectedProject =
    isEditing ||
    (watchedProjectId
      ? canCreateProtocolInProject(currentUser, currentUserFormProjectRole)
      : canManageGeneralProtocol(currentUser));

  const shouldBlockCreateForSelectedProject =
    !isEditing && !canCreateForSelectedProject;

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      if (protocol) {
        form.setFieldsValue({
          title: protocol.title,
          version: protocol.version,
          purpose: protocol.purpose,
          content: protocol.content,
          projectId: protocol.projectId || null,
          equipmentId: protocol.equipmentId || null,
        });

        return;
      }

      form.resetFields();

      form.setFieldsValue({
        version: "1.0",
        approvalStatus: "draft",
      });
    });
  }, [form, open, protocol]);

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
        watchedProjectId
          ? "You do not have permission to create protocols for this project."
          : "Only admins and supervisors can create general SOPs.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        title: values.title,
        version: values.version,
        purpose: values.purpose,
        content: values.content,
        equipmentId: values.equipmentId || null,
      };

      if (!isEditing) {
        payload.projectId = values.projectId || null;
        payload.approvalStatus = values.approvalStatus || "draft";
      }

      if (isEditing) {
        await updateProtocol(protocol.id, payload);
        message.success("Protocol updated successfully.");
      } else {
        await createProtocol(payload);
        message.success("Protocol created successfully.");
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save protocol.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEditing ? "Edit Protocol" : "Create Protocol"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={isSubmitting}
      okText={isEditing ? "Save Changes" : "Create Protocol"}
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
              message: "Protocol title is required.",
            },
          ]}
        >
          <Input placeholder="Enter protocol title" />
        </Form.Item>

        <Form.Item
          label="Version"
          name="version"
          rules={[
            {
              required: true,
              message: "Protocol version is required.",
            },
          ]}
        >
          <Input placeholder="Example: 1.0" />
        </Form.Item>

        <Form.Item label="Purpose" name="purpose">
          <Input.TextArea
            rows={3}
            placeholder="Describe the purpose of this protocol"
          />
        </Form.Item>

        <Form.Item
          label="Content"
          name="content"
          rules={[
            {
              required: true,
              message: "Protocol content is required.",
            },
          ]}
        >
          <Input.TextArea
            rows={8}
            placeholder="Enter protocol steps, method notes, or SOP content"
          />
        </Form.Item>

        {!isEditing && (
          <Form.Item
            label="Approval Status"
            name="approvalStatus"
            rules={[
              {
                required: true,
                message: "Please select an approval status.",
              },
            ]}
          >
            <Select options={EDITABLE_APPROVAL_STATUS_OPTIONS} />
          </Form.Item>
        )}

        <Form.Item label="Project" name="projectId">
          <Select
            allowClear
            placeholder="Optionally link this protocol to a project"
            loading={isLoadingProjects || isLoadingProjectMembers}
            options={projectOptions}
            disabled={isEditing}
          />
        </Form.Item>

        {shouldBlockCreateForSelectedProject && (
          <Alert
            type="warning"
            showIcon
            message={
              watchedProjectId
                ? "You cannot create protocols for this project."
                : "You cannot create general SOPs."
            }
            description={
              watchedProjectId
                ? "Only admins, project supervisors, project leads, and workflow-authorized project members can create project-linked protocols."
                : "General SOPs can only be created by admins and supervisors."
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item label="Equipment" name="equipmentId">
          <Select
            allowClear
            placeholder="Optionally link this protocol to equipment"
            loading={isLoadingEquipment}
            options={equipmentOptions}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProtocolFormModal;
