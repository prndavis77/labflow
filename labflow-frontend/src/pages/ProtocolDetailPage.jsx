import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchProtocolById, updateProtocol } from "../api/protocolApi";
import { fetchReviewEvents } from "../api/reviewEventApi";
import { formatDate, formatDateTime, formatLabel } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";
import {
  APPROVAL_STATUS_COLORS,
  REVIEW_EVENT_ACTION_COLORS,
} from "../constants/statusColors";

const { Title, Paragraph, Text } = Typography;

const ProtocolDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();

  const [protocol, setProtocol] = useState(null);
  const [reviewEvents, setReviewEvents] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingReviewEvents, setIsLoadingReviewEvents] = useState(false);

  const [isUpdatingApprovalStatus, setIsUpdatingApprovalStatus] =
    useState(false);
  const [isReviewCommentModalOpen, setIsReviewCommentModalOpen] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [reviewHistoryErrorMessage, setReviewHistoryErrorMessage] =
    useState("");

  const [reviewCommentForm] = Form.useForm();

  // Only admins and supervisors can perform protocol approval decisions
  const canReviewProtocol = ["admin", "supervisor"].includes(user?.role);

  // Approval actions should only appear for protocols in review workflow
  const shouldShowProtocolReviewActions =
    canReviewProtocol &&
    protocol &&
    ["pending_review", "changes_requested"].includes(protocol.approvalStatus);

  const openProtocolReviewCommentModal = () => {
    reviewCommentForm.resetFields();

    reviewCommentForm.setFieldsValue({
      reviewComment: protocol?.reviewComment || "",
    });

    setIsReviewCommentModalOpen(true);
  };

  const closeProtocolReviewCommentModal = useCallback(() => {
    setIsReviewCommentModalOpen(false);
    reviewCommentForm.resetFields();
  }, [reviewCommentForm]);

  // Loads one protocol by route ID
  const loadProtocolDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const result = await fetchProtocolById(id);

      setProtocol(result.data.protocol);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to load protocol details.";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Loads review history for the current protocol
  const loadReviewEvents = useCallback(async () => {
    try {
      setIsLoadingReviewEvents(true);
      setReviewHistoryErrorMessage("");

      const result = await fetchReviewEvents({
        targetType: "protocol",
        targetId: id,
      });

      setReviewEvents(result.data.reviewEvents);
    } catch (error) {
      const messageText =
        error.response?.data?.message || "Failed to load review history.";

      setReviewHistoryErrorMessage(messageText);
    } finally {
      setIsLoadingReviewEvents(false);
    }
  }, [id]);

  // Load protocol details after the first render or when the route ID changes
  useEffect(() => {
    queueMicrotask(() => {
      loadProtocolDetail();
      loadReviewEvents();
    });
  }, [loadProtocolDetail, loadReviewEvents]);

  // Updates protocol approval status from the detail page
  // The backend handles approvedById and approvedAt when approvalStatus becomes approved
  const handleProtocolReviewAction = useCallback(
    async (nextApprovalStatus, reviewComment) => {
      if (!protocol) {
        return;
      }

      try {
        setIsUpdatingApprovalStatus(true);

        const payload = {
          approvalStatus: nextApprovalStatus,
        };

        if (reviewComment !== undefined) {
          payload.reviewComment = reviewComment;
        }

        await updateProtocol(protocol.id, payload);

        message.success(
          nextApprovalStatus === "approved"
            ? "Protocol approved."
            : "Changes requested for protocol.",
        );

        closeProtocolReviewCommentModal();
        await loadProtocolDetail();
        await loadReviewEvents();
      } catch (error) {
        const message =
          error.response?.data?.message ||
          "Failed to update protocol approval status.";

        message.error(message);
      } finally {
        setIsUpdatingApprovalStatus(false);
      }
    },
    [
      protocol,
      loadProtocolDetail,
      closeProtocolReviewCommentModal,
      loadReviewEvents,
    ],
  );

  const handleProtocolChangeRequestSubmit = async (values) => {
    await handleProtocolReviewAction("changes_requested", values.reviewComment);
  };

  // Converts review history events into timeline items
  const reviewHistoryTimelineItems = useMemo(() => {
    return reviewEvents.map((event) => ({
      key: event.id,
      children: (
        <Card size="small">
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color={REVIEW_EVENT_ACTION_COLORS[event.action]}>
              {formatLabel(event.action)}
            </Tag>

            <Text type="secondary">
              Reviewer: {event.reviewer?.name || "Unknown"}
            </Text>

            <Text type="secondary">{formatDateTime(event.createdAt)}</Text>
          </Space>

          <Paragraph style={{ whiteSpace: "pre-line", marginBottom: 0 }}>
            {event.comment || "No review comment recorded."}
          </Paragraph>
        </Card>
      ),
    }));
  }, [reviewEvents]);

  if (errorMessage) {
    return (
      <Card>
        <Alert type="error" message={errorMessage} showIcon />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/protocols")}
          style={{ marginTop: 16 }}
        >
          Back to Protocols
        </Button>
      </Card>
    );
  }

  return (
    <Card loading={isLoading && !protocol}>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/protocols")}
        >
          Back to Protocols
        </Button>

        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            loadProtocolDetail();
            loadReviewEvents();
          }}
          loading={isLoading}
        >
          Refresh
        </Button>
      </Space>

      {protocol && (
        <>
          <Title level={2} style={{ marginBottom: 4 }}>
            {protocol.title}
          </Title>

          <Paragraph>{protocol.purpose || "No purpose provided."}</Paragraph>

          <Descriptions bordered column={2}>
            <Descriptions.Item label="Version">
              v{protocol.version}
            </Descriptions.Item>

            <Descriptions.Item label="Approval Status">
              <Tag color={APPROVAL_STATUS_COLORS[protocol.approvalStatus]}>
                {formatLabel(protocol.approvalStatus)}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Latest Review Feedback" span={2}>
              {protocol.reviewComment || "No current review feedback."}
            </Descriptions.Item>

            <Descriptions.Item label="Project">
              {protocol.project ? (
                <Link to={`/projects/${protocol.project.id}`}>
                  {protocol.project.title}
                </Link>
              ) : (
                "General / Not linked"
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Equipment">
              {protocol.equipment ? (
                <Link to={`/equipment/${protocol.equipment.id}`}>
                  {protocol.equipment.name} ({protocol.equipment.type})
                </Link>
              ) : (
                "Not linked"
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Created By">
              {protocol.createdBy?.name || "Unknown"}
            </Descriptions.Item>

            <Descriptions.Item label="Approved By">
              {protocol.approvedBy?.name || "Not approved"}
            </Descriptions.Item>

            <Descriptions.Item label="Approved At">
              {formatDate(protocol.approvedAt)}
            </Descriptions.Item>

            <Descriptions.Item label="Created At">
              {formatDateTime(protocol.createdAt)}
            </Descriptions.Item>

            <Descriptions.Item label="Updated At">
              {formatDateTime(protocol.updatedAt)}
            </Descriptions.Item>
          </Descriptions>

          <Card
            title={`Review History (${reviewEvents.length})`}
            style={{ marginTop: 24 }}
          >
            {reviewHistoryErrorMessage && (
              <Alert
                type="error"
                message={reviewHistoryErrorMessage}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {isLoadingReviewEvents ? (
              <Card loading />
            ) : reviewEvents.length === 0 ? (
              <Empty description="No review history recorded for this protocol yet." />
            ) : (
              <Timeline items={reviewHistoryTimelineItems} />
            )}
          </Card>

          {shouldShowProtocolReviewActions && (
            <Card title="Review Actions" style={{ marginTop: 24 }}>
              <Space wrap>
                {protocol.approvalStatus !== "approved" && (
                  <Popconfirm
                    title="Approve protocol?"
                    description="This will approve the protocol and record approval metadata."
                    okText="Approve"
                    cancelText="Cancel"
                    onConfirm={() => handleProtocolReviewAction("approved")}
                  >
                    <Button type="primary" loading={isUpdatingApprovalStatus}>
                      Approve Protocol
                    </Button>
                  </Popconfirm>
                )}

                <Button danger onClick={openProtocolReviewCommentModal}>
                  {protocol.approvalStatus === "changes_requested"
                    ? "Request More Changes"
                    : "Request Changes"}
                </Button>
              </Space>
            </Card>
          )}

          <Modal
            title={
              protocol?.approvalStatus === "changes_requested"
                ? "Request More Changes"
                : "Request Changes"
            }
            open={isReviewCommentModalOpen}
            onCancel={closeProtocolReviewCommentModal}
            footer={null}
            destroyOnHidden
          >
            <Form
              layout="vertical"
              form={reviewCommentForm}
              onFinish={handleProtocolChangeRequestSubmit}
            >
              <Form.Item
                label="Change Request Note"
                name="reviewComment"
                rules={[
                  {
                    required: true,
                    message: "Please explain what changes are needed.",
                  },
                  {
                    min: 10,
                    message: "Please provide a more specific change request.",
                  },
                ]}
              >
                <Input.TextArea
                  rows={5}
                  placeholder="Explain what needs to be corrected, clarified, expanded, or revised."
                />
              </Form.Item>

              <Space style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={closeProtocolReviewCommentModal}>
                  Cancel
                </Button>

                <Button
                  type="primary"
                  danger
                  htmlType="submit"
                  loading={isUpdatingApprovalStatus}
                >
                  Save Change Request
                </Button>
              </Space>
            </Form>
          </Modal>

          <Card title="Protocol Content" style={{ marginTop: 24 }}>
            <Text>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  fontFamily: "inherit",
                }}
              >
                {protocol.content}
              </pre>
            </Text>
          </Card>
        </>
      )}
    </Card>
  );
};

export default ProtocolDetailPage;
