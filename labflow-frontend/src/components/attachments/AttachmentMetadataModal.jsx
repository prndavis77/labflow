import { Alert, Button, Form, Input, Modal, Select, Space } from "antd";
import { useCallback, useEffect, useState } from "react";

import { updateAttachmentMetadata } from "../../api/attachmentApi";
import { ATTACHMENT_CATEGORY_OPTIONS } from "../../constants/attachmentOptions";
import { getAttachmentErrorMessage } from "../../utils/attachmentUtils";

const { TextArea } = Input;

const AttachmentMetadataModal = ({ open, attachment, onCancel, onUpdated }) => {
  const [form] = Form.useForm();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open || !attachment) {
      return;
    }

    queueMicrotask(() => {
      setErrorMessage("");

      form.setFieldsValue({
        category: attachment.category,
        description: attachment.description || "",
      });
    });
  }, [attachment, form, open]);

  const handleCancel = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    form.resetFields();
    onCancel?.();
  }, [form, isSubmitting, onCancel]);

  const handleSubmit = useCallback(
    async (values) => {
      if (!attachment?.id) {
        setErrorMessage("The selected attachment is unavailable.");
        return;
      }

      try {
        setIsSubmitting(true);
        setErrorMessage("");

        const result = await updateAttachmentMetadata(attachment.id, {
          category: values.category,
          description: values.description,
        });

        await onUpdated?.(result.data?.attachment, result);

        form.resetFields();
        onCancel?.();
      } catch (error) {
        setErrorMessage(
          getAttachmentErrorMessage(error, "Failed to update the attachment."),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [attachment, form, onCancel, onUpdated],
  );

  return (
    <Modal
      title="Edit Attachment Details"
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnHidden
      closable={!isSubmitting}
      maskClosable={!isSubmitting}
      keyboard={!isSubmitting}
    >
      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
            showSearch
            optionFilterProp="label"
            disabled={isSubmitting}
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
            rows={5}
            maxLength={2000}
            showCount
            disabled={isSubmitting}
            placeholder="Optional context about this file."
          />
        </Form.Item>

        <Space
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button type="primary" htmlType="submit" loading={isSubmitting}>
            Save Changes
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};

export default AttachmentMetadataModal;
