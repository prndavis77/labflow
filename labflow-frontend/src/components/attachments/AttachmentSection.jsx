import { Alert, Button, Card, Select, Space, Typography, message } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  archiveAttachment,
  fetchAttachmentDownload,
  fetchAttachments,
} from "../../api/attachmentApi";
import {
  ATTACHMENT_CATEGORY_OPTIONS,
  ATTACHMENT_UPLOAD_STATUSES,
} from "../../constants/attachmentOptions";
import { getAttachmentErrorMessage } from "../../utils/attachmentUtils";

import AttachmentList from "./AttachmentList";
import AttachmentMetadataModal from "./AttachmentMetadataModal";
import AttachmentUploadModal from "./AttachmentUploadModal";

const { Text } = Typography;

const AttachmentSection = ({
  entityType,
  entityId,
  currentUser,
  title = "Attachments",
  canUpload = true,
  canManage = true,
}) => {
  const [attachments, setAttachments] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState(undefined);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [editingAttachment, setEditingAttachment] = useState(null);

  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);

  const [archivingAttachmentId, setArchivingAttachmentId] = useState(null);

  const hasValidTarget =
    Boolean(entityType) &&
    entityId !== undefined &&
    entityId !== null &&
    entityId !== "";

  const loadAttachments = useCallback(async () => {
    if (!hasValidTarget) {
      setAttachments([]);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");

      const result = await fetchAttachments({
        entityType,
        entityId,
        category: selectedCategory,
        uploadStatus: ATTACHMENT_UPLOAD_STATUSES.AVAILABLE,
      });

      setAttachments(result.data?.attachments || []);
    } catch (error) {
      setAttachments([]);

      setErrorMessage(
        getAttachmentErrorMessage(error, "Failed to load attachments."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [entityId, entityType, hasValidTarget, selectedCategory]);

  useEffect(() => {
    queueMicrotask(() => {
      loadAttachments();
    });
  }, [loadAttachments]);

  const getCanManageAttachment = useCallback(
    (attachment) => {
      if (!canManage || !currentUser || !attachment) {
        return false;
      }

      if (["admin", "supervisor"].includes(currentUser.role)) {
        return true;
      }

      const uploadedById = attachment.uploadedById ?? attachment.uploadedBy?.id;

      return Number(uploadedById) === Number(currentUser.id);
    },
    [canManage, currentUser],
  );

  const handleDownload = useCallback(async (attachment) => {
    try {
      setDownloadingAttachmentId(attachment.id);

      const result = await fetchAttachmentDownload(attachment.id);

      const downloadUrl = result.data?.download?.url;

      if (!downloadUrl) {
        throw new Error("The attachment download URL was not returned.");
      }

      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download =
        attachment.originalFileName || attachment.fileName || "attachment";
      link.rel = "noopener noreferrer";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error(
        getAttachmentErrorMessage(error, "Failed to download the attachment."),
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, []);

  const handleArchive = useCallback(
    async (attachment) => {
      try {
        setArchivingAttachmentId(attachment.id);

        await archiveAttachment(attachment.id);

        message.success("Attachment archived successfully.");

        await loadAttachments();
      } catch (error) {
        message.error(
          getAttachmentErrorMessage(error, "Failed to archive the attachment."),
        );
      } finally {
        setArchivingAttachmentId(null);
      }
    },
    [loadAttachments],
  );

  const handleAttachmentUploaded = useCallback(async () => {
    await loadAttachments();
  }, [loadAttachments]);

  const handleAttachmentUpdated = useCallback(async () => {
    message.success("Attachment details updated successfully.");

    setEditingAttachment(null);

    await loadAttachments();
  }, [loadAttachments]);

  const categoryFilterOptions = useMemo(
    () => [
      {
        label: "All Categories",
        value: "",
      },
      ...ATTACHMENT_CATEGORY_OPTIONS,
    ],
    [],
  );

  return (
    <>
      <Card
        title={`${title} (${attachments.length})`}
        extra={
          <Space wrap>
            <Select
              value={selectedCategory || ""}
              options={categoryFilterOptions}
              style={{
                width: 210,
              }}
              onChange={(value) => {
                setSelectedCategory(value || undefined);
              }}
              disabled={!hasValidTarget}
            />

            <Button
              icon={<ReloadOutlined />}
              onClick={loadAttachments}
              loading={isLoading}
              disabled={!hasValidTarget}
            >
              Refresh
            </Button>

            {canUpload && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsUploadModalOpen(true)}
                disabled={!hasValidTarget}
              >
                Upload File
              </Button>
            )}
          </Space>
        }
      >
        {!hasValidTarget && (
          <Alert
            type="warning"
            showIcon
            message="The attachment target is unavailable."
            style={{
              marginBottom: 16,
            }}
          />
        )}

        {!canUpload && (
          <Text
            type="secondary"
            style={{
              display: "block",
              marginBottom: 16,
            }}
          >
            You have read-only access to these attachments.
          </Text>
        )}

        <AttachmentList
          attachments={attachments}
          isLoading={isLoading}
          errorMessage={errorMessage}
          getCanManageAttachment={getCanManageAttachment}
          downloadingAttachmentId={downloadingAttachmentId}
          archivingAttachmentId={archivingAttachmentId}
          onDownload={handleDownload}
          onEdit={setEditingAttachment}
          onArchive={handleArchive}
        />
      </Card>

      <AttachmentUploadModal
        open={isUploadModalOpen}
        entityType={entityType}
        entityId={entityId}
        onCancel={() => setIsUploadModalOpen(false)}
        onUploaded={handleAttachmentUploaded}
      />

      <AttachmentMetadataModal
        open={Boolean(editingAttachment)}
        attachment={editingAttachment}
        onCancel={() => setEditingAttachment(null)}
        onUpdated={handleAttachmentUpdated}
      />
    </>
  );
};

export default AttachmentSection;
