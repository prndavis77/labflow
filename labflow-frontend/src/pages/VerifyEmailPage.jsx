import { Alert, Button, Card, Result, Spin, Typography } from "antd";
import { CheckCircleOutlined, MailOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import {
  completeEmailVerification,
  getEmailVerificationStatus,
} from "../api/authApi";
import { useAuth } from "../context/useAuth";

const { Paragraph, Text } = Typography;

const STATUS = {
  LOADING: "loading",
  VALID: "valid",
  VERIFYING: "verifying",
  VERIFIED: "verified",
  ALREADY_VERIFIED: "already_verified",
  INVALID: "invalid",
  ERROR: "error",
};

const VerifyEmailPage = () => {
  const { token } = useParams();

  const { isAuthenticated, refreshCurrentUser } = useAuth();

  const [status, setStatus] = useState(token ? STATUS.LOADING : STATUS.INVALID);

  const [expiresAt, setExpiresAt] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");

  const applyValidationResult = useCallback(
    async (result) => {
      if (result.data?.alreadyVerified) {
        if (isAuthenticated) {
          await refreshCurrentUser();
        }

        setExpiresAt(null);
        setStatus(STATUS.ALREADY_VERIFIED);
        return;
      }

      setExpiresAt(result.data?.expiresAt || null);

      setStatus(STATUS.VALID);
    },
    [isAuthenticated, refreshCurrentUser],
  );

  const applyValidationError = useCallback((error) => {
    if (error.response?.status === 400) {
      setExpiresAt(null);
      setStatus(STATUS.INVALID);
      return;
    }

    setErrorMessage(
      error.response?.data?.message ||
        "The verification link could not be checked. Please try again.",
    );

    setStatus(STATUS.ERROR);
  }, []);

  const validateToken = useCallback(async () => {
    if (!token) {
      setExpiresAt(null);
      setStatus(STATUS.INVALID);
      return;
    }

    setErrorMessage("");
    setStatus(STATUS.LOADING);

    try {
      const result = await getEmailVerificationStatus(token);

      await applyValidationResult(result);
    } catch (error) {
      applyValidationError(error);
    }
  }, [token, applyValidationResult, applyValidationError]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isCancelled = false;

    const loadVerificationStatus = async () => {
      try {
        const result = await getEmailVerificationStatus(token);

        if (isCancelled) {
          return;
        }

        if (result.data?.alreadyVerified) {
          if (isAuthenticated) {
            await refreshCurrentUser();
          }

          if (isCancelled) {
            return;
          }

          setExpiresAt(null);
          setStatus(STATUS.ALREADY_VERIFIED);

          return;
        }

        setExpiresAt(result.data?.expiresAt || null);

        setStatus(STATUS.VALID);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (error.response?.status === 400) {
          setExpiresAt(null);
          setStatus(STATUS.INVALID);
          return;
        }

        setErrorMessage(
          error.response?.data?.message ||
            "The verification link could not be checked. Please try again.",
        );

        setStatus(STATUS.ERROR);
      }
    };

    void loadVerificationStatus();

    return () => {
      isCancelled = true;
    };
  }, [token, isAuthenticated, refreshCurrentUser]);

  const handleVerify = async () => {
    try {
      setErrorMessage("");
      setStatus(STATUS.VERIFYING);

      const result = await completeEmailVerification(token);

      if (isAuthenticated) {
        await refreshCurrentUser();
      }

      if (result.data?.alreadyVerified) {
        setStatus(STATUS.ALREADY_VERIFIED);

        return;
      }

      setStatus(STATUS.VERIFIED);
    } catch (error) {
      if (error.response?.status === 400) {
        setStatus(STATUS.INVALID);
        return;
      }

      setErrorMessage(
        error.response?.data?.message ||
          "Your email address could not be verified. Please try again.",
      );

      setStatus(STATUS.ERROR);
    }
  };

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
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 520,
        }}
      >
        {status === STATUS.LOADING && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
            }}
          >
            <Spin size="large" />

            <Paragraph
              style={{
                marginTop: 20,
                marginBottom: 0,
              }}
            >
              Checking your verification link...
            </Paragraph>
          </div>
        )}

        {status === STATUS.VALID && (
          <Result
            icon={<MailOutlined />}
            title="Verify your email address"
            subTitle={
              <>
                <Paragraph>
                  This verification link is valid. Select the button below to
                  verify your email address.
                </Paragraph>

                {formattedExpiration && (
                  <Text type="secondary">
                    This link expires on {formattedExpiration}.
                  </Text>
                )}
              </>
            }
            extra={
              <Button type="primary" onClick={handleVerify}>
                Verify Email Address
              </Button>
            }
          />
        )}

        {status === STATUS.VERIFYING && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
            }}
          >
            <Spin size="large" />

            <Paragraph
              style={{
                marginTop: 20,
                marginBottom: 0,
              }}
            >
              Verifying your email address...
            </Paragraph>
          </div>
        )}

        {status === STATUS.VERIFIED && (
          <Result
            status="success"
            icon={<CheckCircleOutlined />}
            title="Email address verified"
            subTitle="Your LabFlow email address has been verified successfully."
            extra={
              <Link to="/dashboard">
                <Button type="primary">Continue to LabFlow</Button>
              </Link>
            }
          />
        )}

        {status === STATUS.ALREADY_VERIFIED && (
          <Result
            status="success"
            title="Email already verified"
            subTitle="This email address has already been verified."
            extra={
              <Link to="/dashboard">
                <Button type="primary">Continue to LabFlow</Button>
              </Link>
            }
          />
        )}

        {status === STATUS.INVALID && (
          <Result
            status="warning"
            title="Verification link unavailable"
            subTitle="This verification link is invalid, expired, or has already been used."
            extra={
              isAuthenticated ? (
                <Link to="/dashboard">
                  <Button type="primary">Return to LabFlow</Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button type="primary">Go to Login</Button>
                </Link>
              )
            }
          />
        )}

        {status === STATUS.ERROR && (
          <>
            <Alert
              type="error"
              showIcon
              message="Verification could not be completed"
              description={errorMessage}
              style={{
                marginBottom: 16,
              }}
            />

            <Button onClick={validateToken} block>
              Try Again
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default VerifyEmailPage;
