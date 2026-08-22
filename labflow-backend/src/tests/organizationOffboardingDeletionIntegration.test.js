const { Organization, User } = require("../models");
const { sequelize } = require("../config/database");
const {
  ORGANIZATION_DELETION_STATES,
  deleteOrganizationWithReconciliation,
  getOrganizationDeletionReconciliationState,
} = require("../services/organizationOffboardingDeletionService");
const {
  deleteOrganizationAttachmentObjects,
} = require("../services/organizationAttachmentDeletionService");

const ORGANIZATION_STORAGE_PREFIX = (organizationId) =>
  `organizations/${organizationId}/`;

const TEST_PASSWORD_HASH =
  "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

const createUniqueSuffix = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createDatabaseFixture = async () => {
  const suffix = createUniqueSuffix();

  const organization = await Organization.create({
    name: `Offboarding Reconciliation Lab ${suffix}`,
    slug: `offboarding-reconciliation-${suffix}`,
    type: "lab",
    isActive: false,
  });

  const user = await User.create({
    name: "Offboarding Reconciliation Admin",
    email: `offboarding-reconciliation-${suffix}@example.com`,
    passwordHash: TEST_PASSWORD_HASH,
    role: "admin",
    organizationId: organization.id,
    emailVerifiedAt: new Date(),
  });

  return {
    organization,
    user,
  };
};

const createStorageHarness = ({ organizationId }) => {
  const prefix = ORGANIZATION_STORAGE_PREFIX(organizationId);

  let storageKeys = [
    `${prefix}project/100/staging/11111111-1111-4111-8111-111111111111/pending.csv`,
    `${prefix}project/100/attachments/22222222-2222-4222-8222-222222222222/final.pdf`,
  ];

  const storage = {
    listObjects: jest.fn(
      async ({ prefix: requestedPrefix, maxKeys = 1000 }) => {
        const matchingStorageKeys = storageKeys.filter((storageKey) =>
          storageKey.startsWith(requestedPrefix),
        );

        const pageStorageKeys = matchingStorageKeys.slice(0, maxKeys);

        return {
          objects: pageStorageKeys.map((storageKey) => ({
            storageKey,
            size: 100,
            etag: null,
            lastModified: null,
          })),

          isTruncated: matchingStorageKeys.length > pageStorageKeys.length,

          nextContinuationToken:
            matchingStorageKeys.length > pageStorageKeys.length
              ? "unused-test-continuation-token"
              : null,
        };
      },
    ),

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

    getStorageKeys() {
      return [...storageKeys];
    },
  };
};

describe("organization offboarding deletion PostgreSQL reconciliation", () => {
  const createdOrganizationIds = new Set();

  beforeAll(async () => {
    if (process.env.NODE_ENV !== "test") {
      throw new Error(
        "Organization offboarding deletion integration tests may run only with NODE_ENV=test.",
      );
    }

    await sequelize.authenticate();
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    for (const organizationId of [...createdOrganizationIds]) {
      const organization = await Organization.findByPk(organizationId);

      if (!organization) {
        createdOrganizationIds.delete(organizationId);
        continue;
      }

      /*
       * This test fixture contains no Attachment database rows.
       * Direct cleanup is safe here and prevents a failed test from leaving
       * synthetic organizations behind in the test database.
       */
      const {
        deleteOrganizationDatabaseData,
      } = require("../services/organizationDeletionService");

      await deleteOrganizationDatabaseData({
        organizationId,
        attachmentStorageDeletionConfirmed: true,
      });

      createdOrganizationIds.delete(organizationId);
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("recovers from storage-deleted/database-pending state and completes safely on retry", async () => {
    const fixture = await createDatabaseFixture();

    const organizationId = fixture.organization.id;

    createdOrganizationIds.add(organizationId);

    const storageHarness = createStorageHarness({
      organizationId,
    });

    const initialState = await getOrganizationDeletionReconciliationState({
      organizationId,
      storage: storageHarness.storage,
    });

    expect(initialState).toMatchObject({
      organizationId,
      state: ORGANIZATION_DELETION_STATES.PENDING,
      databasePresent: true,
      storageEmpty: false,
      requiresReconciliation: true,
    });

    /*
     * User.destroy happens very late in deleteOrganizationDatabaseData().
     *
     * By forcing that operation to fail once, the database transaction has
     * already issued most child deletions. PostgreSQL must roll all of them
     * back while the already-completed R2 deletion remains irreversible.
     */
    const userDestroySpy = jest
      .spyOn(User, "destroy")
      .mockRejectedValueOnce(
        new Error("forced late database deletion failure"),
      );

    await expect(
      deleteOrganizationWithReconciliation({
        organizationId,
        writesFrozenConfirmed: true,
        storage: storageHarness.storage,
      }),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_DATABASE_DELETION_FAILED_RECONCILIATION_REQUIRED",
      stage: "database",
      reconciliationState:
        ORGANIZATION_DELETION_STATES.STORAGE_DELETED_DATABASE_PENDING,
    });

    expect(userDestroySpy).toHaveBeenCalledTimes(1);

    /*
     * R2 deletion is irreversible and should already have completed.
     */
    expect(storageHarness.getStorageKeys()).toEqual([]);

    /*
     * PostgreSQL must have rolled back completely.
     */
    expect(
      await Organization.count({
        where: {
          id: organizationId,
        },
      }),
    ).toBe(1);

    expect(
      await User.count({
        where: {
          organizationId,
        },
      }),
    ).toBe(1);

    const interruptedState = await getOrganizationDeletionReconciliationState({
      organizationId,
      storage: storageHarness.storage,
    });

    expect(interruptedState).toEqual({
      organizationId,
      state: ORGANIZATION_DELETION_STATES.STORAGE_DELETED_DATABASE_PENDING,
      databasePresent: true,
      storageEmpty: true,
      requiresReconciliation: true,
    });

    /*
     * Restore the real Sequelize destroy implementation before retrying.
     */
    userDestroySpy.mockRestore();

    const retryResult = await deleteOrganizationWithReconciliation({
      organizationId,
      writesFrozenConfirmed: true,
      storage: storageHarness.storage,
    });

    expect(retryResult).toMatchObject({
      organizationId,
      outcome: "deleted",
      reconciliation: {
        organizationId,
        state: ORGANIZATION_DELETION_STATES.COMPLETE,
        databasePresent: false,
        storageEmpty: true,
        requiresReconciliation: false,
      },
    });

    /*
     * The retry must not require any object to reappear in storage.
     * deleteOrganizationAttachmentObjects() should simply verify the already
     * empty namespace and continue.
     */
    expect(storageHarness.getStorageKeys()).toEqual([]);

    expect(
      await Organization.count({
        where: {
          id: organizationId,
        },
      }),
    ).toBe(0);

    expect(
      await User.count({
        where: {
          organizationId,
        },
      }),
    ).toBe(0);

    const finalState = await getOrganizationDeletionReconciliationState({
      organizationId,
      storage: storageHarness.storage,
    });

    expect(finalState).toEqual({
      organizationId,
      state: ORGANIZATION_DELETION_STATES.COMPLETE,
      databasePresent: false,
      storageEmpty: true,
      requiresReconciliation: false,
    });

    createdOrganizationIds.delete(organizationId);
  });

  it("reconciles remaining storage when PostgreSQL is already absent", async () => {
    const suffix = createUniqueSuffix();

    /*
     * Use a positive ID that does not need to exist in PostgreSQL.
     */
    const missingOrganizationId =
      900000000 + Number(String(Date.now()).slice(-7));

    expect(await Organization.findByPk(missingOrganizationId)).toBeNull();

    const prefix = ORGANIZATION_STORAGE_PREFIX(missingOrganizationId);

    let storageKeys = [
      `${prefix}experiment/10/staging/33333333-3333-4333-8333-333333333333/${suffix}.csv`,
    ];

    const storage = {
      listObjects: jest.fn(
        async ({ prefix: requestedPrefix, maxKeys = 1000 }) => {
          const matches = storageKeys
            .filter((storageKey) => storageKey.startsWith(requestedPrefix))
            .slice(0, maxKeys);

          return {
            objects: matches.map((storageKey) => ({
              storageKey,
              size: 50,
              etag: null,
              lastModified: null,
            })),
            isTruncated: false,
            nextContinuationToken: null,
          };
        },
      ),

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

    const initialState = await getOrganizationDeletionReconciliationState({
      organizationId: missingOrganizationId,
      storage,
    });

    expect(initialState.state).toBe(
      ORGANIZATION_DELETION_STATES.DATABASE_DELETED_STORAGE_REMAINING,
    );

    const result = await deleteOrganizationWithReconciliation({
      organizationId: missingOrganizationId,
      writesFrozenConfirmed: true,
      storage,

      /*
       * Explicitly use the real storage deletion implementation while making
       * it impossible for this branch to touch database deletion.
       */
      deleteStorageObjects: deleteOrganizationAttachmentObjects,

      deleteDatabaseData: jest.fn(() => {
        throw new Error(
          "Database deletion must not run when the organization is already absent.",
        );
      }),
    });

    expect(result).toMatchObject({
      organizationId: missingOrganizationId,
      outcome: "reconciled_storage_only",
      reconciliation: {
        state: ORGANIZATION_DELETION_STATES.COMPLETE,
        databasePresent: false,
        storageEmpty: true,
        requiresReconciliation: false,
      },
    });

    expect(storageKeys).toEqual([]);
  });
});
