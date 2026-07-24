const formatUserSummary = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

const formatAttachmentResponse = (attachment) => {
  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    organizationId: attachment.organizationId,

    uploadedById: attachment.uploadedById,
    uploadedBy: formatUserSummary(attachment.uploadedBy),

    originalFileName: attachment.originalFileName,
    fileName: attachment.fileName,
    fileExtension: attachment.fileExtension,
    mimeType: attachment.mimeType,
    fileSize: Number(attachment.fileSize),

    verifiedFileSize:
      attachment.verifiedFileSize === null ||
      attachment.verifiedFileSize === undefined
        ? null
        : Number(attachment.verifiedFileSize),

    entityType: attachment.entityType,
    entityId: attachment.entityId,

    category: attachment.category,
    description: attachment.description,

    storageProvider: attachment.storageProvider,

    uploadStatus: attachment.uploadStatus,
    uploadExpiresAt: attachment.uploadExpiresAt,

    isArchived: attachment.isArchived,
    archivedAt: attachment.archivedAt,
    archivedById: attachment.archivedById,

    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  };
};

module.exports = {
  formatAttachmentResponse,
  formatUserSummary,
};
