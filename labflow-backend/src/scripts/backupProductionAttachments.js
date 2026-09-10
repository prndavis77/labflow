require("dotenv").config({
  quiet: true,
});

const {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} = require("@aws-sdk/client-s3");

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

const encodeCopySourceKey = (key) =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const buildBackupKey = (sourceKey) => `attachments/current/${sourceKey}`;

const backupProductionAttachments = async () => {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "Production attachment backup requires NODE_ENV=production.",
    );
  }

  const sourceBucket = getRequiredEnvironmentValue("S3_BUCKET_NAME");
  const sourceRegion = getRequiredEnvironmentValue("S3_REGION");
  const backupBucket = getRequiredEnvironmentValue("BACKUP_S3_BUCKET");
  const backupRegion = getRequiredEnvironmentValue("BACKUP_S3_REGION");

  if (sourceRegion !== backupRegion) {
    throw new Error(
      "Production attachment and backup buckets must currently use the same region.",
    );
  }

  const client = new S3Client({
    region: backupRegion,
    credentials: getBackupCredentials(),
  });

  let continuationToken;
  let scannedCount = 0;
  let copiedCount = 0;
  let skippedCount = 0;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: sourceBucket,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents || []) {
      const sourceKey = String(object.Key || "").trim();

      if (!sourceKey) {
        continue;
      }

      scannedCount += 1;

      const destinationKey = buildBackupKey(sourceKey);
      const sourceSize = Number(object.Size || 0);
      const sourceEtag = String(object.ETag || "").replace(/^"|"$/g, "");

      if (!sourceEtag) {
        throw new Error(`Source ETag is missing for attachment ${sourceKey}.`);
      }

      let existingBackup = null;

      try {
        existingBackup = await client.send(
          new HeadObjectCommand({
            Bucket: backupBucket,
            Key: destinationKey,
          }),
        );
      } catch (error) {
        const statusCode = error?.$metadata?.httpStatusCode;

        if (statusCode !== 404 && error?.name !== "NotFound") {
          throw error;
        }
      }

      const existingSourceEtag = existingBackup?.Metadata?.sourceetag || null;

      const existingSourceSize = existingBackup?.Metadata?.sourcesize || null;

      if (
        existingBackup &&
        existingSourceEtag === sourceEtag &&
        Number(existingSourceSize) === sourceSize
      ) {
        skippedCount += 1;
        continue;
      }

      const encodedSourceKey = encodeCopySourceKey(sourceKey);

      await client.send(
        new CopyObjectCommand({
          Bucket: backupBucket,
          Key: destinationKey,
          CopySource: `${sourceBucket}/${encodedSourceKey}`,
          CopySourceIfMatch: sourceEtag,
          MetadataDirective: "REPLACE",
          Metadata: {
            sourcebucket: sourceBucket,
            sourceetag: sourceEtag,
            sourcesize: String(sourceSize),
            backuptype: "attachment-mirror",
          },
        }),
      );

      const copiedObject = await client.send(
        new HeadObjectCommand({
          Bucket: backupBucket,
          Key: destinationKey,
        }),
      );

      if (Number(copiedObject.ContentLength || 0) !== sourceSize) {
        throw new Error(`Backup size mismatch for attachment ${sourceKey}.`);
      }

      copiedCount += 1;
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log("Production attachment backup completed successfully.");
  console.log(`Objects scanned: ${scannedCount}`);
  console.log(`Objects copied: ${copiedCount}`);
  console.log(`Objects unchanged: ${skippedCount}`);
};

if (require.main === module) {
  backupProductionAttachments().catch((error) => {
    console.error(`Production attachment backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  backupProductionAttachments,
  buildBackupKey,
  encodeCopySourceKey,
};
