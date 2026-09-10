require("dotenv").config({
  quiet: true,
});

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const { parseDatabaseSecret } = require("../config/databaseSecret");

const getRequiredEnvironmentValue = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const getBackupCredentials = () => ({
  accessKeyId: getRequiredEnvironmentValue("BACKUP_AWS_ACCESS_KEY_ID"),
  secretAccessKey: getRequiredEnvironmentValue("BACKUP_AWS_SECRET_ACCESS_KEY"),
});

const parseProductionDatabaseUrl = () => {
  const value = getRequiredEnvironmentValue("DATABASE_URL");

  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );
  }

  if (parsedUrl.password) {
    throw new Error(
      "Production DATABASE_URL must remain passwordless for backup automation.",
    );
  }

  const host = parsedUrl.hostname;
  const port = parsedUrl.port || "5432";
  const database = parsedUrl.pathname.replace(/^\/+/, "");

  if (!host || !database) {
    throw new Error("DATABASE_URL must contain a host and database name.");
  }

  return {
    host,
    port,
    database,
  };
};

const getProductionDatabaseSecret = async () => {
  const client = new SecretsManagerClient({
    region: getRequiredEnvironmentValue("DB_SECRET_REGION"),
    credentials: getBackupCredentials(),
  });

  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: getRequiredEnvironmentValue("DB_SECRET_ARN"),
      VersionStage: "AWSCURRENT",
    }),
  );

  if (!response.SecretString) {
    throw new Error("Database secret does not contain a SecretString.");
  }

  return parseDatabaseSecret(response.SecretString);
};

const runProcess = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "inherit", "inherit"],
      ...options,
    });

    child.once("error", reject);

    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited after signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });

const sha256File = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const writeTemporaryDatabaseCa = async (tempDirectory) => {
  const ca = String(process.env.DATABASE_SSL_CA || "")
    .trim()
    .replace(/\\n/g, "\n");

  if (!ca) {
    throw new Error(
      "DATABASE_SSL_CA is required for verified production database backups.",
    );
  }

  const caPath = path.join(tempDirectory, "rds-ca.pem");

  await fs.promises.writeFile(caPath, ca, {
    encoding: "utf8",
    mode: 0o600,
  });

  return caPath;
};

const formatTimestamp = (date = new Date()) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

const buildBackupKey = (timestamp, filename) => {
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);

  return `database/${year}/${month}/${day}/${filename}`;
};

const backupProductionDatabase = async () => {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Production database backup requires NODE_ENV=production.");
  }

  const backupBucket = getRequiredEnvironmentValue("BACKUP_S3_BUCKET");
  const backupRegion = getRequiredEnvironmentValue("BACKUP_S3_REGION");

  const { host, port, database } = parseProductionDatabaseUrl();
  const { username, password } = await getProductionDatabaseSecret();

  const timestamp = formatTimestamp();
  const filename = `labfluss-production-${timestamp}.dump`;

  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "labfluss-db-backup-"),
  );

  const dumpPath = path.join(tempDirectory, filename);

  try {
    const caPath = await writeTemporaryDatabaseCa(tempDirectory);

    const pgEnvironment = {
      ...process.env,
      PGPASSWORD: password,
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: caPath,
    };

    console.log("Creating PostgreSQL logical backup.");

    await runProcess(
      "pg_dump",
      [
        "--host",
        host,
        "--port",
        port,
        "--username",
        username,
        "--dbname",
        database,
        "--format=custom",
        "--file",
        dumpPath,
        "--no-password",
      ],
      {
        env: pgEnvironment,
      },
    );

    const stats = await fs.promises.stat(dumpPath);

    if (!stats.isFile() || stats.size <= 0) {
      throw new Error("pg_dump produced an empty backup file.");
    }

    console.log("Inspecting PostgreSQL backup archive.");

    await runProcess("pg_restore", ["--list", dumpPath], {
      env: process.env,
      stdio: ["ignore", "ignore", "inherit"],
    });

    const sha256 = await sha256File(dumpPath);
    const key = buildBackupKey(timestamp, filename);

    const s3 = new S3Client({
      region: backupRegion,
      credentials: getBackupCredentials(),
    });

    console.log(`Uploading database backup to s3://${backupBucket}/${key}`);

    await s3.send(
      new PutObjectCommand({
        Bucket: backupBucket,
        Key: key,
        Body: fs.createReadStream(dumpPath),
        ContentType: "application/octet-stream",
        Metadata: {
          sha256,
          backupType: "postgresql-custom",
        },
      }),
    );

    const uploadedObject = await s3.send(
      new HeadObjectCommand({
        Bucket: backupBucket,
        Key: key,
      }),
    );

    if (Number(uploadedObject.ContentLength || 0) !== stats.size) {
      throw new Error(
        "Uploaded backup size does not match the local backup size.",
      );
    }

    console.log("Production database backup completed successfully.");
    console.log(`Backup key: ${key}`);
    console.log(`Size: ${stats.size} bytes`);
    console.log(`SHA-256: ${sha256}`);
  } finally {
    await fs.promises.rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
};

if (require.main === module) {
  backupProductionDatabase().catch((error) => {
    console.error(`Production database backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  backupProductionDatabase,
  parseProductionDatabaseUrl,
  buildBackupKey,
  formatTimestamp,
};
