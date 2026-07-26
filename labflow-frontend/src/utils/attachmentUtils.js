import {
  ATTACHMENT_CATEGORY_OPTIONS,
  ATTACHMENT_UPLOAD_STATUS_LABELS,
} from "../constants/attachmentOptions";

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export const formatFileSize = (bytes) => {
  const numericBytes = Number(bytes);

  if (!Number.isFinite(numericBytes) || numericBytes < 0) {
    return "Unknown size";
  }

  if (numericBytes === 0) {
    return "0 B";
  }

  const unitIndex = Math.min(
    Math.floor(Math.log(numericBytes) / Math.log(1024)),
    FILE_SIZE_UNITS.length - 1,
  );

  const value = numericBytes / 1024 ** unitIndex;

  const maximumFractionDigits =
    value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits,
  })} ${FILE_SIZE_UNITS[unitIndex]}`;
};

export const getAttachmentCategoryLabel = (category) => {
  const option = ATTACHMENT_CATEGORY_OPTIONS.find(
    (categoryOption) => categoryOption.value === category,
  );

  return option?.label || category || "Other";
};

export const getAttachmentStatusLabel = (uploadStatus) =>
  ATTACHMENT_UPLOAD_STATUS_LABELS[uploadStatus] || uploadStatus || "Unknown";

export const getAttachmentDisplayName = (attachment) =>
  attachment?.originalFileName || attachment?.fileName || "Unnamed attachment";

export const isAttachmentAvailable = (attachment) =>
  attachment?.uploadStatus === "available" && !attachment?.isArchived;

export const isImageAttachment = (attachment) =>
  typeof attachment?.mimeType === "string" &&
  attachment.mimeType.startsWith("image/");

export const isPdfAttachment = (attachment) =>
  attachment?.mimeType === "application/pdf";

export const getAttachmentFileExtension = (attachment) => {
  const fileName = getAttachmentDisplayName(attachment);

  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDotIndex + 1).toLowerCase();
};

export const getAttachmentErrorMessage = (
  error,
  fallbackMessage = "The attachment request failed.",
) => error?.response?.data?.message || error?.message || fallbackMessage;
