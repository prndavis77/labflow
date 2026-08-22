"use strict";

const { Organization } = require("../models");
const {
  deleteOrganizationAttachmentObjects,
  verifyOrganizationAttachmentStorageEmpty,
} = require("./organizationAttachmentDeletionService");
const {
  deleteOrganizationDatabaseData,
  validateOrganizationId,
} = require("./organizationDeletionService");
const { getAttachmentStorage } = require("../storage/attachmentStorage");
const { logError } = require("../utils/errorLogger");

const ORGANIZATION_DELETION_STATES = Object.freeze({
  PENDING: "pending",
  STORAGE_DELETED_DATABASE_PENDING: "storage_deleted_database_pending",
  DATABASE_DELETED_STORAGE_REMAINING: "database_deleted_storage_remaining",
  COMPLETE: "complete",
});

class OrganizationOffboardingDeletionError extends Error {
  constructor(message, code, options = {}) {
    super(message);

    this.name = "OrganizationOffboardingDeletionError";
    this.code = code;

    if (options.stage) {
      this.stage = options.stage;
    }

    if (options.reconciliationState) {
      this.reconciliationState = options.reconciliationState;
    }
  }
}

const getOrganizationDeletionReconciliationState = async ({
  organizationId,
  storage = getAttachmentStorage(),
  organizationModel = Organization,
} = {}) => {
  const normalizedOrganizationId = validateOrganizationId(organizationId);

  const [organization, storageVerification] = await Promise.all([
    organizationModel.findByPk(normalizedOrganizationId, {
      attributes: ["id"],
    }),

    verifyOrganizationAttachmentStorageEmpty({
      organizationId: normalizedOrganizationId,
      storage,
    }),
  ]);

  const databasePresent = Boolean(organization);
  const storageEmpty = storageVerification.empty === true;

  let state;

  if (databasePresent && !storageEmpty) {
    state = ORGANIZATION_DELETION_STATES.PENDING;
  } else if (databasePresent && storageEmpty) {
    state = ORGANIZATION_DELETION_STATES.STORAGE_DELETED_DATABASE_PENDING;
  } else if (!databasePresent && !storageEmpty) {
    state = ORGANIZATION_DELETION_STATES.DATABASE_DELETED_STORAGE_REMAINING;
  } else {
    state = ORGANIZATION_DELETION_STATES.COMPLETE;
  }

  return {
    organizationId: normalizedOrganizationId,
    state,
    databasePresent,
    storageEmpty,
    requiresReconciliation: state !== ORGANIZATION_DELETION_STATES.COMPLETE,
  };
};

const deleteOrganizationWithReconciliation = async ({
  organizationId,
  writesFrozenConfirmed = false,
  storage = getAttachmentStorage(),
  organizationModel = Organization,
  deleteStorageObjects = deleteOrganizationAttachmentObjects,
  deleteDatabaseData = deleteOrganizationDatabaseData,
} = {}) => {
  const normalizedOrganizationId = validateOrganizationId(organizationId);

  /*
   * R2 deletion cannot be rolled back.
   *
   * Never start destructive offboarding while the organization can still
   * create or mutate application data. 26A.4f provides the actual
   * access/session invalidation mechanism. Until then callers must explicitly
   * confirm that writes have already been frozen by an operator-controlled
   * mechanism.
   */
  if (writesFrozenConfirmed !== true) {
    throw new OrganizationOffboardingDeletionError(
      "Organization writes must be frozen before permanent deletion.",
      "ORGANIZATION_WRITES_NOT_FROZEN",
      {
        stage: "precondition",
      },
    );
  }

  const initialState = await getOrganizationDeletionReconciliationState({
    organizationId: normalizedOrganizationId,
    storage,
    organizationModel,
  });

  /*
   * Idempotent retry behavior:
   * if both PostgreSQL and R2 are already clear, there is nothing left to do.
   */
  if (initialState.state === ORGANIZATION_DELETION_STATES.COMPLETE) {
    return {
      organizationId: normalizedOrganizationId,
      outcome: "already_complete",
      storageDeletion: null,
      databaseDeletion: null,
      reconciliation: initialState,
    };
  }

  let storageDeletion = null;

  /*
   * PostgreSQL may already be gone while R2 objects remain because of a prior
   * abnormal operation, manual intervention, or legacy behavior.
   *
   * In that case, reconcile the remaining storage namespace without attempting
   * to delete a database organization that no longer exists.
   */
  if (
    initialState.state ===
    ORGANIZATION_DELETION_STATES.DATABASE_DELETED_STORAGE_REMAINING
  ) {
    try {
      storageDeletion = await deleteStorageObjects({
        organizationId: normalizedOrganizationId,
        storage,
      });
    } catch (error) {
      logError(error, {
        event: "organization_deletion_storage_reconciliation_failed",
        message:
          "Failed to reconcile organization attachment storage after database deletion",
        context: {
          organizationId: normalizedOrganizationId,
        },
      });

      throw new OrganizationOffboardingDeletionError(
        "Organization storage reconciliation failed.",
        "ORGANIZATION_STORAGE_RECONCILIATION_FAILED",
        {
          stage: "storage",
          reconciliationState: initialState.state,
        },
      );
    }

    const finalState = await getOrganizationDeletionReconciliationState({
      organizationId: normalizedOrganizationId,
      storage,
      organizationModel,
    });

    if (finalState.state !== ORGANIZATION_DELETION_STATES.COMPLETE) {
      throw new OrganizationOffboardingDeletionError(
        "Organization deletion reconciliation did not reach a complete state.",
        "ORGANIZATION_RECONCILIATION_INCOMPLETE",
        {
          stage: "verification",
          reconciliationState: finalState.state,
        },
      );
    }

    return {
      organizationId: normalizedOrganizationId,
      outcome: "reconciled_storage_only",
      storageDeletion,
      databaseDeletion: null,
      reconciliation: finalState,
    };
  }

  /*
   * For a normal deletion or a retry where storage is already empty, run the
   * storage cleanup first. The storage service is intentionally idempotent.
   */
  try {
    storageDeletion = await deleteStorageObjects({
      organizationId: normalizedOrganizationId,
      storage,
    });
  } catch (error) {
    logError(error, {
      event: "organization_deletion_storage_failed",
      message: "Organization attachment storage deletion failed",
      context: {
        organizationId: normalizedOrganizationId,
      },
    });

    throw new OrganizationOffboardingDeletionError(
      "Organization attachment storage deletion failed.",
      "ORGANIZATION_STORAGE_DELETION_FAILED",
      {
        stage: "storage",
        reconciliationState: initialState.state,
      },
    );
  }

  if (storageDeletion?.verifiedEmpty !== true) {
    throw new OrganizationOffboardingDeletionError(
      "Organization attachment storage was not verified as empty.",
      "ORGANIZATION_STORAGE_VERIFICATION_FAILED",
      {
        stage: "storage_verification",
      },
    );
  }

  let databaseDeletion;

  try {
    databaseDeletion = await deleteDatabaseData({
      organizationId: normalizedOrganizationId,
      attachmentStorageDeletionConfirmed: true,
    });
  } catch (error) {
    /*
     * R2 may now be permanently empty while PostgreSQL has rolled back.
     * Determine the actual state rather than guessing from the thrown error.
     */
    let reconciliationState;

    try {
      reconciliationState = await getOrganizationDeletionReconciliationState({
        organizationId: normalizedOrganizationId,
        storage,
        organizationModel,
      });
    } catch (reconciliationError) {
      logError(reconciliationError, {
        event: "organization_deletion_reconciliation_check_failed",
        message:
          "Failed to determine organization state after database deletion failure",
        context: {
          organizationId: normalizedOrganizationId,
        },
      });

      logError(error, {
        event: "organization_deletion_database_failed",
        message:
          "Organization database deletion failed after attachment storage deletion",
        context: {
          organizationId: normalizedOrganizationId,
        },
      });

      throw new OrganizationOffboardingDeletionError(
        "Database deletion failed after storage deletion and the resulting state could not be verified.",
        "ORGANIZATION_DATABASE_DELETION_FAILED_STATE_UNKNOWN",
        {
          stage: "database",
        },
      );
    }

    logError(error, {
      event: "organization_deletion_database_failed",
      message:
        "Organization database deletion failed after attachment storage deletion",
      context: {
        organizationId: normalizedOrganizationId,
        reconciliationState: reconciliationState.state,
      },
    });

    throw new OrganizationOffboardingDeletionError(
      "Database deletion failed after attachment storage deletion. Reconciliation is required.",
      "ORGANIZATION_DATABASE_DELETION_FAILED_RECONCILIATION_REQUIRED",
      {
        stage: "database",
        reconciliationState: reconciliationState.state,
      },
    );
  }

  const finalState = await getOrganizationDeletionReconciliationState({
    organizationId: normalizedOrganizationId,
    storage,
    organizationModel,
  });

  if (finalState.state !== ORGANIZATION_DELETION_STATES.COMPLETE) {
    throw new OrganizationOffboardingDeletionError(
      "Organization deletion finished but could not be verified as complete.",
      "ORGANIZATION_POST_DELETE_VERIFICATION_FAILED",
      {
        stage: "verification",
        reconciliationState: finalState.state,
      },
    );
  }

  return {
    organizationId: normalizedOrganizationId,
    outcome: "deleted",
    storageDeletion,
    databaseDeletion,
    reconciliation: finalState,
  };
};

module.exports = {
  ORGANIZATION_DELETION_STATES,
  OrganizationOffboardingDeletionError,
  deleteOrganizationWithReconciliation,
  getOrganizationDeletionReconciliationState,
};
