import { Button, Card, Form, Input, Typography, Alert } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/useAuth";

const { Title, Paragraph } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (values) => {
    try {
      setErrorMessage("");
      setIsSubmitting(true);

      await login(values);

      navigate("/dashboard");
    } catch (error) {
      const message =
        error.response?.data?.message || "Login failed. Please try again.";

      setErrorMessage(message);
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
        <Title level={2}>Login</Title>

        <Paragraph>
          Sign in to manage laboratory projects, experiments, tasks, and
          equipment bookings
        </Paragraph>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form layout="vertical" onFinish={handleLogin}>
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
            Login
          </Button>
        </Form>

        <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          Need an account? <Link to="/register">Create one</Link>
        </Paragraph>
      </Card>
    </div>
  );
};

export default LoginPage;
