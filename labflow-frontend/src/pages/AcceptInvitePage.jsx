import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Result,
  Space,
  Spin,
  Typography,
  message,
} from "antd";

import {
  acceptInvitation,
  getInvitationForAcceptance,
} from "../api/invitationApi";

const { Title, Text } = Typography;

const formatRole = (role) => {
  if (!role) {
    return "Unknown";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

const AcceptInvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(
    token ? "" : "Invitation token is missing.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;

    const loadInvitation = async () => {
      try {
        const response = await getInvitationForAcceptance(token);

        if (isMounted) {
          setInvitation(response.data.invitation);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error.response?.data?.message ||
              "Invitation not found or no longer valid.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInvitation();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (values) => {
    setSubmitting(true);

    try {
      await acceptInvitation(token, {
        password: values.password,
      });

      message.success("Invitation accepted. You can now log in.");
      navigate("/login");
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to accept invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 520, margin: "80px auto", textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 620, margin: "80px auto" }}>
        <Result
          status="warning"
          title="Invitation unavailable"
          subTitle={loadError}
          extra={
            <Button type="primary" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: "0 16px" }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              Accept Your LabFlow Invitation
            </Title>

            <Text type="secondary">
              Set a password to finish creating your LabFlow account.
            </Text>
          </div>

          <Alert
            type="info"
            showIcon
            message="Invitation details"
            description={
              <Space direction="vertical">
                <Text>
                  <strong>Name:</strong> {invitation.name}
                </Text>
                <Text>
                  <strong>Email:</strong> {invitation.email}
                </Text>
                <Text>
                  <strong>Role:</strong> {formatRole(invitation.role)}
                </Text>
                <Text>
                  <strong>Organization:</strong>{" "}
                  {invitation.organization?.name || "Unknown"}
                </Text>
              </Space>
            }
          />

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: "Password is required." },
                {
                  min: 8,
                  message: "Password must be at least 8 characters long.",
                },
              ]}
              hasFeedback
            >
              <Input.Password placeholder="Enter your password" />
            </Form.Item>

            <Form.Item
              label="Confirm password"
              name="confirmPassword"
              dependencies={["password"]}
              hasFeedback
              rules={[
                { required: true, message: "Please confirm your password." },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(
                      new Error("The passwords do not match."),
                    );
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm your password" />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Accept Invitation
              </Button>

              <Button onClick={() => navigate("/login")}>Cancel</Button>
            </Space>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default AcceptInvitePage;
