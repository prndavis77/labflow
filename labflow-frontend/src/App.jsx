import {
  Alert,
  Button,
  Layout,
  Menu,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";

import {
  AuditOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InboxOutlined,
  LogoutOutlined,
  MailOutlined,
  ProjectOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import { useEffect, useState } from "react";

import { useNavigate, useLocation } from "react-router";

import AppRoutes from "./routes/AppRoutes";

import { useAuth } from "./context/useAuth";

import { requestEmailVerification } from "./api/authApi";

import ScrollToTop from "./components/ScrollToTop";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthLoading, refreshCurrentUser } = useAuth();

  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // Auth pages should not show the main app sidebar.
  const isAuthPage =
    ["/login", "/register", "/forgot-password"].includes(location.pathname) ||
    location.pathname.startsWith("/reset-password/") ||
    location.pathname.startsWith("/verify-email/") ||
    location.pathname.startsWith("/accept-invite/");

  useEffect(() => {
    const emailVerification = location.state?.registrationEmailVerification;

    if (!emailVerification) {
      return;
    }

    if (emailVerification.sent) {
      message.success(
        "Your workspace was created. Check your email for the verification link.",
      );
    } else if (emailVerification.deliverySkipped) {
      message.info(
        "Your workspace was created. Email delivery is disabled in this environment.",
      );
    } else {
      message.warning(
        "Your workspace was created, but the verification email could not be sent. Use the resend button below.",
      );
    }

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.state, navigate]);

  const handleResendVerification = async () => {
    try {
      setIsResendingVerification(true);

      const result = await requestEmailVerification();

      if (result.data?.alreadyVerified) {
        await refreshCurrentUser();

        message.success("Your email address is already verified.");

        return;
      }

      if (result.data?.deliverySkipped) {
        message.info(
          "A verification link was created, but email delivery is disabled in this environment.",
        );

        return;
      }

      message.success("A new verification email has been sent.");
    } catch (error) {
      message.error(
        error.response?.data?.message ||
          "The verification email could not be sent. Please try again.",
      );
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (isAuthPage) {
    return (
      <>
        <ScrollToTop />
        <AppRoutes />
      </>
    );
  }

  if (isAuthLoading) {
    return <Spin fullscreen />;
  }

  if (!user) {
    return (
      <>
        <ScrollToTop />
        <AppRoutes />
      </>
    );
  }

  const menuItems = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },

    ...(user.role === "admin"
      ? [
          {
            key: "/admin/users",
            icon: <TeamOutlined />,
            label: "Users",
          },
          {
            key: "/organization",
            icon: <SettingOutlined />,
            label: "Organization",
          },
          {
            key: "/admin/archived-items",
            icon: <InboxOutlined />,
            label: "Archived Items",
          },
          {
            key: "/admin/audit-logs",
            icon: <HistoryOutlined />,
            label: "Audit Logs",
          },
        ]
      : []),

    ...(user.role === "admin" || user.role === "supervisor"
      ? [
          {
            key: "/review",
            icon: <AuditOutlined />,
            label: "Review Queue",
          },
        ]
      : []),

    {
      key: "/projects",
      icon: <ProjectOutlined />,
      label: "Projects",
    },
    {
      key: "/experiments",
      icon: <ExperimentOutlined />,
      label: "Experiments",
    },
    {
      key: "/tasks",
      icon: <CheckSquareOutlined />,
      label: "Tasks",
    },
    {
      key: "/equipment",
      icon: <CalendarOutlined />,
      label: "Instruments",
    },
    {
      key: "/protocols",
      icon: <FileTextOutlined />,
      label: "Protocols",
    },
  ];

  // Finds the best sidebar key based on the current route
  const selectedMenuKey =
    [...menuItems]
      .sort((firstItem, secondItem) => {
        return secondItem.key.length - firstItem.key.length;
      })
      .find((item) => location.pathname.startsWith(item.key))?.key ||
    "/dashboard";

  return (
    <>
      <ScrollToTop />
      <Layout style={{ minHeight: "100vh" }}>
        <Sider
          width={240}
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "16px", color: "white" }}>
            <Title level={4} style={{ color: "white", margin: 0 }}>
              LabFlow
            </Title>
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedMenuKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>

        <Layout>
          <Header
            style={{
              background: "#fff",
              padding: "0 24px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>
              University Laboratory Project Management
            </Title>

            <Space>
              {user.organization?.name && (
                <Text type="secondary">Lab: {user.organization.name}</Text>
              )}

              {user.emailVerifiedAt ? (
                <Tag color="green">Email Verified</Tag>
              ) : (
                <Tag color="orange">Email Unverified</Tag>
              )}

              {user.role && <Tag color="blue">{user.role}</Tag>}
              {user.name && <Text>{user.name}</Text>}

              <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                Logout
              </Button>
            </Space>
          </Header>

          <Content style={{ margin: "24px" }}>
            {!user.emailVerifiedAt && (
              <Alert
                type="warning"
                showIcon
                icon={<MailOutlined />}
                message="Verify your email address"
                description={
                  <>
                    Your account is active, but your email address has not been
                    verified. Check your inbox or request a new verification
                    email.
                  </>
                }
                action={
                  <Button
                    size="small"
                    onClick={handleResendVerification}
                    loading={isResendingVerification}
                  >
                    Resend Verification Email
                  </Button>
                }
                style={{
                  marginBottom: 24,
                }}
              />
            )}

            <AppRoutes />
          </Content>
        </Layout>
      </Layout>
    </>
  );
};

export default App;
