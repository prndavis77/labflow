const {
  ORGANIZATION_DELETION_STATES,
  OrganizationOffboardingDeletionError,
  deleteOrganizationWithReconciliation,
  getOrganizationDeletionReconciliationState,
} = require("../services/organizationOffboardingDeletionService");

const ORGANIZATION_ID = 17;
const PREFIX = "organizations/17/";
const FROZEN_AT = new Date("2026-08-24T09:00:00.000Z");
const DELETION_NOW = new Date("2026-08-24T09:10:00.000Z");

const createStorageHarness = (initialStorageKeys = []) => {
  let storageKeys = [...initialStorageKeys];

  const storage = {
    listObjects: jest.fn(async ({ prefix, maxKeys = 1000 }) => {
      const objects = storageKeys
        .filter((storageKey) => storageKey.startsWith(prefix))
        .slice(0, maxKeys)
        .map((storageKey) => ({
          storageKey,
          size: 100,
          etag: null,
          lastModified: null,
        }));

      return {
        objects,
        isTruncated:
          storageKeys.filter((storageKey) => storageKey.startsWith(prefix))
            .length > objects.length,
        nextContinuationToken: null,
      };
    }),

    deleteObjects: jest.fn(async ({ storageKeys: keysToDelete }) => {
      const deleteSet = new Set(keysToDelete);

      storageKeys = storageKeys.filter(
        (storageKey) => !deleteSet.has(storageKey),
      );

      return {
        deleted: true,
        deletedCount: keysToDelete.length,
      };
    }),
  };

  return {
    storage,

    getStorageKeys: () => [...storageKeys],
  };
};

const createOrganizationModelHarness = ({
  databasePresent = true,
  isActive = false,
  offboardingFrozenAt = FROZEN_AT,
} = {}) => {
  let present = databasePresent;
  let active = isActive;

  return {
    organizationModel: {
      findByPk: jest.fn(async () => {
        return present
          ? {
              id: ORGANIZATION_ID,
              isActive: active,
              offboardingFrozenAt,
            }
          : null;
      }),
    },

    setDatabasePresent(value) {
      present = value;
    },

    setOrganizationActive(value) {
      active = value;
    },

    isDatabasePresent() {
      return present;
    },
  };
};

describe("organizationOffboardingDeletionService", () => {
  describe("getOrganizationDeletionReconciliationState", () => {
    it("reports pending when database and storage both remain", async () => {
      const { storage } = createStorageHarness([
        `${PREFIX}project/1/attachments/a/file.pdf`,
      ]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: true,
      });

      await expect(
        getOrganizationDeletionReconciliationState({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel,
        }),
      ).resolves.toEqual({
        organizationId: ORGANIZATION_ID,
        state: ORGANIZATION_DELETION_STATES.PENDING,
        databasePresent: true,
        storageEmpty: false,
        requiresReconciliation: true,
      });
    });

    it("reports storage deleted/database pending", async () => {
      const { storage } = createStorageHarness([]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: true,
      });

      await expect(
        getOrganizationDeletionReconciliationState({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel,
        }),
      ).resolves.toMatchObject({
        state: ORGANIZATION_DELETION_STATES.STORAGE_DELETED_DATABASE_PENDING,
        databasePresent: true,
        storageEmpty: true,
      });
    });

    it("reports database deleted/storage remaining", async () => {
      const { storage } = createStorageHarness([
        `${PREFIX}project/1/staging/a/file.csv`,
      ]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: false,
      });

      await expect(
        getOrganizationDeletionReconciliationState({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel,
        }),
      ).resolves.toMatchObject({
        state: ORGANIZATION_DELETION_STATES.DATABASE_DELETED_STORAGE_REMAINING,
        databasePresent: false,
        storageEmpty: false,
      });
    });

    it("reports complete when both database and storage are gone", async () => {
      const { storage } = createStorageHarness([]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: false,
      });

      await expect(
        getOrganizationDeletionReconciliationState({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel,
        }),
      ).resolves.toEqual({
        organizationId: ORGANIZATION_ID,
        state: ORGANIZATION_DELETION_STATES.COMPLETE,
        databasePresent: false,
        storageEmpty: true,
        requiresReconciliation: false,
      });
    });
  });

  describe("deleteOrganizationWithReconciliation", () => {
    it("refuses destructive deletion when the organization is still active", async () => {
      const { storage } = createStorageHarness([
        `${PREFIX}project/1/attachments/a/file.pdf`,
      ]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: true,
        isActive: true,
      });

      const deleteStorageObjects = jest.fn();
      const deleteDatabaseData = jest.fn();

      await expect(
        deleteOrganizationWithReconciliation({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel,
          deleteStorageObjects,
          deleteDatabaseData,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_WRITES_NOT_FROZEN",
        stage: "precondition",
      });

      /*
       * This is the critical safety guarantee. No irreversible R2 operation may
       * begin while PostgreSQL still says the organization is active.
       */
      expect(deleteStorageObjects).not.toHaveBeenCalled();
      expect(deleteDatabaseData).not.toHaveBeenCalled();
    });

    it("allows deletion to proceed when the organization is authoritatively inactive", async () => {
      const { storage } = createStorageHarness([]);

      const database = createOrganizationModelHarness({
        databasePresent: true,
        isActive: false,
      });

      const deleteStorageObjects = jest.fn().mockResolvedValue({
        organizationId: ORGANIZATION_ID,
        prefix: PREFIX,
        deletedObjectCount: 0,
        deletionRounds: 0,
        verifiedEmpty: true,
      });

      const deleteDatabaseData = jest.fn(async () => {
        database.setDatabasePresent(false);

        return {
          organizationId: ORGANIZATION_ID,
          deleted: {
            organizations: 1,
          },
        };
      });

      const result = await deleteOrganizationWithReconciliation({
        organizationId: ORGANIZATION_ID,
        storage,
        organizationModel: database.organizationModel,
        deleteStorageObjects,
        deleteDatabaseData,
      });

      expect(result.outcome).toBe("deleted");

      expect(deleteStorageObjects).toHaveBeenCalledTimes(1);
      expect(deleteDatabaseData).toHaveBeenCalledTimes(1);
    });

    it("returns idempotent success when deletion is already complete", async () => {
      const { storage } = createStorageHarness([]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: false,
      });

      const deleteStorageObjects = jest.fn();
      const deleteDatabaseData = jest.fn();

      const result = await deleteOrganizationWithReconciliation({
        organizationId: ORGANIZATION_ID,
        storage,
        organizationModel,
        deleteStorageObjects,
        deleteDatabaseData,
      });

      expect(result.outcome).toBe("already_complete");
      expect(result.reconciliation.state).toBe(
        ORGANIZATION_DELETION_STATES.COMPLETE,
      );

      expect(deleteStorageObjects).not.toHaveBeenCalled();
      expect(deleteDatabaseData).not.toHaveBeenCalled();
    });

    it("never starts database deletion when storage deletion fails", async () => {
      const { storage } = createStorageHarness([
        `${PREFIX}project/1/attachments/a/file.pdf`,
      ]);

      const { organizationModel } = createOrganizationModelHarness();

      const deleteStorageObjects = jest
        .fn()
        .mockRejectedValue(new Error("R2 unavailable"));

      const deleteDatabaseData = jest.fn();

      await expect(
        deleteOrganizationWithReconciliation({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel,
          deleteStorageObjects,
          deleteDatabaseData,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_STORAGE_DELETION_FAILED",
        stage: "storage",
      });

      expect(deleteDatabaseData).not.toHaveBeenCalled();
    });

    it("passes confirmed storage deletion into database deletion", async () => {
      const { storage } = createStorageHarness([
        `${PREFIX}project/1/attachments/a/file.pdf`,
      ]);

      const database = createOrganizationModelHarness({
        databasePresent: true,
      });

      const deleteStorageObjects = jest.fn(async () => {
        await storage.deleteObjects({
          storageKeys: [`${PREFIX}project/1/attachments/a/file.pdf`],
        });

        return {
          organizationId: ORGANIZATION_ID,
          prefix: PREFIX,
          deletedObjectCount: 1,
          deletionRounds: 1,
          verifiedEmpty: true,
        };
      });

      const deleteDatabaseData = jest.fn(async (options) => {
        expect(options).toEqual({
          organizationId: ORGANIZATION_ID,
          attachmentStorageDeletionConfirmed: true,
        });

        database.setDatabasePresent(false);

        return {
          organizationId: ORGANIZATION_ID,
          deleted: {
            organizations: 1,
          },
        };
      });

      const result = await deleteOrganizationWithReconciliation({
        organizationId: ORGANIZATION_ID,
        storage,
        organizationModel: database.organizationModel,
        deleteStorageObjects,
        deleteDatabaseData,
      });

      expect(result.outcome).toBe("deleted");
      expect(result.reconciliation.state).toBe(
        ORGANIZATION_DELETION_STATES.COMPLETE,
      );

      expect(deleteStorageObjects).toHaveBeenCalledTimes(1);
      expect(deleteDatabaseData).toHaveBeenCalledTimes(1);
    });

    it("reports reconciliation required when database deletion fails after storage deletion", async () => {
      const { storage } = createStorageHarness([]);

      const database = createOrganizationModelHarness({
        databasePresent: true,
      });

      const deleteStorageObjects = jest.fn().mockResolvedValue({
        organizationId: ORGANIZATION_ID,
        prefix: PREFIX,
        deletedObjectCount: 0,
        deletionRounds: 0,
        verifiedEmpty: true,
      });

      const deleteDatabaseData = jest
        .fn()
        .mockRejectedValue(new Error("forced database deletion failure"));

      await expect(
        deleteOrganizationWithReconciliation({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel: database.organizationModel,
          deleteStorageObjects,
          deleteDatabaseData,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_DATABASE_DELETION_FAILED_RECONCILIATION_REQUIRED",
        stage: "database",
        reconciliationState:
          ORGANIZATION_DELETION_STATES.STORAGE_DELETED_DATABASE_PENDING,
      });

      expect(database.isDatabasePresent()).toBe(true);
    });

    it("safely retries when storage is already empty but the database remains", async () => {
      const { storage } = createStorageHarness([]);

      const database = createOrganizationModelHarness({
        databasePresent: true,
      });

      const deleteStorageObjects = jest.fn().mockResolvedValue({
        organizationId: ORGANIZATION_ID,
        prefix: PREFIX,
        deletedObjectCount: 0,
        deletionRounds: 0,
        verifiedEmpty: true,
      });

      const deleteDatabaseData = jest.fn(async () => {
        database.setDatabasePresent(false);

        return {
          organizationId: ORGANIZATION_ID,
          deleted: {
            organizations: 1,
          },
        };
      });

      const result = await deleteOrganizationWithReconciliation({
        organizationId: ORGANIZATION_ID,
        storage,
        organizationModel: database.organizationModel,
        deleteStorageObjects,
        deleteDatabaseData,
      });

      expect(result.outcome).toBe("deleted");

      expect(deleteStorageObjects).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        storage,
      });

      expect(deleteDatabaseData).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        attachmentStorageDeletionConfirmed: true,
      });

      expect(result.reconciliation.state).toBe(
        ORGANIZATION_DELETION_STATES.COMPLETE,
      );
    });

    it("reconciles orphaned storage when the database is already gone", async () => {
      const storageHarness = createStorageHarness([
        `${PREFIX}experiment/5/staging/a/orphan.csv`,
      ]);

      const database = createOrganizationModelHarness({
        databasePresent: false,
      });

      const deleteStorageObjects = jest.fn(async () => {
        await storageHarness.storage.deleteObjects({
          storageKeys: [`${PREFIX}experiment/5/staging/a/orphan.csv`],
        });

        return {
          organizationId: ORGANIZATION_ID,
          prefix: PREFIX,
          deletedObjectCount: 1,
          deletionRounds: 1,
          verifiedEmpty: true,
        };
      });

      const deleteDatabaseData = jest.fn();

      const result = await deleteOrganizationWithReconciliation({
        organizationId: ORGANIZATION_ID,
        storage: storageHarness.storage,
        organizationModel: database.organizationModel,
        deleteStorageObjects,
        deleteDatabaseData,
      });

      expect(result.outcome).toBe("reconciled_storage_only");

      expect(storageHarness.getStorageKeys()).toEqual([]);

      expect(deleteDatabaseData).not.toHaveBeenCalled();

      expect(result.reconciliation.state).toBe(
        ORGANIZATION_DELETION_STATES.COMPLETE,
      );
    });

    it("rejects a storage result that was not verified empty", async () => {
      const { storage } = createStorageHarness([]);

      const database = createOrganizationModelHarness({
        databasePresent: true,
      });

      const deleteStorageObjects = jest.fn().mockResolvedValue({
        organizationId: ORGANIZATION_ID,
        verifiedEmpty: false,
      });

      const deleteDatabaseData = jest.fn();

      await expect(
        deleteOrganizationWithReconciliation({
          organizationId: ORGANIZATION_ID,
          storage,
          organizationModel: database.organizationModel,
          deleteStorageObjects,
          deleteDatabaseData,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_STORAGE_VERIFICATION_FAILED",
        stage: "storage_verification",
      });

      expect(deleteDatabaseData).not.toHaveBeenCalled();
    });

    it("refuses deletion when the offboarding freeze timestamp is missing", async () => {
      const { storage } = createStorageHarness([
        `${PREFIX}project/1/attachments/a/file.pdf`,
      ]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: true,
        isActive: false,
        offboardingFrozenAt: null,
      });

      const deleteStorageObjects = jest.fn();
      const deleteDatabaseData = jest.fn();

      await expect(
        deleteOrganizationWithReconciliation({
          organizationId: ORGANIZATION_ID,
          now: DELETION_NOW,
          storage,
          organizationModel,
          deleteStorageObjects,
          deleteDatabaseData,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_FREEZE_TIMESTAMP_MISSING",
        stage: "precondition",
      });

      expect(deleteStorageObjects).not.toHaveBeenCalled();
      expect(deleteDatabaseData).not.toHaveBeenCalled();
    });

    it("refuses deletion before signed upload URL quiescence has elapsed", async () => {
      const frozenAt = new Date("2026-08-24T09:00:00.000Z");
      const tooEarly = new Date("2026-08-24T09:05:59.000Z");

      const { storage } = createStorageHarness([
        `${PREFIX}project/1/attachments/a/file.pdf`,
      ]);

      const { organizationModel } = createOrganizationModelHarness({
        databasePresent: true,
        isActive: false,
        offboardingFrozenAt: frozenAt,
      });

      const deleteStorageObjects = jest.fn();
      const deleteDatabaseData = jest.fn();

      await expect(
        deleteOrganizationWithReconciliation({
          organizationId: ORGANIZATION_ID,
          now: tooEarly,
          storage,
          organizationModel,
          deleteStorageObjects,
          deleteDatabaseData,
        }),
      ).rejects.toMatchObject({
        code: "ORGANIZATION_UPLOAD_QUIESCENCE_PENDING",
        stage: "precondition",
      });

      expect(deleteStorageObjects).not.toHaveBeenCalled();
      expect(deleteDatabaseData).not.toHaveBeenCalled();
    });

    it("allows deletion once the six-minute upload quiescence period has elapsed", async () => {
      const frozenAt = new Date("2026-08-24T09:00:00.000Z");
      const quiescenceBoundary = new Date("2026-08-24T09:06:00.000Z");

      const { storage } = createStorageHarness([]);

      const database = createOrganizationModelHarness({
        databasePresent: true,
        isActive: false,
        offboardingFrozenAt: frozenAt,
      });

      const deleteStorageObjects = jest.fn().mockResolvedValue({
        organizationId: ORGANIZATION_ID,
        prefix: PREFIX,
        deletedObjectCount: 0,
        deletionRounds: 0,
        verifiedEmpty: true,
      });

      const deleteDatabaseData = jest.fn(async () => {
        database.setDatabasePresent(false);

        return {
          organizationId: ORGANIZATION_ID,
          deleted: {
            organizations: 1,
          },
        };
      });

      const result = await deleteOrganizationWithReconciliation({
        organizationId: ORGANIZATION_ID,
        now: quiescenceBoundary,
        storage,
        organizationModel: database.organizationModel,
        deleteStorageObjects,
        deleteDatabaseData,
      });

      expect(result.outcome).toBe("deleted");
      expect(deleteStorageObjects).toHaveBeenCalledTimes(1);
      expect(deleteDatabaseData).toHaveBeenCalledTimes(1);
    });
  });

  it("uses a typed error for offboarding deletion failures", () => {
    const error = new OrganizationOffboardingDeletionError("test", "TEST_CODE");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("OrganizationOffboardingDeletionError");
    expect(error.code).toBe("TEST_CODE");
  });
});
