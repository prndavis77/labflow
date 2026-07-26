import {
  completeAttachmentUpload,
  initiateAttachmentUpload,
} from "../api/attachmentApi";

const ensureSuccessfulStorageResponse = async (response) => {
  if (response.ok) {
    return;
  }

  let responseText;

  try {
    responseText = await response.text();
  } catch {
    responseText = "";
  }

  const error = new Error(
    responseText || `Storage upload failed with status ${response.status}.`,
  );

  error.status = response.status;

  throw error;
};
export const uploadFileToSignedUrl = async ({
  uploadUrl,
  method = "PUT",
  headers = {},
  file,
  signal,
}) => {
  if (!uploadUrl) {
    throw new Error("Signed upload URL is required.");
  }

  if (!(file instanceof File)) {
    throw new Error("A valid file is required.");
  }

  const response = await fetch(uploadUrl, {
    method,
    headers,
    body: file,
    signal,
  });

  await ensureSuccessfulStorageResponse(response);
};

const getUploadInstructions = (initiationResponse) => {
  const data = initiationResponse?.data;

  const attachment = data?.attachment;

  const upload = data?.upload;

  if (!attachment?.id) {
    throw new Error(
      "Upload initiation response did not include an attachment ID.",
    );
  }

  if (!upload?.url) {
    throw new Error(
      "Upload initiation response did not include a signed upload URL.",
    );
  }

  return {
    attachment,
    upload,
  };
};

export const uploadAttachment = async ({
  entityType,
  entityId,
  file,
  category,
  description,
  signal,
  onStepChange,
}) => {
  onStepChange?.("initiating");

  const initiationResponse = await initiateAttachmentUpload({
    entityType,
    entityId,
    file,
    category,
    description,
    signal,
  });

  const { attachment, upload } = getUploadInstructions(initiationResponse);

  onStepChange?.("uploading");

  await uploadFileToSignedUrl({
    uploadUrl: upload.url,
    method: upload.method || "PUT",
    headers: upload.headers || {},
    file,
    signal,
  });

  onStepChange?.("completing");

  const completionResponse = await completeAttachmentUpload(attachment.id, {
    signal,
  });

  return {
    initiationResponse,
    completionResponse,
    attachment: completionResponse?.data?.attachment || attachment,
  };
};
