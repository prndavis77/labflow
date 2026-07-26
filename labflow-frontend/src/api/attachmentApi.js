import axiosClient from "./axiosClient";

const ATTACHMENT_BASE_PATH = "/attachments";

const requireAttachmentId = (attachmentId) => {
  if (
    attachmentId === undefined ||
    attachmentId === null ||
    attachmentId === ""
  ) {
    throw new Error("Attachment ID is required.");
  }

  return attachmentId;
};

const requireTarget = ({ entityType, entityId }) => {
  if (!entityType) {
    throw new Error("Attachment entity type is required.");
  }

  if (entityId === undefined || entityId === null || entityId === "") {
    throw new Error("Attachment entity ID is required.");
  }
};

export const initiateAttachmentUpload = async ({
  entityType,
  entityId,
  file,
  category,
  description,
}) => {
  requireTarget({
    entityType,
    entityId,
  });

  if (!(file instanceof File)) {
    throw new Error("A valid file is required.");
  }

  const payload = {
    entityType,
    entityId,
    originalFileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    category,
    description: description?.trim() || null,
  };

  const response = await axiosClient.post(
    `${ATTACHMENT_BASE_PATH}/uploads`,
    payload,
  );

  return response.data;
};

export const completeAttachmentUpload = async (attachmentId) => {
  const normalizedAttachmentId = requireAttachmentId(attachmentId);

  const response = await axiosClient.post(
    `${ATTACHMENT_BASE_PATH}/${normalizedAttachmentId}/complete`,
  );

  return response.data;
};

export const fetchAttachments = async ({
  entityType,
  entityId,
  category,
  uploadStatus,
} = {}) => {
  const params = {};

  if (entityType) {
    params.entityType = entityType;
  }

  if (entityId !== undefined && entityId !== null && entityId !== "") {
    params.entityId = entityId;
  }

  if (category) {
    params.category = category;
  }

  if (uploadStatus) {
    params.uploadStatus = uploadStatus;
  }

  const response = await axiosClient.get(ATTACHMENT_BASE_PATH, {
    params,
  });

  return response.data;
};

export const fetchAttachmentsForTarget = async ({ entityType, entityId }) => {
  requireTarget({
    entityType,
    entityId,
  });

  return fetchAttachments({
    entityType,
    entityId,
  });
};

export const fetchAttachment = async (attachmentId) => {
  const normalizedAttachmentId = requireAttachmentId(attachmentId);

  const response = await axiosClient.get(
    `${ATTACHMENT_BASE_PATH}/${normalizedAttachmentId}`,
  );

  return response.data;
};

export const fetchAttachmentDownload = async (attachmentId) => {
  const normalizedAttachmentId = requireAttachmentId(attachmentId);

  const response = await axiosClient.get(
    `${ATTACHMENT_BASE_PATH}/${normalizedAttachmentId}/download`,
  );

  return response.data;
};

export const updateAttachmentMetadata = async (
  attachmentId,
  { category, description },
) => {
  const normalizedAttachmentId = requireAttachmentId(attachmentId);

  const payload = {};

  if (category !== undefined) {
    payload.category = category;
  }

  if (description !== undefined) {
    payload.description = description?.trim() || null;
  }

  const response = await axiosClient.patch(
    `${ATTACHMENT_BASE_PATH}/${normalizedAttachmentId}`,
    payload,
  );

  return response.data;
};

export const archiveAttachment = async (attachmentId) => {
  const normalizedAttachmentId = requireAttachmentId(attachmentId);

  const response = await axiosClient.post(
    `${ATTACHMENT_BASE_PATH}/${normalizedAttachmentId}/archive`,
  );

  return response.data;
};
