"use strict";

require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");

const {
  buildOrganizationDataExportPackage,
} = require("../src/services/organizationDataExportPackageService");

const { sequelize } = require("../src/config/database");

class OperatorExportError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OperatorExportError";
    this.code = code;
  }
}

const parsePositiveInteger = (value, fieldName) => {
  const normalizedValue = Number(value);

  if (!Number.isSafeInteger(normalizedValue) || normalizedValue <= 0) {
    throw new OperatorExportError(
      `${fieldName} must be a positive integer.`,
      "INVALID_ARGUMENT",
    );
  }

  return normalizedValue;
};

const parseArguments = (argv) => {
  const args = argv.slice(2);

  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--organization-id") {
      parsed.organizationId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--confirm-organization-id") {
      parsed.confirmOrganizationId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--output-dir") {
      parsed.outputDir = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    throw new OperatorExportError(
      `Unknown argument: ${arg}`,
      "UNKNOWN_ARGUMENT",
    );
  }

  return parsed;
};

const printUsage = () => {
  console.log("");
  console.log("LabFlow organization customer-data export");
  console.log("");
  console.log("Usage:");
  console.log(
    "  node scripts/exportOrganizationData.js " +
      "--organization-id <id> " +
      "--confirm-organization-id <id> " +
      "--output-dir <directory>",
  );
  console.log("");
  console.log("Example:");
  console.log(
    "  node scripts/exportOrganizationData.js " +
      "--organization-id 17 " +
      "--confirm-organization-id 17 " +
      '--output-dir "F:\\LabFlow Exports"',
  );
  console.log("");
};

const validateArguments = (parsed) => {
  const organizationId = parsePositiveInteger(
    parsed.organizationId,
    "organizationId",
  );

  const confirmedOrganizationId = parsePositiveInteger(
    parsed.confirmOrganizationId,
    "confirmOrganizationId",
  );

  if (confirmedOrganizationId !== organizationId) {
    throw new OperatorExportError(
      "The confirmed organization ID does not match the requested organization ID.",
      "ORGANIZATION_CONFIRMATION_MISMATCH",
    );
  }

  const outputDir = String(parsed.outputDir || "").trim();

  if (!outputDir) {
    throw new OperatorExportError(
      "outputDir is required.",
      "OUTPUT_DIRECTORY_REQUIRED",
    );
  }

  return {
    organizationId,
    outputDir: path.resolve(outputDir),
  };
};

const writeExportPackage = async ({ outputDir, exportPackage }) => {
  await fs.mkdir(outputDir, {
    recursive: true,
    mode: 0o700,
  });

  const outputPath = path.join(outputDir, exportPackage.fileName);

  /*
   * flag: "wx" refuses to overwrite an existing file.
   *
   * mode: 0600 restricts the file to the current account on POSIX systems.
   * Windows access control is governed by the directory/file ACL instead.
   */
  await fs.writeFile(outputPath, exportPackage.content, {
    flag: "wx",
    mode: 0o600,
  });

  return outputPath;
};

const run = async () => {
  const parsed = parseArguments(process.argv);

  if (parsed.help) {
    printUsage();
    return;
  }

  const { organizationId, outputDir } = validateArguments(parsed);

  console.log("");
  console.log("LabFlow customer-data export");
  console.log("----------------------------");
  console.log(`Organization ID: ${organizationId}`);
  console.log(`Output directory: ${outputDir}`);
  console.log("");

  /*
   * Do not print database credentials, R2 credentials, storage keys,
   * customer records, raw attachment metadata, or attachment contents.
   */
  await sequelize.authenticate();

  const exportPackage = await buildOrganizationDataExportPackage({
    organizationId,
  });

  const outputPath = await writeExportPackage({
    outputDir,
    exportPackage,
  });

  console.log("EXPORT COMPLETE");
  console.log("----------------------------");
  console.log(`Status: ${exportPackage.status}`);
  console.log(`File: ${outputPath}`);
  console.log(`ZIP bytes: ${exportPackage.size}`);
  console.log(`ZIP SHA-256: ${exportPackage.sha256}`);

  console.log(
    `Database records: ${Object.values(
      exportPackage.manifest.recordCounts,
    ).reduce((total, count) => total + Number(count || 0), 0)}`,
  );

  console.log(
    `Attachments exported: ` +
      `${exportPackage.manifest.attachments.exportedCount}/` +
      `${exportPackage.manifest.attachments.attachmentCount}`,
  );

  if (exportPackage.manifest.attachments.notExportedCount > 0) {
    console.log("");
    console.log("WARNING: One or more attachment binaries were not included.");
    console.log(
      "Review attachments/manifest.json before delivering this export.",
    );
  }

  console.log("");
};

run()
  .catch((error) => {
    console.error("");
    console.error("EXPORT FAILED");
    console.error("-------------");
    console.error(`${error.code || error.name || "ERROR"}: ${error.message}`);

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch {
      // Do not hide the original export result because shutdown failed.
    }
  });
