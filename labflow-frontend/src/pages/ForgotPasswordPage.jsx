import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router";

import { requestPasswordReset } from "../api/authApi";

const { Title, Paragraph, Text } = Typography;

const ForgotPasswordPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (values) => {
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const result = await requestPasswordReset(values.email);

      setSuccessMessage(
        result.message ||
          "If an account exists for that email address, password reset instructions have been sent.",
      );
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "The password reset request could not be completed. Please try again.",
      );
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
        padding: 16,
      }}
    >
      <Card style={{ width: 420 }}>
        <Title level={2}>Reset Your Password</Title>

        <Paragraph>
          Enter the email address associated with your LabFlow account.
        </Paragraph>

        <Paragraph type="secondary">
          For security, LabFlow displays the same confirmation whether or not an
          account exists for the submitted address.
        </Paragraph>

        {successMessage && (
          <Alert
            type="success"
            showIcon
            message="Check your email"
            description={successMessage}
            style={{ marginBottom: 16 }}
          />
        )}

        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message={errorMessage}
            style={{ marginBottom: 16 }}
          />
        )}

        {!successMessage && (
          <Form layout="vertical" onFinish={handleSubmit}>
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
              <Input
                autoComplete="email"
                placeholder={"ann.keller@university.edu"}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={isSubmitting}
            >
              Send Reset Instructions
            </Button>
          </Form>
        )}

        {successMessage && (
          <Button
            block
            onClick={() => {
              setSuccessMessage("");
              setErrorMessage("");
            }}
          >
            Submit Another Email
          </Button>
        )}

        <Paragraph
          style={{
            marginTop: 16,
            marginBottom: 0,
            textAlign: "center",
          }}
        >
          <Text type="secondary">Remembered your password? </Text>

          <Link to="/login">Return to login</Link>
        </Paragraph>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
