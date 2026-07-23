import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Select,
  Typography,
} from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/useAuth";

const { Title, Paragraph } = Typography;

const ORGANIZATION_TYPE_OPTIONS = [
  {
    label: "Laboratory",
    value: "lab",
  },
  {
    label: "Department",
    value: "department",
  },
  {
    label: "Institution",
    value: "institution",
  },
  {
    label: "Company",
    value: "company",
  },
];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (values) => {
    try {
      setErrorMessage("");
      setIsSubmitting(true);

      await register({
        organizationName: values.organizationName,
        organizationType: values.organizationType,
        name: values.name,
        email: values.email,
        password: values.password,
        department: values.department || null,
      });

      navigate("/dashboard");
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Registration failed. Please try again.";

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
        padding: 24,
      }}
    >
      <Card style={{ width: 460 }}>
        <Title level={2}>Create Your LabFlow Workspace</Title>

        <Paragraph>
          Create a new organization and its first administrator account.
          Additional admins, supervisors, and researchers can be invited after
          setup.
        </Paragraph>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          layout="vertical"
          onFinish={handleRegister}
          initialValues={{
            organizationType: "lab",
          }}
        >
          <Title level={4}>Organization Details</Title>

          <Form.Item
            label="Organization Name"
            name="organizationName"
            rules={[
              {
                required: true,
                message: "Please enter the organization name.",
              },
              {
                min: 2,
                message: "Organization name must be at least 2 characters.",
              },
            ]}
          >
            <Input placeholder="Analytical Chemistry Laboratory" />
          </Form.Item>

          <Form.Item
            label="Organization Type"
            name="organizationType"
            rules={[
              {
                required: true,
                message: "Please select an organization type.",
              },
            ]}
          >
            <Select
              placeholder="Select organization type"
              options={ORGANIZATION_TYPE_OPTIONS}
            />
          </Form.Item>

          <Divider />

          <Title level={4}>Administrator Details</Title>

          <Form.Item
            label="Full Name"
            name="name"
            rules={[
              {
                required: true,
                message: "Please enter your full name.",
              },
              {
                min: 2,
                message: "Name must be at least 2 characters.",
              },
            ]}
          >
            <Input placeholder="John Doe" />
          </Form.Item>

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
            <Input placeholder="john.doe@university.edu" />
          </Form.Item>

          <Form.Item label="Department" name="department">
            <Input placeholder="Analytical Chemistry" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              {
                required: true,
                message: "Please enter a password.",
              },
              {
                min: 8,
                message: "Password must be at least 8 characters.",
              },
            ]}
          >
            <Input.Password placeholder="Create a password" />
          </Form.Item>

          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              {
                required: true,
                message: "Please confirm your password.",
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error("Passwords do not match."));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm your password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={isSubmitting}>
            Create Workspace
          </Button>
        </Form>

        <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </Paragraph>
      </Card>
    </div>
  );
};

export default RegisterPage;
