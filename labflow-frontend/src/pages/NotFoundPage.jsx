import { Button, Card, Result } from "antd";
import { useNavigate } from "react-router";

// Displays a friendly 404 page for unknown frontend routes
const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <Result
        status="404"
        title="Page Not Found"
        subTitle="The page you are looking for does not exist."
        extra={
          <Button type="primary" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        }
      />
    </Card>
  );
};

export default NotFoundPage;
