const { Op } = require("sequelize");

const {
  Attachment,
  AuditLog,
  Equipment,
  Experiment,
  Project,
  Protocol,
  Task,
  User,
} = require("../models");

const { sequelize } = require("../config/database");

const { getAttachmentStorage } = require("../storage/attachmentStorage");

const { validateAttachmentId } = require("../utils/attachmentValidation");

const { formatAttachmentResponse } = require("../utils/attachmentResponse");

const { AUDIT_ACTIONS } = require("../constants/auditActions");

const {
  ARCHIVED_ITEM_DEFAULT_PAGE_SIZE,
  ARCHIVED_ITEM_ENTITY_TYPES,
  ARCHIVED_ITEM_MAX_PAGE_SIZE,
} = require("../constants/archivedItems");

const STATUS_CODES = require("../constants/statusCodes");

const userAttributes = ["id", "name", "email", "role"];
const projectSummaryAttributes = ["id", "title", "status", "isArchived"];

const isPositiveIntegerString = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0;

const parsePositiveInteger = ({ value, fallback, maximum, fieldName }) => {
  if (value === undefined || value === "") {
    return {
      value: fallback,
    };
  }

  if (!isPositiveIntegerString(value)) {
    return {
      error: `${fieldName} must be a positive integer.`,
    };
  }

  const parsedValue = Number(value);

  if (maximum !== undefined && parsedValue > maximum) {
    return {
      error: `${fieldName} cannot be greater than ${maximum}.`,
    };
  }

  return {
    value: parsedValue,
  };
};

const parseDate = ({ value, fieldName, endOfDay = false }) => {
  if (!value) {
    return {};
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
    return {
      error: `${fieldName} must use the YYYY-MM-DD format.`,
    };
  }

  const date = new Date(
    `${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`,
  );

  if (Number.isNaN(date.getTime())) {
    return {
      error: `${fieldName} must be a valid date.`,
    };
  }

  return {
    value: date,
  };
};

const parseEntityId = (value) => {
  if (!isPositiveIntegerString(value)) {
    return {
      error: "The archived item ID must be a positive integer.",
    };
  }

  return {
    value: Number(value),
  };
};

const buildArchivedDateFilter = ({ archivedFrom, archivedTo }) => {
  if (!archivedFrom && !archivedTo) {
    return undefined;
  }

  const archivedAt = {};

  if (archivedFrom) {
    archivedAt[Op.gte] = archivedFrom;
  }

  if (archivedTo) {
    archivedAt[Op.lte] = archivedTo;
  }

  return archivedAt;
};

const isStorageObjectMissingError = (error) => {
  return (
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey" ||
    error?.$metadata?.httpStatusCode === 404
  );
};

const verifyAttachmentTarget = async ({
  attachment,
  organizationId,
  transaction,
  lock = false,
}) => {
  const targetConfig = ATTACHMENT_TARGET_CONFIG[attachment.entityType];

  if (!targetConfig) {
    return {
      allowed: false,
      statusCode: STATUS_CODES.CONFLICT,
      response: {
        status: "error",
        message: "The attachment is linked to an unsupported record type.",
        code: "INVALID_ATTACHMENT_TARGET",
      },
    };
  }

  const target = await targetConfig.model.findOne({
    where: {
      id: attachment.entityId,
      organizationId,
    },
    transaction,
    ...(lock
      ? {
          lock: transaction.LOCK.UPDATE,
        }
      : {}),
  });

  if (!target) {
    return {
      allowed: false,
      statusCode: STATUS_CODES.CONFLICT,
      response: {
        status: "error",
        message:
          "The linked record could not be found, so this attachment cannot be restored.",
        code: "ATTACHMENT_TARGET_NOT_FOUND",
      },
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(target.dataValues, "isArchived") &&
    target.isArchived
  ) {
    return {
      allowed: false,
      statusCode: STATUS_CODES.CONFLICT,
      response: {
        status: "error",
        message: "Restore the linked record before restoring this attachment.",
        code: "ARCHIVED_PARENT",
      },
    };
  }

  /*
   * A task, experiment, or protocol can itself be active while its
   * project is archived because project archiving does not cascade.
   * In that case the attachment would still be inaccessible through
   * the normal application, so verify the target's project as well.
   */
  if (
    ["task", "experiment", "protocol"].includes(attachment.entityType) &&
    target.projectId
  ) {
    const project = await Project.findOne({
      attributes: ["id", "isArchived"],
      where: {
        id: target.projectId,
        organizationId,
      },
      transaction,
      ...(lock
        ? {
            lock: transaction.LOCK.UPDATE,
          }
        : {}),
    });

    if (!project) {
      return {
        allowed: false,
        statusCode: STATUS_CODES.CONFLICT,
        response: {
          status: "error",
          message: "The linked record's project could not be found.",
          code: "PARENT_PROJECT_NOT_FOUND",
        },
      };
    }

    if (project.isArchived) {
      return {
        allowed: false,
        statusCode: STATUS_CODES.CONFLICT,
        response: {
          status: "error",
          message:
            "Restore the linked record's project before restoring this attachment.",
          code: "ARCHIVED_PARENT",
        },
      };
    }
  }

  return {
    allowed: true,
    target,
  };
};

const buildProjectConfig = ({ search }) => ({
  model: Project,

  attributes: [
    "id",
    "title",
    "description",
    "status",
    "startDate",
    "targetEndDate",
    "supervisorId",
    "isArchived",
    "archivedAt",
    "archivedById",
    "archiveReason",
    "createdAt",
    "updatedAt",
  ],

  searchWhere: search
    ? {
        title: {
          [Op.iLike]: `%${search}%`,
        },
      }
    : undefined,

  include: [
    {
      model: User,
      as: "supervisor",
      attributes: userAttributes,
      required: false,
    },
    {
      model: User,
      as: "archivedBy",
      attributes: userAttributes,
      required: false,
    },
  ],
});

const buildTaskConfig = ({ search, projectId }) => ({
  model: Task,

  attributes: [
    "id",
    "title",
    "description",
    "status",
    "priority",
    "dueDate",
    "projectId",
    "assignedToId",
    "createdById",
    "isArchived",
    "archivedAt",
    "archivedById",
    "archiveReason",
    "createdAt",
    "updatedAt",
  ],

  searchWhere: search
    ? {
        title: {
          [Op.iLike]: `%${search}%`,
        },
      }
    : undefined,

  additionalWhere: projectId
    ? {
        projectId,
      }
    : undefined,

  include: [
    {
      model: Project,
      as: "project",
      attributes: projectSummaryAttributes,
      required: false,
    },
    {
      model: User,
      as: "assignedTo",
      attributes: userAttributes,
      required: false,
    },
    {
      model: User,
      as: "createdBy",
      attributes: userAttributes,
      required: false,
    },
    {
      model: User,
      as: "archivedBy",
      attributes: userAttributes,
      required: false,
    },
  ],
});

const buildExperimentConfig = ({ search, projectId }) => ({
  model: Experiment,

  attributes: [
    "id",
    "title",
    "objective",
    "status",
    "reviewStatus",
    "startedAt",
    "completedAt",
    "projectId",
    "researcherId",
    "taskId",
    "protocolId",
    "createdById",
    "isArchived",
    "archivedAt",
    "archivedById",
    "archiveReason",
    "createdAt",
    "updatedAt",
  ],

  searchWhere: search
    ? {
        title: {
          [Op.iLike]: `%${search}%`,
        },
      }
    : undefined,

  additionalWhere: projectId
    ? {
        projectId,
      }
    : undefined,

  include: [
    {
      model: Project,
      as: "project",
      attributes: projectSummaryAttributes,
      required: false,
    },
    {
      model: User,
      as: "researcher",
      attributes: userAttributes,
      required: false,
    },
    {
      model: User,
      as: "createdBy",
      attributes: userAttributes,
      required: false,
    },
    {
      model: User,
      as: "archivedBy",
      attributes: userAttributes,
      required: false,
    },
  ],
});

const buildProtocolConfig = ({ search, projectId }) => ({
  model: Protocol,

  attributes: [
    "id",
    "title",
    "version",
    "purpose",
    "approvalStatus",
    "reviewStatus",
    "projectId",
    "equipmentId",
    "createdById",
    "approvedById",
    "approvedAt",
    "isArchived",
    "archivedAt",
    "archivedById",
    "archiveReason",
    "createdAt",
    "updatedAt",
  ],

  searchWhere: search
    ? {
        title: {
          [Op.iLike]: `%${search}%`,
        },
      }
    : undefined,

  additionalWhere: projectId
    ? {
        projectId,
      }
    : undefined,

  include: [
    {
      model: Project,
      as: "project",
      attributes: projectSummaryAttributes,
      required: false,
    },
    {
      model: Equipment,
      as: "equipment",
      attributes: ["id", "name", "status"],
      required: false,
    },
    {
      model: User,
      as: "createdBy",
      attributes: userAttributes,
      required: false,
    },
    {
      model: User,
      as: "archivedBy",
      attributes: userAttributes,
      required: false,
    },
  ],
});

const buildAttachmentConfig = ({ search }) => ({
  model: Attachment,

  // Intentionally excludes storageKey, checksum, ETag,
  // upload URLs, and other internal storage details.
  attributes: [
    "id",
    "uploadedById",
    "originalFileName",
    "fileName",
    "fileExtension",
    "mimeType",
    "fileSize",
    "verifiedFileSize",
    "storageProvider",
    "entityType",
    "entityId",
    "category",
    "description",
    "uploadStatus",
    "isArchived",
    "archivedAt",
    "archivedById",
    "createdAt",
    "updatedAt",
  ],

  searchWhere: search
    ? {
        originalFileName: {
          [Op.iLike]: `%${search}%`,
        },
      }
    : undefined,

  include: [
    {
      model: User,
      as: "uploadedBy",
      attributes: userAttributes,
      required: false,
    },
    {
      model: User,
      as: "archivedBy",
      attributes: userAttributes,
      required: false,
    },
  ],
});

const buildEntityConfig = ({ entityType, search, projectId }) => {
  switch (entityType) {
    case "project":
      return buildProjectConfig({
        search,
      });

    case "task":
      return buildTaskConfig({
        search,
        projectId,
      });

    case "experiment":
      return buildExperimentConfig({
        search,
        projectId,
      });

    case "protocol":
      return buildProtocolConfig({
        search,
        projectId,
      });

    case "attachment":
      return buildAttachmentConfig({
        search,
      });

    default:
      return null;
  }
};

const RESTORABLE_ENTITY_CONFIG = Object.freeze({
  project: {
    model: Project,
    action: AUDIT_ACTIONS.PROJECT_RESTORED,
    label: "Project",
  },

  task: {
    model: Task,
    action: AUDIT_ACTIONS.TASK_RESTORED,
    label: "Task",
  },

  experiment: {
    model: Experiment,
    action: AUDIT_ACTIONS.EXPERIMENT_RESTORED,
    label: "Experiment",
  },

  protocol: {
    model: Protocol,
    action: AUDIT_ACTIONS.PROTOCOL_RESTORED,
    label: "Protocol",
  },
});

const ATTACHMENT_TARGET_CONFIG = Object.freeze({
  project: {
    model: Project,
    label: "project",
  },

  task: {
    model: Task,
    label: "task",
  },

  experiment: {
    model: Experiment,
    label: "experiment",
  },

  protocol: {
    model: Protocol,
    label: "protocol",
  },

  equipment: {
    model: Equipment,
    label: "equipment",
  },
});

const verifyActiveParentProject = async ({
  item,
  organizationId,
  transaction,
}) => {
  if (!item.projectId) {
    return {
      allowed: true,
    };
  }

  const parentProject = await Project.findOne({
    attributes: ["id", "isArchived"],
    where: {
      id: item.projectId,
      organizationId,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!parentProject) {
    return {
      allowed: false,
      statusCode: STATUS_CODES.CONFLICT,
      response: {
        status: "error",
        message:
          "The parent project could not be found. Restore cannot continue.",
        code: "PARENT_PROJECT_NOT_FOUND",
      },
    };
  }

  if (parentProject.isArchived) {
    return {
      allowed: false,
      statusCode: STATUS_CODES.CONFLICT,
      response: {
        status: "error",
        message: "Restore the parent project before restoring this record.",
        code: "ARCHIVED_PARENT",
      },
    };
  }

  return {
    allowed: true,
  };
};

const buildRestoreMetadata = ({
  entityType,
  item,
  previousArchivedAt,
  previousArchivedById,
  previousArchiveReason,
}) => {
  const commonMetadata = {
    title: item.title,
    previousArchivedAt,
    previousArchivedById,
    previousArchiveReason,
  };

  switch (entityType) {
    case "project":
      return {
        ...commonMetadata,
        supervisorId: item.supervisorId,
      };

    case "task":
      return {
        ...commonMetadata,
        projectId: item.projectId,
        assignedToId: item.assignedToId,
        createdById: item.createdById,
      };

    case "experiment":
      return {
        ...commonMetadata,
        projectId: item.projectId,
        researcherId: item.researcherId,
        createdById: item.createdById,
      };

    case "protocol":
      return {
        ...commonMetadata,
        projectId: item.projectId,
        equipmentId: item.equipmentId,
        createdById: item.createdById,
      };

    default:
      return commonMetadata;
  }
};

const buildRestoreSummary = ({ entityType, title }) => {
  return `Restored ${entityType} "${title}".`;
};

const getArchivedItems = async (req, res) => {
  try {
    const {
      entityType,
      search,
      page,
      limit,
      archivedById,
      archivedFrom,
      archivedTo,
      projectId,
    } = req.query;

    if (!entityType) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: "entityType is required.",
        code: "ENTITY_TYPE_REQUIRED",
      });
    }

    if (!ARCHIVED_ITEM_ENTITY_TYPES.includes(entityType)) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: "Unsupported archived item type.",
        code: "INVALID_ENTITY_TYPE",
      });
    }

    const parsedPageResult = parsePositiveInteger({
      value: page,
      fallback: 1,
      fieldName: "page",
    });

    if (parsedPageResult.error) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: parsedPageResult.error,
        code: "INVALID_PAGE",
      });
    }

    const parsedLimitResult = parsePositiveInteger({
      value: limit,
      fallback: ARCHIVED_ITEM_DEFAULT_PAGE_SIZE,
      maximum: ARCHIVED_ITEM_MAX_PAGE_SIZE,
      fieldName: "limit",
    });

    if (parsedLimitResult.error) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: parsedLimitResult.error,
        code: "INVALID_LIMIT",
      });
    }

    let parsedArchivedById;

    if (archivedById !== undefined) {
      const result = parsePositiveInteger({
        value: archivedById,
        fieldName: "archivedById",
      });

      if (result.error) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          status: "error",
          message: result.error,
          code: "INVALID_ARCHIVED_BY_ID",
        });
      }

      parsedArchivedById = result.value;
    }

    let parsedProjectId;

    if (projectId !== undefined) {
      if (!["task", "experiment", "protocol"].includes(entityType)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          status: "error",
          message:
            "projectId is supported only for tasks, experiments, and protocols.",
          code: "PROJECT_FILTER_NOT_SUPPORTED",
        });
      }

      const result = parsePositiveInteger({
        value: projectId,
        fieldName: "projectId",
      });

      if (result.error) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          status: "error",
          message: result.error,
          code: "INVALID_PROJECT_ID",
        });
      }

      parsedProjectId = result.value;
    }

    const parsedArchivedFromResult = parseDate({
      value: archivedFrom,
      fieldName: "archivedFrom",
    });

    if (parsedArchivedFromResult.error) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: parsedArchivedFromResult.error,
        code: "INVALID_ARCHIVED_FROM",
      });
    }

    const parsedArchivedToResult = parseDate({
      value: archivedTo,
      fieldName: "archivedTo",
      endOfDay: true,
    });

    if (parsedArchivedToResult.error) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: parsedArchivedToResult.error,
        code: "INVALID_ARCHIVED_TO",
      });
    }

    if (
      parsedArchivedFromResult.value &&
      parsedArchivedToResult.value &&
      parsedArchivedFromResult.value > parsedArchivedToResult.value
    ) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: "archivedFrom cannot be later than archivedTo.",
        code: "INVALID_ARCHIVED_DATE_RANGE",
      });
    }

    const parsedPage = parsedPageResult.value;
    const parsedLimit = parsedLimitResult.value;
    const offset = (parsedPage - 1) * parsedLimit;

    const normalizedSearch = typeof search === "string" ? search.trim() : "";

    const entityConfig = buildEntityConfig({
      entityType,
      search: normalizedSearch,
      projectId: parsedProjectId,
    });

    const where = {
      organizationId: req.user.organizationId,
      isArchived: true,
      ...(entityConfig.searchWhere || {}),
      ...(entityConfig.additionalWhere || {}),
    };

    if (parsedArchivedById) {
      where.archivedById = parsedArchivedById;
    }

    const archivedDateFilter = buildArchivedDateFilter({
      archivedFrom: parsedArchivedFromResult.value,
      archivedTo: parsedArchivedToResult.value,
    });

    if (archivedDateFilter) {
      where.archivedAt = archivedDateFilter;
    }

    const { rows, count } = await entityConfig.model.findAndCountAll({
      attributes: entityConfig.attributes,
      where,
      include: entityConfig.include,
      order: [
        ["archivedAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: parsedLimit,
      offset,
      distinct: true,
    });

    return res.status(STATUS_CODES.OK).json({
      status: "success",
      data: {
        entityType,
        items: rows,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: count,
          totalPages: Math.ceil(count / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("Get archived items error:", error);

    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "An error occurred while fetching archived items.",
    });
  }
};

const restoreArchivedAttachment = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;

    const attachmentIdValidation = validateAttachmentId(id);

    if (!attachmentIdValidation.valid) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: "The attachment ID is invalid.",
        code: "INVALID_ENTITY_ID",
      });
    }

    /*
     * Load once without a transaction so the R2 HEAD request does not
     * hold database row locks while waiting on external storage.
     */
    const attachment = await Attachment.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
    });

    if (!attachment) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        status: "error",
        message: "Attachment not found.",
        code: "ARCHIVED_ITEM_NOT_FOUND",
      });
    }

    if (!attachment.isArchived) {
      return res.status(STATUS_CODES.OK).json({
        status: "success",
        message: "The attachment is already active.",
        data: {
          restored: false,
          entityType: "attachment",
          item: formatAttachmentResponse(attachment),
        },
      });
    }

    if (attachment.uploadStatus !== "available") {
      return res.status(STATUS_CODES.CONFLICT).json({
        status: "error",
        message: "Only completed attachments can be restored.",
        code: "ATTACHMENT_NOT_AVAILABLE",
      });
    }

    const initialTargetCheck = await verifyAttachmentTarget({
      attachment,
      organizationId: req.user.organizationId,
    });

    if (!initialTargetCheck.allowed) {
      return res
        .status(initialTargetCheck.statusCode)
        .json(initialTargetCheck.response);
    }

    const attachmentStorage = getAttachmentStorage();

    try {
      await attachmentStorage.getObjectMetadata({
        storageKey: attachment.storageKey,
      });
    } catch (storageError) {
      console.error("Error verifying archived attachment object", storageError);

      if (isStorageObjectMissingError(storageError)) {
        return res.status(STATUS_CODES.CONFLICT).json({
          status: "error",
          message:
            "The stored file could not be found, so this attachment cannot be restored.",
          code: "STORAGE_OBJECT_MISSING",
        });
      }

      return res.status(503).json({
        status: "error",
        message: "File storage is temporarily unavailable.",
        code: "STORAGE_UNAVAILABLE",
      });
    }

    /*
     * Reload and lock after storage verification. This prevents the
     * attachment or its linked record from changing before commit.
     */
    transaction = await sequelize.transaction();

    const lockedAttachment = await Attachment.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!lockedAttachment) {
      await transaction.rollback();
      transaction = null;

      return res.status(STATUS_CODES.NOT_FOUND).json({
        status: "error",
        message: "Attachment not found.",
        code: "ARCHIVED_ITEM_NOT_FOUND",
      });
    }

    /*
     * Another request may have restored it while R2 verification was
     * running. Treat that as an idempotent success.
     */
    if (!lockedAttachment.isArchived) {
      await transaction.rollback();
      transaction = null;

      return res.status(STATUS_CODES.OK).json({
        status: "success",
        message: "The attachment is already active.",
        data: {
          restored: false,
          entityType: "attachment",
          item: formatAttachmentResponse(lockedAttachment),
        },
      });
    }

    if (lockedAttachment.uploadStatus !== "available") {
      await transaction.rollback();
      transaction = null;

      return res.status(STATUS_CODES.CONFLICT).json({
        status: "error",
        message: "Only completed attachments can be restored.",
        code: "ATTACHMENT_NOT_AVAILABLE",
      });
    }

    const lockedTargetCheck = await verifyAttachmentTarget({
      attachment: lockedAttachment,
      organizationId: req.user.organizationId,
      transaction,
      lock: true,
    });

    if (!lockedTargetCheck.allowed) {
      await transaction.rollback();
      transaction = null;

      return res
        .status(lockedTargetCheck.statusCode)
        .json(lockedTargetCheck.response);
    }

    const previousArchivedAt = lockedAttachment.archivedAt;

    const previousArchivedById = lockedAttachment.archivedById;

    lockedAttachment.isArchived = false;
    lockedAttachment.archivedAt = null;
    lockedAttachment.archivedById = null;

    await lockedAttachment.save({
      transaction,
    });

    await AuditLog.create(
      {
        actorUserId: req.user.id,
        organizationId: req.user.organizationId,
        action: AUDIT_ACTIONS.ATTACHMENT_RESTORED,
        entityType: "attachment",
        entityId: null,
        summary:
          `Restored attachment ` + `"${lockedAttachment.originalFileName}".`,
        metadata: {
          attachmentId: lockedAttachment.id,
          originalFileName: lockedAttachment.originalFileName,
          attachmentEntityType: lockedAttachment.entityType,
          attachmentEntityId: lockedAttachment.entityId,
          uploadedById: lockedAttachment.uploadedById,
          storageProvider: lockedAttachment.storageProvider,
          previousArchivedAt,
          previousArchivedById,
        },
      },
      {
        transaction,
      },
    );

    await transaction.commit();
    transaction = null;

    return res.status(STATUS_CODES.OK).json({
      status: "success",
      message: "Attachment restored successfully.",
      data: {
        restored: true,
        entityType: "attachment",
        item: formatAttachmentResponse(lockedAttachment),
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Restore archived attachment error:", error);

    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "An error occurred while restoring the archived attachment.",
    });
  }
};

const restoreArchivedItem = async (req, res) => {
  const { entityType } = req.params;

  if (entityType === "attachment") {
    return restoreArchivedAttachment(req, res);
  }

  let transaction;

  try {
    transaction = await sequelize.transaction();

    const { entityType, id } = req.params;

    const entityConfig = RESTORABLE_ENTITY_CONFIG[entityType];

    if (!entityConfig) {
      await transaction.rollback();

      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: "Unsupported archived item type for restoration.",
        code: "INVALID_ENTITY_TYPE",
      });
    }

    const parsedIdResult = parseEntityId(id);

    if (parsedIdResult.error) {
      await transaction.rollback();

      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: "error",
        message: parsedIdResult.error,
        code: "INVALID_ENTITY_ID",
      });
    }

    const item = await entityConfig.model.findOne({
      where: {
        id: parsedIdResult.value,
        organizationId: req.user.organizationId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      await transaction.rollback();

      return res.status(STATUS_CODES.NOT_FOUND).json({
        status: "error",
        message: `${entityConfig.label} not found.`,
        code: "ARCHIVED_ITEM_NOT_FOUND",
      });
    }

    if (!item.isArchived) {
      await transaction.rollback();

      return res.status(STATUS_CODES.OK).json({
        status: "success",
        message: `The ${entityType} is already active.`,
        data: {
          restored: false,
          entityType,
          item,
        },
      });
    }

    if (["task", "experiment", "protocol"].includes(entityType)) {
      const parentCheck = await verifyActiveParentProject({
        item,
        organizationId: req.user.organizationId,
        transaction,
      });

      if (!parentCheck.allowed) {
        await transaction.rollback();

        return res.status(parentCheck.statusCode).json(parentCheck.response);
      }
    }

    const previousArchivedAt = item.archivedAt;
    const previousArchivedById = item.archivedById;
    const previousArchiveReason = item.archiveReason;

    item.isArchived = false;
    item.archivedAt = null;
    item.archivedById = null;
    item.archiveReason = null;

    await item.save({
      transaction,
    });

    await AuditLog.create(
      {
        actorUserId: req.user.id,
        organizationId: req.user.organizationId,
        action: entityConfig.action,
        entityType,
        entityId: item.id,
        summary: buildRestoreSummary({
          entityType,
          title: item.title,
        }),
        metadata: buildRestoreMetadata({
          entityType,
          item,
          previousArchivedAt,
          previousArchivedById,
          previousArchiveReason,
        }),
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.status(STATUS_CODES.OK).json({
      status: "success",
      message: `${entityConfig.label} restored successfully.`,
      data: {
        restored: true,
        entityType,
        item,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Restore archived item error:", error);

    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "An error occurred while restoring the archived item.",
    });
  }
};

module.exports = { getArchivedItems, restoreArchivedItem };
