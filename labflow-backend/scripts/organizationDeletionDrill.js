"use strict";

require("dotenv").config();

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const REQUIRED_NODE_ENV = "test";
const REQUIRED_DATABASE_NAME = "labflow_test";
const REQUIRED_R2_BUCKET = "labflow-test-attachments";
const PRODUCTION_R2_BUCKET = "labflow-attachments";
const QUIESCENCE_SAFETY_MARGIN_SECONDS = 60;

const STATE_FILE = path.join(
  os.tmpdir(),
  "labflow-organization-deletion-drill.json",
);

const fail = (message) => {
  const error = new Error(message);
  error.isDrillSafetyFailure = true;
  throw error;
};

const requireValue = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    fail(`${name} is required for the organization deletion drill.`);
  }

  return value;
};

const parseTestDatabaseUrl = () => {
  const databaseUrl = requireValue("TEST_DATABASE_URL");

  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    fail("TEST_DATABASE_URL must use PostgreSQL.");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

  if (!allowedHosts.has(parsed.hostname)) {
    fail(
      `Deletion drill refused: TEST_DATABASE_URL host "${parsed.hostname}" is not local.`,
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (databaseName !== REQUIRED_DATABASE_NAME) {
    fail(
      `Deletion drill refused: database must be "${REQUIRED_DATABASE_NAME}", received "${databaseName}".`,
    );
  }

  return {
    host: parsed.hostname,
    databaseName,
  };
};

const getDrillR2Config = () => {
  const accountId = requireValue("LABFLOW_DRILL_R2_ACCOUNT_ID");
  const accessKeyId = requireValue("LABFLOW_DRILL_R2_ACCESS_KEY_ID");
  const secretAccessKey = requireValue("LABFLOW_DRILL_R2_SECRET_ACCESS_KEY");
  const bucketName = requireValue("LABFLOW_DRILL_R2_BUCKET_NAME");

  if (bucketName !== REQUIRED_R2_BUCKET) {
    fail(
      `Deletion drill refused: R2 bucket must be "${REQUIRED_R2_BUCKET}", received "${bucketName}".`,
    );
  }

  if (bucketName === PRODUCTION_R2_BUCKET) {
    fail("Deletion drill refused: production R2 bucket selected.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
};

const establishSafetyBoundary = () => {
  if (process.env.NODE_ENV !== REQUIRED_NODE_ENV) {
    fail(`Deletion drill refused: NODE_ENV must be "${REQUIRED_NODE_ENV}".`);
  }

  const database = parseTestDatabaseUrl();
  const r2 = getDrillR2Config();

  /*
   * Override the ordinary R2 variables inside this process.
   *
   * This ensures that any LabFlow module loaded below also receives the
   * dedicated drill credentials and test bucket instead of ordinary .env R2
   * configuration.
   */
  process.env.R2_ACCOUNT_ID = r2.accountId;
  process.env.R2_ACCESS_KEY_ID = r2.accessKeyId;
  process.env.R2_SECRET_ACCESS_KEY = r2.secretAccessKey;
  process.env.R2_BUCKET_NAME = r2.bucketName;
  process.env.R2_ENDPOINT = r2.endpoint;

  return {
    database,
    r2,
  };
};

const safety = establishSafetyBoundary();

/*
 * Require LabFlow modules only after the drill safety boundary and R2
 * overrides have been established.
 */
const app = require("../src/server");

const { Organization, User } = require("../src/models");

const { sequelize } = require("../src/config/database");

const attachmentConfig = require("../src/config/attachmentConfig");

const {
  createR2AttachmentStorage,
} = require("../src/storage/providers/r2AttachmentStorage");

const {
  freezeOrganizationAccess,
} = require("../src/services/organizationAccessFreezeService");

const {
  deleteOrganizationAttachmentObjects,
} = require("../src/services/organizationAttachmentDeletionService");

const {
  deleteOrganizationDatabaseData,
} = require("../src/services/organizationDeletionService");

const {
  ORGANIZATION_DELETION_STATES,
  deleteOrganizationWithReconciliation,
  getOrganizationDeletionReconciliationState,
} = require("../src/services/organizationOffboardingDeletionService");

const createStorage = () => {
  return createR2AttachmentStorage({
    config: {
      accountId: safety.r2.accountId,
      accessKeyId: safety.r2.accessKeyId,
      secretAccessKey: safety.r2.secretAccessKey,
      bucketName: safety.r2.bucketName,
      endpoint: safety.r2.endpoint,
      region: safety.r2.region,
    },
  });
};

const createDirectR2Client = () => {
  return new S3Client({
    region: safety.r2.region,
    endpoint: safety.r2.endpoint,
    credentials: {
      accessKeyId: safety.r2.accessKeyId,
      secretAccessKey: safety.r2.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
};

const loadState = () => {
  if (!fs.existsSync(STATE_FILE)) {
    fail(
      `Drill state does not exist. Run "prepare" first. Expected state file: ${STATE_FILE}`,
    );
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));

  if (
    !state ||
    state.kind !== "labflow-organization-deletion-drill" ||
    state.version !== 1
  ) {
    fail("Drill state file is invalid.");
  }

  return state;
};

const saveState = (state) => {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
};

const removeState = () => {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
};

const createOrganizationStorageKeys = (organizationId) => {
  const prefix = `organizations/${organizationId}/`;

  return [
    `${prefix}project/100/staging/${crypto.randomUUID()}/pending.csv`,
    `${prefix}project/100/attachments/${crypto.randomUUID()}/final.pdf`,
    `${prefix}project/100/orphan-drill/${crypto.randomUUID()}/orphan.bin`,
  ];
};

const putObjects = async ({ organizationId, label }) => {
  const client = createDirectR2Client();
  const storageKeys = createOrganizationStorageKeys(organizationId);

  for (const storageKey of storageKeys) {
    await client.send(
      new PutObjectCommand({
        Bucket: safety.r2.bucketName,
        Key: storageKey,
        Body: `LabFlow organization deletion drill object: ${label}`,
        ContentType: "text/plain",
      }),
    );
  }

  return storageKeys;
};

const listAllOrganizationObjects = async ({ organizationId, storage }) => {
  const prefix = `organizations/${organizationId}/`;
  const objects = [];

  let continuationToken;

  do {
    const page = await storage.listObjects({
      prefix,
      continuationToken,
      maxKeys: 1000,
    });

    objects.push(...page.objects);

    continuationToken = page.isTruncated
      ? page.nextContinuationToken
      : undefined;

    if (page.isTruncated && !continuationToken) {
      fail(
        `R2 returned truncated results without a continuation token for organization ${organizationId}.`,
      );
    }
  } while (continuationToken);

  return objects;
};

const assertDatabaseSafetyAtRuntime = () => {
  const sequelizeHost = String(sequelize.config.host || "").trim();
  const sequelizeDatabase = String(sequelize.config.database || "").trim();

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!allowedHosts.has(sequelizeHost)) {
    fail(
      `Runtime database safety check failed: Sequelize host is "${sequelizeHost}".`,
    );
  }

  if (sequelizeDatabase !== REQUIRED_DATABASE_NAME) {
    fail(
      `Runtime database safety check failed: Sequelize database is "${sequelizeDatabase}".`,
    );
  }
};

const createSyntheticOrganization = async ({ label, suffix, passwordHash }) => {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const organization = await Organization.create({
    name: `${label} ${suffix}`,
    slug: `${normalizedLabel}-${suffix}`,
    type: "demo",
    isActive: true,
  });

  const email = `${normalizedLabel}-${suffix}@example.com`;

  const user = await User.create({
    name: `${label} Admin`,
    email,
    passwordHash,
    role: "admin",
    organizationId: organization.id,
    emailVerifiedAt: new Date(),
  });

  return {
    organization,
    user,
    email,
  };
};

const verifyExistingJwtRejected = async ({ token }) => {
  const response = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);

  if (
    response.status !== 401 ||
    response.body?.code !== "SESSION_INVALIDATED"
  ) {
    fail(
      `Frozen organization JWT was not rejected as expected. HTTP ${response.status}.`,
    );
  }
};

const verifyFreshLoginRejected = async ({ email, password }) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password,
  });

  if (
    response.status !== 403 ||
    response.body?.code !== "ORGANIZATION_INACTIVE"
  ) {
    fail(
      `Frozen organization fresh login was not rejected as expected. HTTP ${response.status}.`,
    );
  }
};

const verifyNeighborAuthentication = async ({ token, email, password }) => {
  const existingSessionResponse = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);

  if (existingSessionResponse.status !== 200) {
    fail(
      `Neighbor existing JWT stopped working. HTTP ${existingSessionResponse.status}.`,
    );
  }

  const freshLoginResponse = await request(app).post("/api/auth/login").send({
    email,
    password,
  });

  if (freshLoginResponse.status !== 200) {
    fail(
      `Neighbor fresh login stopped working. HTTP ${freshLoginResponse.status}.`,
    );
  }
};

const getQuiescenceStatus = (frozenAt) => {
  const uploadUrlTtlSeconds = Number(attachmentConfig.uploadUrlTtlSeconds);

  if (!Number.isSafeInteger(uploadUrlTtlSeconds) || uploadUrlTtlSeconds <= 0) {
    fail("Attachment upload URL TTL is invalid.");
  }

  const requiredSeconds =
    uploadUrlTtlSeconds + QUIESCENCE_SAFETY_MARGIN_SECONDS;

  const frozenAtMs = new Date(frozenAt).getTime();

  if (!Number.isFinite(frozenAtMs)) {
    fail("Stored offboardingFrozenAt value is invalid.");
  }

  const elapsedSeconds = Math.floor((Date.now() - frozenAtMs) / 1000);

  return {
    uploadUrlTtlSeconds,
    safetyMarginSeconds: QUIESCENCE_SAFETY_MARGIN_SECONDS,
    requiredSeconds,
    elapsedSeconds,
    remainingSeconds: Math.max(0, requiredSeconds - elapsedSeconds),
    satisfied: elapsedSeconds >= requiredSeconds,
  };
};

const printEnvironment = () => {
  console.log("");
  console.log("SAFETY BOUNDARY");
  console.log("----------------");
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`database host: ${safety.database.host}`);
  console.log(`database name: ${safety.database.databaseName}`);
  console.log(`R2 bucket: ${safety.r2.bucketName}`);
  console.log("");
};

const prepare = async () => {
  if (fs.existsSync(STATE_FILE)) {
    fail(
      `Existing drill state found at ${STATE_FILE}. Complete or clean up the previous drill first.`,
    );
  }

  await sequelize.authenticate();
  assertDatabaseSafetyAtRuntime();

  const storage = createStorage();

  const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const password = "LabFlowDrillPassword123!";
  const passwordHash = await bcrypt.hash(password, 12);

  let targetFixture;
  let neighborFixture;

  try {
    targetFixture = await createSyntheticOrganization({
      label: "Deletion Drill Target",
      suffix,
      passwordHash,
    });

    neighborFixture = await createSyntheticOrganization({
      label: "Deletion Drill Neighbor",
      suffix,
      passwordHash,
    });

    const targetLogin = await request(app).post("/api/auth/login").send({
      email: targetFixture.email,
      password,
    });

    if (targetLogin.status !== 200) {
      fail(
        `Could not establish target pre-freeze session. HTTP ${targetLogin.status}.`,
      );
    }

    const neighborLogin = await request(app).post("/api/auth/login").send({
      email: neighborFixture.email,
      password,
    });

    if (neighborLogin.status !== 200) {
      fail(
        `Could not establish neighbor pre-freeze session. HTTP ${neighborLogin.status}.`,
      );
    }

    const targetToken = targetLogin.body.data.token;
    const neighborToken = neighborLogin.body.data.token;

    jwt.verify(targetToken, process.env.JWT_SECRET, {
      issuer: "labflow-api",
      audience: "labflow-web",
    });

    const targetStorageKeys = await putObjects({
      organizationId: targetFixture.organization.id,
      label: "target",
    });

    const neighborStorageKeys = await putObjects({
      organizationId: neighborFixture.organization.id,
      label: "neighbor",
    });

    await freezeOrganizationAccess({
      organizationId: targetFixture.organization.id,
    });

    const frozenTarget = await Organization.findByPk(
      targetFixture.organization.id,
    );

    if (
      !frozenTarget ||
      frozenTarget.isActive !== false ||
      !frozenTarget.offboardingFrozenAt
    ) {
      fail("Target organization did not enter the expected frozen state.");
    }

    await verifyExistingJwtRejected({
      token: targetToken,
    });

    await verifyFreshLoginRejected({
      email: targetFixture.email,
      password,
    });

    await verifyNeighborAuthentication({
      token: neighborToken,
      email: neighborFixture.email,
      password,
    });

    const state = {
      kind: "labflow-organization-deletion-drill",
      version: 1,
      createdAt: new Date().toISOString(),

      target: {
        organizationId: targetFixture.organization.id,
        userId: targetFixture.user.id,
        email: targetFixture.email,
        frozenAt: frozenTarget.offboardingFrozenAt.toISOString(),
        storageKeys: targetStorageKeys,
      },

      neighbor: {
        organizationId: neighborFixture.organization.id,
        userId: neighborFixture.user.id,
        email: neighborFixture.email,
        storageKeys: neighborStorageKeys,
      },
    };

    saveState(state);

    const quiescence = getQuiescenceStatus(state.target.frozenAt);

    printEnvironment();

    console.log("PREPARE PASS");
    console.log("------------");
    console.log(`target organization: ${state.target.organizationId}`);
    console.log(`neighbor organization: ${state.neighbor.organizationId}`);
    console.log(`target R2 objects: ${targetStorageKeys.length}`);
    console.log(`neighbor R2 objects: ${neighborStorageKeys.length}`);
    console.log("target old JWT rejected: yes");
    console.log("target fresh login rejected: yes");
    console.log("neighbor authentication preserved: yes");
    console.log(`offboardingFrozenAt: ${state.target.frozenAt}`);
    console.log(`quiescence required: ${quiescence.requiredSeconds} seconds`);
    console.log(`quiescence remaining: ${quiescence.remainingSeconds} seconds`);
    console.log(`state file: ${STATE_FILE}`);
    console.log("");
    console.log("Next: node scripts/organizationDeletionDrill.js status");
  } catch (error) {
    console.error("PREPARE FAILED. Synthetic data may require cleanup.");

    if (targetFixture?.organization?.id) {
      console.error(`target organization id: ${targetFixture.organization.id}`);
    }

    if (neighborFixture?.organization?.id) {
      console.error(
        `neighbor organization id: ${neighborFixture.organization.id}`,
      );
    }

    throw error;
  }
};

const status = async () => {
  await sequelize.authenticate();
  assertDatabaseSafetyAtRuntime();

  const state = loadState();
  const storage = createStorage();

  const targetOrganization = await Organization.findByPk(
    state.target.organizationId,
  );

  const neighborOrganization = await Organization.findByPk(
    state.neighbor.organizationId,
  );

  const targetObjects = await listAllOrganizationObjects({
    organizationId: state.target.organizationId,
    storage,
  });

  const neighborObjects = await listAllOrganizationObjects({
    organizationId: state.neighbor.organizationId,
    storage,
  });

  const targetReconciliation = await getOrganizationDeletionReconciliationState(
    {
      organizationId: state.target.organizationId,
      storage,
    },
  );

  const quiescence = getQuiescenceStatus(state.target.frozenAt);

  printEnvironment();

  console.log("DRILL STATUS");
  console.log("------------");
  console.log(`target organization present: ${Boolean(targetOrganization)}`);
  console.log(`target active: ${targetOrganization?.isActive ?? "absent"}`);
  console.log(`target R2 objects: ${targetObjects.length}`);
  console.log(`target reconciliation state: ${targetReconciliation.state}`);
  console.log("");
  console.log(
    `neighbor organization present: ${Boolean(neighborOrganization)}`,
  );
  console.log(`neighbor active: ${neighborOrganization?.isActive ?? "absent"}`);
  console.log(`neighbor R2 objects: ${neighborObjects.length}`);
  console.log("");
  console.log(`quiescence required: ${quiescence.requiredSeconds} seconds`);
  console.log(`quiescence elapsed: ${quiescence.elapsedSeconds} seconds`);
  console.log(`quiescence remaining: ${quiescence.remainingSeconds} seconds`);
  console.log(`quiescence satisfied: ${quiescence.satisfied}`);

  if (targetOrganization && targetOrganization.isActive !== false) {
    fail("Target organization is no longer frozen.");
  }

  if (!neighborOrganization || neighborOrganization.isActive !== true) {
    fail("Neighbor organization is no longer active.");
  }

  if (neighborObjects.length !== state.neighbor.storageKeys.length) {
    fail("Neighbor R2 inventory differs from the prepared drill state.");
  }
};

const deleteTarget = async () => {
  await sequelize.authenticate();
  assertDatabaseSafetyAtRuntime();

  const state = loadState();
  const storage = createStorage();

  const quiescence = getQuiescenceStatus(state.target.frozenAt);

  if (!quiescence.satisfied) {
    fail(
      `Deletion refused: upload quiescence has ${quiescence.remainingSeconds} second(s) remaining.`,
    );
  }

  const targetOrganizationBefore = await Organization.findByPk(
    state.target.organizationId,
  );

  if (!targetOrganizationBefore) {
    fail(
      "Deletion refused: target organization is already absent before the first drill deletion.",
    );
  }

  if (targetOrganizationBefore.isActive !== false) {
    fail("Deletion refused: target organization is not frozen.");
  }

  if (!targetOrganizationBefore.offboardingFrozenAt) {
    fail(
      "Deletion refused: target organization has no offboarding freeze timestamp.",
    );
  }

  const neighborOrganizationBefore = await Organization.findByPk(
    state.neighbor.organizationId,
  );

  if (
    !neighborOrganizationBefore ||
    neighborOrganizationBefore.isActive !== true
  ) {
    fail(
      "Deletion refused: neighboring organization is not active and present.",
    );
  }

  const neighborObjectsBefore = await listAllOrganizationObjects({
    organizationId: state.neighbor.organizationId,
    storage,
  });

  const expectedNeighborKeys = [...state.neighbor.storageKeys].sort();

  const actualNeighborKeysBefore = neighborObjectsBefore
    .map((object) => object.storageKey)
    .sort();

  if (
    JSON.stringify(actualNeighborKeysBefore) !==
    JSON.stringify(expectedNeighborKeys)
  ) {
    fail("Deletion refused: neighbor R2 inventory changed before deletion.");
  }

  const result = await deleteOrganizationWithReconciliation({
    organizationId: state.target.organizationId,
    storage,
  });

  const targetOrganizationAfter = await Organization.findByPk(
    state.target.organizationId,
  );

  const targetUsersAfter = await User.count({
    where: {
      organizationId: state.target.organizationId,
    },
  });

  const targetObjectsAfter = await listAllOrganizationObjects({
    organizationId: state.target.organizationId,
    storage,
  });

  if (targetOrganizationAfter !== null) {
    fail("Target organization still exists after deletion.");
  }

  if (targetUsersAfter !== 0) {
    fail(
      `Target organization still has ${targetUsersAfter} user(s) after deletion.`,
    );
  }

  if (targetObjectsAfter.length !== 0) {
    fail(
      `Target R2 namespace still contains ${targetObjectsAfter.length} object(s).`,
    );
  }

  const neighborOrganizationAfter = await Organization.findByPk(
    state.neighbor.organizationId,
  );

  const neighborUsersAfter = await User.count({
    where: {
      organizationId: state.neighbor.organizationId,
    },
  });

  const neighborObjectsAfter = await listAllOrganizationObjects({
    organizationId: state.neighbor.organizationId,
    storage,
  });

  const actualNeighborKeysAfter = neighborObjectsAfter
    .map((object) => object.storageKey)
    .sort();

  if (
    !neighborOrganizationAfter ||
    neighborOrganizationAfter.isActive !== true
  ) {
    fail("Neighbor organization was changed or deleted.");
  }

  if (neighborUsersAfter !== 1) {
    fail(
      `Expected 1 neighbor user after deletion, found ${neighborUsersAfter}.`,
    );
  }

  if (
    JSON.stringify(actualNeighborKeysAfter) !==
    JSON.stringify(expectedNeighborKeys)
  ) {
    fail("Neighbor R2 objects changed during target deletion.");
  }

  const finalState = await getOrganizationDeletionReconciliationState({
    organizationId: state.target.organizationId,
    storage,
  });

  if (finalState.state !== ORGANIZATION_DELETION_STATES.COMPLETE) {
    fail(
      `Target reconciliation state is "${finalState.state}" instead of COMPLETE.`,
    );
  }

  /*
   * Run the real orchestration again.
   *
   * A correct deletion workflow must be safe to retry after both database and
   * storage are already absent.
   */
  const retryResult = await deleteOrganizationWithReconciliation({
    organizationId: state.target.organizationId,
    storage,
  });

  const retryState = await getOrganizationDeletionReconciliationState({
    organizationId: state.target.organizationId,
    storage,
  });

  if (retryState.state !== ORGANIZATION_DELETION_STATES.COMPLETE) {
    fail("Idempotent retry did not remain in COMPLETE state.");
  }

  state.deletedAt = new Date().toISOString();
  state.result = {
    firstOutcome: result.outcome,
    retryOutcome: retryResult.outcome,
    targetDatabasePresent: finalState.databasePresent,
    targetStorageEmpty: finalState.storageEmpty,
    neighborPreserved: true,
  };

  saveState(state);

  printEnvironment();

  console.log("DELETION DRILL PASS");
  console.log("-------------------");
  console.log(
    `target organization ${state.target.organizationId}: PostgreSQL deleted`,
  );
  console.log(`target organization ${state.target.organizationId}: R2 empty`);
  console.log(
    `neighbor organization ${state.neighbor.organizationId}: preserved`,
  );
  console.log(`neighbor R2 objects preserved: ${neighborObjectsAfter.length}`);
  console.log(`final reconciliation state: ${finalState.state}`);
  console.log(`idempotent retry state: ${retryState.state}`);
  console.log(`state file: ${STATE_FILE}`);
  console.log("");
  console.log("Next: node scripts/organizationDeletionDrill.js cleanup");
};

const cleanup = async () => {
  await sequelize.authenticate();
  assertDatabaseSafetyAtRuntime();

  const state = loadState();
  const storage = createStorage();

  /*
   * The target should already be gone after a successful drill. Calling the
   * storage deletion service again is safe and verifies the namespace remains
   * empty.
   */
  await deleteOrganizationAttachmentObjects({
    organizationId: state.target.organizationId,
    storage,
  });

  const neighborOrganization = await Organization.findByPk(
    state.neighbor.organizationId,
  );

  if (neighborOrganization) {
    const storageDeletion = await deleteOrganizationAttachmentObjects({
      organizationId: state.neighbor.organizationId,
      storage,
    });

    if (storageDeletion.verifiedEmpty !== true) {
      fail("Neighbor cleanup could not verify the R2 namespace as empty.");
    }

    await deleteOrganizationDatabaseData({
      organizationId: state.neighbor.organizationId,
      attachmentStorageDeletionConfirmed: true,
    });
  }

  const neighborObjects = await listAllOrganizationObjects({
    organizationId: state.neighbor.organizationId,
    storage,
  });

  const neighborDatabasePresent =
    (await Organization.count({
      where: {
        id: state.neighbor.organizationId,
      },
    })) > 0;

  if (neighborObjects.length !== 0 || neighborDatabasePresent) {
    fail("Synthetic neighbor cleanup did not complete.");
  }

  removeState();

  printEnvironment();

  console.log("DRILL CLEANUP PASS");
  console.log("------------------");
  console.log("synthetic target data: absent");
  console.log("synthetic neighbor data: removed");
  console.log("temporary drill state: removed");
};

const main = async () => {
  const mode = String(process.argv[2] || "")
    .trim()
    .toLowerCase();

  if (!["prepare", "status", "delete", "cleanup"].includes(mode)) {
    console.error(
      "Usage: node scripts/organizationDeletionDrill.js <prepare|status|delete|cleanup>",
    );
    process.exitCode = 1;
    return;
  }

  try {
    if (mode === "prepare") {
      await prepare();
    } else if (mode === "status") {
      await status();
    } else if (mode === "delete") {
      await deleteTarget();
    } else {
      await cleanup();
    }
  } finally {
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error("");
  console.error("ORGANIZATION DELETION DRILL FAILED");
  console.error("----------------------------------");
  console.error(error.message);

  if (!error.isDrillSafetyFailure) {
    console.error(error.stack);
  }

  process.exitCode = 1;
});
