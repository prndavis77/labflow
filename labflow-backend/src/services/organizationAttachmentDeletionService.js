"use strict";

const { getAttachmentStorage } = require("../storage/attachmentStorage");
const {
  createOrganizationStoragePrefix,
} = require("../storage/utils/storageKey");

const ORGANIZATION_DELETION_BATCH_SIZE = 1000;
const MAX_ORGANIZATION_DELETION_ROUNDS = 10000;

class OrganizationAttachmentDeletionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OrganizationAttachmentDeletionError";
    this.code = code;
  }
}

const assertStorageSupportsOrganizationDeletion = (storage) => {
  if (!storage || typeof storage.listObjects !== "function") {
    throw new OrganizationAttachmentDeletionError(
      "Attachment storage does not support prefix listing.",
      "STORAGE_PREFIX_LIST_UNSUPPORTED",
    );
  }

  if (typeof storage.deleteObjects !== "function") {
    throw new OrganizationAttachmentDeletionError(
      "Attachment storage does not support bulk object deletion.",
      "STORAGE_BULK_DELETE_UNSUPPORTED",
    );
  }
};

const assertObjectsBelongToPrefix = ({ objects, prefix }) => {
  for (const object of objects) {
    if (
      !object ||
      typeof object.storageKey !== "string" ||
      !object.storageKey.startsWith(prefix)
    ) {
      throw new OrganizationAttachmentDeletionError(
        "Storage listing contained an object outside the organization namespace.",
        "ORGANIZATION_STORAGE_PREFIX_MISMATCH",
      );
    }
  }
};

const getOrganizationAttachmentStorageInventory = async ({
  organizationId,
  storage = getAttachmentStorage(),
} = {}) => {
  assertStorageSupportsOrganizationDeletion(storage);

  const prefix = createOrganizationStoragePrefix({
    organizationId,
  });

  const objects = [];
  let continuationToken;

  do {
    const page = await storage.listObjects({
      prefix,
      continuationToken,
      maxKeys: ORGANIZATION_DELETION_BATCH_SIZE,
    });

    assertObjectsBelongToPrefix({
      objects: page.objects,
      prefix,
    });

    objects.push(...page.objects);

    if (page.isTruncated && !page.nextContinuationToken) {
      throw new OrganizationAttachmentDeletionError(
        "Storage listing was truncated without a continuation token.",
        "INVALID_STORAGE_PAGINATION",
      );
    }

    continuationToken = page.isTruncated ? page.nextContinuationToken : null;
  } while (continuationToken);

  return {
    organizationId: Number(organizationId),
    prefix,
    objectCount: objects.length,
    totalBytes: objects.reduce((total, object) => {
      return total + (Number.isFinite(object.size) ? object.size : 0);
    }, 0),
    objects,
  };
};

const verifyOrganizationAttachmentStorageEmpty = async ({
  organizationId,
  storage = getAttachmentStorage(),
} = {}) => {
  assertStorageSupportsOrganizationDeletion(storage);

  const prefix = createOrganizationStoragePrefix({
    organizationId,
  });

  const page = await storage.listObjects({
    prefix,
    maxKeys: 1,
  });

  assertObjectsBelongToPrefix({
    objects: page.objects,
    prefix,
  });

  return {
    organizationId: Number(organizationId),
    prefix,
    empty: page.objects.length === 0,
    remainingObjectCountAtLeast: page.objects.length,
  };
};

const deleteOrganizationAttachmentObjects = async ({
  organizationId,
  storage = getAttachmentStorage(),
} = {}) => {
  assertStorageSupportsOrganizationDeletion(storage);

  const prefix = createOrganizationStoragePrefix({
    organizationId,
  });

  let deletedObjectCount = 0;
  let deletionRounds = 0;

  /*
   * Always request the first page again after each delete instead of carrying a
   * continuation token across a mutating listing. That prevents deletion from
   * shifting the result set underneath a continuation token and accidentally
   * skipping an object.
   */
  while (true) {
    const page = await storage.listObjects({
      prefix,
      maxKeys: ORGANIZATION_DELETION_BATCH_SIZE,
    });

    assertObjectsBelongToPrefix({
      objects: page.objects,
      prefix,
    });

    if (page.objects.length === 0) {
      break;
    }

    deletionRounds += 1;

    if (deletionRounds > MAX_ORGANIZATION_DELETION_ROUNDS) {
      throw new OrganizationAttachmentDeletionError(
        "Organization attachment deletion exceeded the maximum number of rounds.",
        "ORGANIZATION_STORAGE_DELETE_LIMIT_EXCEEDED",
      );
    }

    await storage.deleteObjects({
      storageKeys: page.objects.map((object) => object.storageKey),
    });

    deletedObjectCount += page.objects.length;
  }

  const verification = await verifyOrganizationAttachmentStorageEmpty({
    organizationId,
    storage,
  });

  if (!verification.empty) {
    throw new OrganizationAttachmentDeletionError(
      "Organization attachment storage could not be verified as empty.",
      "ORGANIZATION_STORAGE_NOT_EMPTY",
    );
  }

  return {
    organizationId: Number(organizationId),
    prefix,
    deletedObjectCount,
    deletionRounds,
    verifiedEmpty: true,
  };
};

module.exports = {
  OrganizationAttachmentDeletionError,
  deleteOrganizationAttachmentObjects,
  getOrganizationAttachmentStorageInventory,
  verifyOrganizationAttachmentStorageEmpty,
};
