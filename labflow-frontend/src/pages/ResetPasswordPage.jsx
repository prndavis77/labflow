import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Result,
  Spin,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { completePasswordReset, getPasswordResetStatus } from "../api/authApi";

const { Title, Paragraph } = Typography;

const INVALID_LINK_MESSAGE =
  "This password reset link is invalid, expired, or has already been used.";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [isValidating, setIsValidating] = useState(true);

  const [isTokenValid, setIsTokenValid] = useState(false);

  const [expiresAt, setExpiresAt] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      try {
        setIsValidating(true);
        setErrorMessage("");

        if (!token) {
          throw new Error("Password reset token is missing.");
        }

        const result = await getPasswordResetStatus(token);

        if (!isMounted) {
          return;
        }

        setIsTokenValid(true);
        setExpiresAt(result.data?.expiresAt || null);
      } catch {
        if (!isMounted) {
          return;
        }

        setIsTokenValid(false);
        setExpiresAt(null);
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (values) => {
    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const result = await completePasswordReset({
        token,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      });

      navigate("/login", {
        replace: true,
        state: {
          message:
            result.message ||
            "Your password has been reset successfully. You can now log in.",
        },
      });
    } catch (error) {
      const responseMessage = error.response?.data?.message;

      setErrorMessage(
        responseMessage ||
          "The password could not be reset. Please request a new reset link.",
      );

      if (error.response?.status === 400) {
        const normalizedMessage = String(responseMessage || "").toLowerCase();

        if (
          normalizedMessage.includes("invalid") ||
          normalizedMessage.includes("expired")
        ) {
          setIsTokenValid(false);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isTokenValid) {
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
        <Card style={{ width: 500 }}>
          <Result
            status="warning"
            title="Reset Link Unavailable"
            subTitle={INVALID_LINK_MESSAGE}
            extra={[
              <Button
                key="request"
                type="primary"
                onClick={() => navigate("/forgot-password")}
              >
                Request a New Link
              </Button>,

              <Button key="login" onClick={() => navigate("/login")}>
                Return to Login
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  const formattedExpiration = expiresAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(expiresAt))
    : null;

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
        <Title level={2}>Choose a New Password</Title>

        <Paragraph>
          Enter and confirm the new password for your LabFlow account.
        </Paragraph>

        {formattedExpiration && (
          <Alert
            type="info"
            showIcon
            message={`This link expires ${formattedExpiration}.`}
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

        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="New Password"
            name="password"
            rules={[
              {
                required: true,
                message: "Please enter a new password.",
              },
              {
                min: 8,
                message: "Password must be at least 8 characters long.",
              },
            ]}
            hasFeedback
          >
            <Input.Password
              autoComplete="new-password"
              placeholder="Enter a new password"
            />
          </Form.Item>

          <Form.Item
            label="Confirm New Password"
            name="passwordConfirmation"
            dependencies={["password"]}
            hasFeedback
            rules={[
              {
                required: true,
                message: "Please confirm the new password.",
              },
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
            <Input.Password
              autoComplete="new-password"
              placeholder={"Confirm the new password"}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={isSubmitting}>
            Reset Password
          </Button>
        </Form>

        <Paragraph
          style={{
            marginTop: 16,
            marginBottom: 0,
            textAlign: "center",
          }}
        >
          <Link to="/login">Return to login</Link>
        </Paragraph>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
