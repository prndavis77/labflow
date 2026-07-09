import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Typography,
  message,
} from "antd";

import { getOrganization, updateOrganization } from "../api/organizationApi";
import { useAuth } from "../context/useAuth";

const { Title, Paragraph } = Typography;

const ORGANIZATION_TYPE_OPTIONS = [
  { value: "lab", label: "University Lab" },
  { value: "department", label: "Department" },
  { value: "institution", label: "Institution" },
  { value: "company", label: "Company" },
  { value: "demo", label: "Demo" },
];

const OrganizationSettingsPage = () => {
  const { user, refreshCurrentUser } = useAuth();
  const [form] = Form.useForm();

  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let isMounted = true;

    const loadOrganization = async () => {
      try {
        const response = await getOrganization();

        if (!isMounted) {
          return;
        }

        const loadedOrganization = response.data.organization;

        setOrganization(loadedOrganization);
        form.setFieldsValue({
          name: loadedOrganization.name,
          type: loadedOrganization.type,
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error.response?.data?.message ||
              "Failed to load organization settings.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadOrganization();

    return () => {
      isMounted = false;
    };
  }, [form]);

  const handleSubmit = async (values) => {
    setIsSaving(true);

    try {
      const response = await updateOrganization({
        name: values.name?.trim(),
        type: values.type || null,
      });

      const updatedOrganization = response.data.organization;

      setOrganization(updatedOrganization);
      form.setFieldsValue({
        name: updatedOrganization.name,
        type: updatedOrganization.type,
      });

      await refreshCurrentUser();

      message.success("Organization settings updated.");
    } catch (error) {
      message.error(
        error.response?.data?.message ||
          "Failed to update organization settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Title level={2}>Organization Settings</Title>
        <Paragraph>
          View and manage the current lab workspace for your LabFlow account.
        </Paragraph>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {organization && (
          <Descriptions bordered column={1} size="middle">
            <Descriptions.Item label="Organization ID">
              {organization.id}
            </Descriptions.Item>
            <Descriptions.Item label="Slug">
              {organization.slug}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {organization.isActive ? "Active" : "Inactive"}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {organization.createdAt
                ? new Date(organization.createdAt).toLocaleString()
                : "Not set"}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {organization.updatedAt
                ? new Date(organization.updatedAt).toLocaleString()
                : "Not set"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card title="Editable Settings">
        {!isAdmin && (
          <Alert
            type="info"
            showIcon
            message="Only admins can edit organization settings."
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Organization Name"
            name="name"
            rules={[
              {
                required: true,
                message: "Organization name is required.",
              },
            ]}
          >
            <Input disabled={!isAdmin} placeholder="DNA Laboratory" />
          </Form.Item>

          <Form.Item label="Organization Type" name="type">
            <Select
              disabled={!isAdmin}
              allowClear
              placeholder="Select organization type"
              options={ORGANIZATION_TYPE_OPTIONS}
            />
          </Form.Item>

          {isAdmin && (
            <Button type="primary" htmlType="submit" loading={isSaving}>
              Save Changes
            </Button>
          )}
        </Form>
      </Card>
    </Space>
  );
};

export default OrganizationSettingsPage;
