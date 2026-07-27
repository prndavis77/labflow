import { Button, Card, Popconfirm, Space, Tag, Typography } from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
} from "@ant-design/icons";

import { ATTACHMENT_CATEGORY_OPTIONS } from "../../constants/attachmentOptions";
import { formatFileSize } from "../../utils/attachmentUtils";
import { formatDateTime } from "../../utils/formatters";

const { Paragraph, Text, Title } = Typography;

const getCategoryLabel = (category) => {
  const option = ATTACHMENT_CATEGORY_OPTIONS.find(
    (item) => item.value === category,
  );

  return option?.label || category || "Uncategorized";
};

const getFileTypeLabel = (attachment) => {
  if (attachment?.fileExtension) {
    return attachment.fileExtension.replace(/^\./, "").toUpperCase();
  }

  if (attachment?.mimeType) {
    return attachment.mimeType;
  }

  return "Unknown";
};

const AttachmentListItem = ({
  attachment,
  canManage,
  isDownloading,
  isArchiving,
  onDownload,
  onEdit,
  onArchive,
}) => {
  return (
    <Card
      size="small"
      styles={{
        body: {
          padding: 16,
        },
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            minWidth: 0,
            flex: 1,
          }}
        >
          <FileOutlined
            style={{
              fontSize: 28,
              marginTop: 3,
            }}
          />

          <div
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <Title
              level={5}
              style={{
                marginTop: 0,
                marginBottom: 8,
                overflowWrap: "anywhere",
              }}
            >
              {attachment.originalFileName ||
                attachment.fileName ||
                "Unnamed attachment"}
            </Title>

            <Space wrap size={[8, 8]}>
              <Tag color="blue">{getCategoryLabel(attachment.category)}</Tag>

              <Text type="secondary">Type: {getFileTypeLabel(attachment)}</Text>

              <Text type="secondary">
                Size:{" "}
                {formatFileSize(
                  attachment.verifiedFileSize ?? attachment.fileSize,
                )}
              </Text>
            </Space>

            <Paragraph
              style={{
                marginTop: 10,
                marginBottom: 8,
                whiteSpace: "pre-line",
              }}
            >
              {attachment.description || "No description provided."}
            </Paragraph>

            <Space wrap size={[12, 4]}>
              <Text type="secondary">
                Uploaded by: {attachment.uploadedBy?.name || "Unknown"}
              </Text>

              <Text type="secondary">
                Uploaded: {formatDateTime(attachment.createdAt)}
              </Text>

              {attachment.updatedAt &&
                attachment.updatedAt !== attachment.createdAt && (
                  <Text type="secondary">
                    Updated: {formatDateTime(attachment.updatedAt)}
                  </Text>
                )}
            </Space>
          </div>
        </div>

        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            loading={isDownloading}
            onClick={() => onDownload?.(attachment)}
          >
            Download
          </Button>

          {canManage && (
            <>
              <Button
                icon={<EditOutlined />}
                disabled={isArchiving}
                onClick={() => onEdit?.(attachment)}
              >
                Edit
              </Button>

              <Popconfirm
                title="Archive attachment?"
                description="The file will be removed from the normal attachment list. The stored object will not be permanently deleted."
                okText="Archive"
                cancelText="Cancel"
                okButtonProps={{
                  danger: true,
                }}
                onConfirm={() => onArchive?.(attachment)}
              >
                <Button danger icon={<DeleteOutlined />} loading={isArchiving}>
                  Archive
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </div>
    </Card>
  );
};

export default AttachmentListItem;
