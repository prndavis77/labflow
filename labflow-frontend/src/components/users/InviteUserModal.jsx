import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  message,
} from "antd";

import { createInvitation } from "../../api/invitationApi";

const InviteUserModal = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const selectedRole = Form.useWatch("role", form);

  const handleClose = () => {
    form.resetFields();
    setInviteLink("");
    onClose();
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setInviteLink("");

    try {
      const payload = {
        name: values.name,
        email: values.email,
        department: values.department?.trim() || null,
        role: values.role,
        canCreateExperiments:
          values.role === "researcher"
            ? Boolean(values.canCreateExperiments)
            : false,
        canEditExperiments:
          values.role === "researcher"
            ? Boolean(values.canEditExperiments)
            : false,
        canCreateProtocols:
          values.role === "researcher"
            ? Boolean(values.canCreateProtocols)
            : false,
        canEditProtocols:
          values.role === "researcher"
            ? Boolean(values.canEditProtocols)
            : false,
      };

      const response = await createInvitation(payload);

      setInviteLink(response.data.inviteLink);
      message.success("Invitation created.");
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to create invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Invite User"
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          role: "researcher",
          canCreateExperiments: false,
          canEditExperiments: false,
          canCreateProtocols: false,
          canEditProtocols: false,
        }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Name is required." }]}
        >
          <Input placeholder="New Researcher" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: "Email is required." },
            { type: "email", message: "Enter a valid email address." },
          ]}
        >
          <Input placeholder="new.researcher@example.com" />
        </Form.Item>

        <Form.Item label="Department" name="department">
          <Input placeholder="Analytical Chemistry" />
        </Form.Item>

        <Form.Item
          label="Role"
          name="role"
          rules={[{ required: true, message: "Role is required." }]}
        >
          <Select
            options={[
              { value: "researcher", label: "Researcher" },
              { value: "supervisor", label: "Supervisor" },
              { value: "admin", label: "Admin" },
            ]}
          />
        </Form.Item>

        {selectedRole === "researcher" && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Text strong>
              Researcher workflow permissions
            </Typography.Text>

            <Form.Item name="canCreateExperiments" valuePropName="checked">
              <Checkbox>Create experiments</Checkbox>
            </Form.Item>

            <Form.Item name="canEditExperiments" valuePropName="checked">
              <Checkbox>Edit experiments</Checkbox>
            </Form.Item>

            <Form.Item name="canCreateProtocols" valuePropName="checked">
              <Checkbox>Create protocols</Checkbox>
            </Form.Item>

            <Form.Item name="canEditProtocols" valuePropName="checked">
              <Checkbox>Edit protocols</Checkbox>
            </Form.Item>
          </Space>
        )}

        {inviteLink && (
          <Alert
            type="success"
            showIcon
            message="Invitation link created"
            description={
              <Space direction="vertical" style={{ width: "100%" }}>
                <Typography.Text copyable>{inviteLink}</Typography.Text>
                <Typography.Text type="secondary">
                  Copy this link and send it to the invited user. Email sending
                  is not implemented yet.
                </Typography.Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Create Invitation
          </Button>

          <Button onClick={handleClose}>Close</Button>
        </Space>
      </Form>
    </Modal>
  );
};

export default InviteUserModal;
