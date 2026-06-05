import { DatePicker, Form, Input, Modal, Select, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { createProject, updateProject } from "../../api/projectApi";
import { PROJECT_STATUS_OPTIONS } from "../../constants/statusOptions";

const ProjectFormModal = ({
  open,
  project,
  users,
  isLoadingUsers,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(project);

  const supervisorOptions = useMemo(() => {
    return users
      .filter((user) => ["admin", "supervisor"].includes(user.role))
      .map((user) => ({
        label: `${user.name} (${user.role})`,
        value: user.id,
      }));
  }, [users]);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      if (project) {
        form.setFieldsValue({
          title: project.title,
          description: project.description,
          status: project.status,
          supervisorId: project.supervisorId,
          startDate: project.startDate ? dayjs(project.startDate) : null,
          targetEndDate: project.targetEndDate
            ? dayjs(project.targetEndDate)
            : null,
        });

        return;
      }

      form.resetFields();

      form.setFieldsValue({
        status: "planning",
      });
    });
  }, [form, open, project]);

  const handleSubmit = async (values) => {
    try {
      setIsSubmitting(true);

      const payload = {
        title: values.title,
        description: values.description,
        status: values.status,
        supervisorId: values.supervisorId,
        startDate: values.startDate
          ? values.startDate.format("YYYY-MM-DD")
          : null,
        targetEndDate: values.targetEndDate
          ? values.targetEndDate.format("YYYY-MM-DD")
          : null,
      };

      if (isEditing) {
        await updateProject(project.id, payload);
        message.success("Project updated successfully.");
      } else {
        await createProject(payload);
        message.success("Project created successfully.");
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to save project.";

      message.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEditing ? "Edit Project" : "Create Project"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={isSubmitting}
      okText={isEditing ? "Save Changes" : "Create Project"}
      destroyOnHidden
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item
          label="Project Title"
          name="title"
          rules={[
            {
              required: true,
              message: "Please enter a project title.",
            },
            {
              min: 3,
              message: "Project title must be at least 3 characters.",
            },
          ]}
        >
          <Input placeholder="HPLC Method Development for Caffeine Analysis" />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <Input.TextArea
            rows={4}
            placeholder="Briefly describe the research objective, scope, or study goal."
          />
        </Form.Item>

        <Form.Item
          label="Status"
          name="status"
          rules={[
            {
              required: true,
              message: "Please select a project status.",
            },
          ]}
        >
          <Select options={PROJECT_STATUS_OPTIONS} />
        </Form.Item>

        <Form.Item
          label="Supervisor"
          name="supervisorId"
          rules={[
            {
              required: true,
              message: "Please select a project supervisor.",
            },
          ]}
        >
          <Select
            placeholder="Select project supervisor"
            loading={isLoadingUsers}
            options={supervisorOptions}
          />
        </Form.Item>

        <Form.Item label="Start Date" name="startDate">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Target End Date" name="targetEndDate">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectFormModal;
