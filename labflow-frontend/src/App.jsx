import { Layout, Menu, Typography, Button, Space, Spin, Tag } from "antd";
import {
  AuditOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LogoutOutlined,
  ProjectOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router";

import AppRoutes from "./routes/AppRoutes";
import { useAuth } from "./context/useAuth";
import ScrollToTop from "./components/ScrollToTop";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthLoading } = useAuth();

  // Auth pages should not show the main app sidebar.
  const isAuthPage = ["/login", "/register"].includes(location.pathname);

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
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
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

              {user.role && <Tag color="blue">{user.role}</Tag>}
              {user.name && <Text>{user.name}</Text>}

              <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                Logout
              </Button>
            </Space>
          </Header>

          <Content style={{ margin: "24px" }}>
            <AppRoutes />
          </Content>
        </Layout>
      </Layout>
    </>
  );
};

export default App;
