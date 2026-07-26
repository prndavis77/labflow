import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from "antd";
import {
  DeleteOutlined,
  InboxOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ATTACHMENT_CATEGORY_OPTIONS,
  ATTACHMENT_MAX_FILE_COUNT,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  DEFAULT_ATTACHMENT_CATEGORY,
} from "../../constants/attachmentOptions";
import { uploadAttachment } from "../../services/attachmentUploadService";
import {
  formatFileSize,
  getAttachmentErrorMessage,
} from "../../utils/attachmentUtils";

const { Dragger } = Upload;
const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const UPLOAD_STEPS = {
  IDLE: "idle",
  INITIATING: "initiating",
  UPLOADING: "uploading",
  COMPLETING: "completing",
  SUCCESS: "success",
  ERROR: "error",
};

const UPLOAD_STEP_PROGRESS = {
  [UPLOAD_STEPS.IDLE]: 0,
  [UPLOAD_STEPS.INITIATING]: 15,
  [UPLOAD_STEPS.UPLOADING]: 55,
  [UPLOAD_STEPS.COMPLETING]: 85,
  [UPLOAD_STEPS.SUCCESS]: 100,
  [UPLOAD_STEPS.ERROR]: 0,
};

const UPLOAD_STEP_LABELS = {
  [UPLOAD_STEPS.IDLE]: "",
  [UPLOAD_STEPS.INITIATING]: "Preparing secure upload...",
  [UPLOAD_STEPS.UPLOADING]: "Uploading file to private storage...",
  [UPLOAD_STEPS.COMPLETING]: "Verifying uploaded file...",
  [UPLOAD_STEPS.SUCCESS]: "Upload completed.",
  [UPLOAD_STEPS.ERROR]: "Upload failed.",
};

const getSelectedFile = (uploadFile) => uploadFile?.originFileObj || uploadFile;

const AttachmentUploadModal = ({
  open,
  entityType,
  entityId,
  onCancel,
  onUploaded,
}) => {
  const [form] = Form.useForm();

  const [fileList, setFileList] = useState([]);

  const [uploadStep, setUploadStep] = useState(UPLOAD_STEPS.IDLE);

  const [errorMessage, setErrorMessage] = useState("");

  const abortControllerRef = useRef(null);

  const isUploading = [
    UPLOAD_STEPS.INITIATING,
    UPLOAD_STEPS.UPLOADING,
    UPLOAD_STEPS.COMPLETING,
  ].includes(uploadStep);

  const uploadProgress = UPLOAD_STEP_PROGRESS[uploadStep];

  const uploadStatusText = UPLOAD_STEP_LABELS[uploadStep];

  const selectedFile = useMemo(() => {
    if (fileList.length === 0) {
      return null;
    }

    return getSelectedFile(fileList[0]);
  }, [fileList]);

  const resetModal = useCallback(() => {
    form.resetFields();

    form.setFieldsValue({
      category: DEFAULT_ATTACHMENT_CATEGORY,
      description: "",
    });

    setFileList([]);
    setUploadStep(UPLOAD_STEPS.IDLE);
    setErrorMessage("");

    abortControllerRef.current = null;
  }, [form]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        resetModal();
      });
    }
  }, [open, resetModal]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const validateFile = useCallback((file) => {
    if (!file) {
      return {
        valid: false,
        message: "Please select a file.",
      };
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      return {
        valid: false,
        message: "The selected file is empty or invalid.",
      };
    }

    if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        message: `The file is larger than ${formatFileSize(
          ATTACHMENT_MAX_FILE_SIZE_BYTES,
        )}.`,
      };
    }

    return {
      valid: true,
      message: "",
    };
  }, []);

  const handleBeforeUpload = useCallback(
    (file) => {
      const validation = validateFile(file);

      if (!validation.valid) {
        message.error(validation.message);

        return Upload.LIST_IGNORE;
      }

      setFileList([
        {
          uid: file.uid,
          name: file.name,
          status: "done",
          size: file.size,
          type: file.type,
          originFileObj: file,
        },
      ]);

      setErrorMessage("");
      setUploadStep(UPLOAD_STEPS.IDLE);

      return false;
    },
    [validateFile],
  );

  const handleFileRemove = useCallback(() => {
    if (isUploading) {
      return false;
    }

    setFileList([]);
    setErrorMessage("");
    setUploadStep(UPLOAD_STEPS.IDLE);

    return true;
  }, [isUploading]);

  const handleUploadChange = useCallback(
    ({ fileList: nextFileList }) => {
      if (isUploading) {
        return;
      }

      setFileList(nextFileList.slice(-ATTACHMENT_MAX_FILE_COUNT));
    },
    [isUploading],
  );

  const handleCancel = useCallback(() => {
    if (isUploading) {
      abortControllerRef.current?.abort();

      setErrorMessage("The upload was cancelled.");

      setUploadStep(UPLOAD_STEPS.ERROR);

      return;
    }

    resetModal();
    onCancel?.();
  }, [isUploading, onCancel, resetModal]);

  const handleSubmit = useCallback(
    async (values) => {
      const fileValidation = validateFile(selectedFile);

      if (!fileValidation.valid) {
        setErrorMessage(fileValidation.message);

        return;
      }

      if (
        !entityType ||
        entityId === undefined ||
        entityId === null ||
        entityId === ""
      ) {
        setErrorMessage("The attachment target is unavailable.");

        return;
      }

      const abortController = new AbortController();

      abortControllerRef.current = abortController;

      try {
        setErrorMessage("");

        setUploadStep(UPLOAD_STEPS.INITIATING);

        const uploadPromise = uploadAttachment({
          entityType,
          entityId,
          file: selectedFile,
          category: values.category,
          description: values.description,
          signal: abortController.signal,
          onStepChange: setUploadStep,
        });

        const result = await uploadPromise;

        setUploadStep(UPLOAD_STEPS.SUCCESS);

        message.success("Attachment uploaded successfully.");

        await onUploaded?.(result.attachment, result);

        resetModal();
        onCancel?.();
      } catch (error) {
        if (
          error?.name === "AbortError" ||
          error?.name === "CanceledError" ||
          error?.code === "ERR_CANCELED" ||
          abortController.signal.aborted
        ) {
          setErrorMessage("The upload was cancelled.");
        } else {
          setErrorMessage(
            getAttachmentErrorMessage(
              error,
              "Failed to upload the attachment.",
            ),
          );
        }

        setUploadStep(UPLOAD_STEPS.ERROR);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      entityId,
      entityType,
      onCancel,
      onUploaded,
      resetModal,
      selectedFile,
      validateFile,
    ],
  );

  const modalFooter = (
    <Space>
      <Button onClick={handleCancel} danger={isUploading}>
        {isUploading ? "Cancel Upload" : "Cancel"}
      </Button>

      <Button
        type="primary"
        icon={<UploadOutlined />}
        loading={isUploading}
        disabled={!selectedFile}
        onClick={() => form.submit()}
      >
        Upload Attachment
      </Button>
    </Space>
  );

  return (
    <Modal
      title="Upload Attachment"
      open={open}
      onCancel={handleCancel}
      footer={modalFooter}
      width={680}
      closable={!isUploading}
      maskClosable={!isUploading}
      keyboard={!isUploading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          category: DEFAULT_ATTACHMENT_CATEGORY,
          description: "",
        }}
        onFinish={handleSubmit}
      >
        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message={errorMessage}
            style={{
              marginBottom: 16,
            }}
          />
        )}

        <Form.Item label="File" required>
          <Dragger
            accept=""
            multiple={false}
            maxCount={ATTACHMENT_MAX_FILE_COUNT}
            fileList={fileList}
            beforeUpload={handleBeforeUpload}
            onChange={handleUploadChange}
            onRemove={handleFileRemove}
            disabled={isUploading}
            showUploadList={{
              showPreviewIcon: false,
              showRemoveIcon: !isUploading,
              removeIcon: <DeleteOutlined />,
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>

            <p className="ant-upload-text">Select or drag a file here</p>

            <p className="ant-upload-hint">
              One file per upload. Maximum size:{" "}
              {formatFileSize(ATTACHMENT_MAX_FILE_SIZE_BYTES)}.
            </p>
          </Dragger>
        </Form.Item>

        {selectedFile && (
          <Alert
            type="info"
            showIcon
            style={{
              marginBottom: 16,
            }}
            message={selectedFile.name}
            description={
              <Space orientation="vertical" size={0}>
                <Text>Size: {formatFileSize(selectedFile.size)}</Text>

                <Text>Type: {selectedFile.type || "Unknown"}</Text>
              </Space>
            }
          />
        )}

        <Form.Item
          label="Category"
          name="category"
          rules={[
            {
              required: true,
              message: "Please select an attachment category.",
            },
          ]}
        >
          <Select
            options={ATTACHMENT_CATEGORY_OPTIONS}
            disabled={isUploading}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
          rules={[
            {
              max: 2000,
              message: "Description cannot exceed 2000 characters.",
            },
          ]}
        >
          <TextArea
            rows={4}
            maxLength={2000}
            showCount
            disabled={isUploading}
            placeholder="Optional context about this file."
          />
        </Form.Item>

        {uploadStatusText && (
          <div
            style={{
              marginTop: 8,
            }}
          >
            <Progress
              percent={uploadProgress}
              status={
                uploadStep === UPLOAD_STEPS.ERROR
                  ? "exception"
                  : uploadStep === UPLOAD_STEPS.SUCCESS
                    ? "success"
                    : "active"
              }
            />

            <Paragraph
              type="secondary"
              style={{
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              {uploadStatusText}
            </Paragraph>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default AttachmentUploadModal;
