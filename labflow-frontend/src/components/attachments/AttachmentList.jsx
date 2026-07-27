import { Alert, Card, Empty, Space } from "antd";

import AttachmentListItem from "./AttachmentListItem";

const AttachmentList = ({
  attachments,
  isLoading,
  errorMessage,
  getCanManageAttachment,
  downloadingAttachmentId,
  archivingAttachmentId,
  onDownload,
  onEdit,
  onArchive,
}) => {
  if (errorMessage) {
    return <Alert type="error" showIcon message={errorMessage} />;
  }

  if (isLoading) {
    return <Card loading />;
  }

  if (attachments.length === 0) {
    return <Empty description="No attachments have been added yet." />;
  }

  return (
    <Space
      orientation="vertical"
      size="middle"
      style={{
        width: "100%",
      }}
    >
      {attachments.map((attachment) => (
        <AttachmentListItem
          key={attachment.id}
          attachment={attachment}
          canManage={getCanManageAttachment(attachment)}
          isDownloading={downloadingAttachmentId === attachment.id}
          isArchiving={archivingAttachmentId === attachment.id}
          onDownload={onDownload}
          onEdit={onEdit}
          onArchive={onArchive}
        />
      ))}
    </Space>
  );
};

export default AttachmentList;
