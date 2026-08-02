import { Button, Card, Form, Input, Typography, Alert, message } from "antd";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/useAuth";

const { Title, Paragraph } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form] = Form.useForm();

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const invitedEmail = location.state?.email;

    if (invitedEmail) {
      form.setFieldsValue({
        email: invitedEmail,
      });
    }

    const successMessage = location.state?.message;

    if (successMessage) {
      message.success({
        key: "invitation-accepted",
        content: successMessage,
      });

      navigate("/login", {
        replace: true,
        state: null,
      });
    }
  }, [form, location.state, navigate]);

  const handleLogin = async (values) => {
    try {
      setErrorMessage("");
      setIsSubmitting(true);

      await login(values);

      navigate("/dashboard");
    } catch (error) {
      const loginErrorMessage =
        error.response?.data?.message || "Login failed. Please try again.";

      setErrorMessage(loginErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Card style={{ width: 420 }}>
        <Title level={2}>Log In to LabFlow</Title>

        <Paragraph>
          Access your organization’s projects, experiments, protocols, tasks,
          and equipment.
        </Paragraph>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleLogin}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                required: true,
                message: "Please enter your email.",
              },
              {
                type: "email",
                message: "Please enter a valid email.",
              },
            ]}
          >
            <Input placeholder="ann.keller@university.edu" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              {
                required: true,
                message: "Please enter your password.",
              },
            ]}
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={isSubmitting}>
            Log In
          </Button>
        </Form>

        <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          Setting up a new organization?{" "}
          <Link to="/register">Create Workspace</Link>
        </Paragraph>
      </Card>
    </div>
  );
};

export default LoginPage;
