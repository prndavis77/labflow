const yauzl = require("yauzl");

const mockExportOrganizationDatabaseData = jest.fn();
const mockExportOrganizationAttachmentBinaries = jest.fn();

jest.mock("../services/organizationDataExportService", () => ({
  exportOrganizationDatabaseData: mockExportOrganizationDatabaseData,
}));

jest.mock("../services/organizationAttachmentExportService", () => ({
  exportOrganizationAttachmentBinaries:
    mockExportOrganizationAttachmentBinaries,
}));

const {
  buildOrganizationDataExportPackage,
  createExportFileName,
} = require("../services/organizationDataExportPackageService");

const ORGANIZATION_ID = 17;

const createDatabaseExport = () => ({
  exportVersion: 1,
  exportedAt: "2026-08-25T16:00:00.000Z",
  organizationId: ORGANIZATION_ID,

  organization: {
    id: ORGANIZATION_ID,
    name: "Pilot Chemistry Lab",
    slug: "pilot-chemistry-lab",
    type: "lab",
    isActive: true,
    offboardingFrozenAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },

  recordCounts: {
    users: 1,
    projects: 1,
    projectMembers: 0,
    tasks: 0,
    experiments: 0,
    protocols: 0,
    equipment: 0,
    equipmentBookings: 0,
    notebookEntries: 0,
    reviewEvents: 0,
    invitations: 0,
    auditLogs: 0,
    attachments: 1,
  },

  data: {
    users: [
      {
        id: 1,
        name: "Admin",
        email: "admin@test.com",
        organizationId: ORGANIZATION_ID,
      },
    ],

    projects: [
      {
        id: 9,
        title: "Method Validation",
        organizationId: ORGANIZATION_ID,
      },
    ],

    projectMembers: [],
    tasks: [],
    experiments: [],
    protocols: [],
    equipment: [],
    equipmentBookings: [],
    notebookEntries: [],
    reviewEvents: [],
    invitations: [],
    auditLogs: [],

    attachments: [
      {
        id: "attachment-1",
        organizationId: ORGANIZATION_ID,
        originalFileName: "result.txt",
        mimeType: "text/plain",
        fileSize: 4,
        verifiedFileSize: 4,
        checksum: null,
        entityType: "project",
        entityId: 9,
        category: "other",
        uploadStatus: "available",
        isArchived: false,
      },
    ],
  },
});

const createAttachmentExport = ({ omission = false } = {}) => ({
  manifest: {
    manifestVersion: 1,
    organizationId: ORGANIZATION_ID,
    generatedAt: "2026-08-25T16:00:01.000Z",
    attachmentCount: 1,
    exportedCount: omission ? 0 : 1,
    notExportedCount: omission ? 1 : 0,
    totalExportedBytes: omission ? 0 : 4,

    entries: [
      {
        attachmentId: "attachment-1",
        originalFileName: "result.txt",
        exportPath: "attachments/files/attachment-1/result.txt",
        status: omission ? "not_exported" : "exported",
        reason: omission ? "STORAGE_OBJECT_UNAVAILABLE" : null,
      },
    ],
  },

  files: omission
    ? []
    : [
        {
          attachmentId: "attachment-1",
          exportPath: "attachments/files/attachment-1/result.txt",
          content: Buffer.from("test"),
        },
      ],
});

const readZipEntries = (zipBuffer) =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      zipBuffer,
      {
        lazyEntries: true,
      },
      (openError, zipFile) => {
        if (openError) {
          reject(openError);
          return;
        }

        const entries = {};

        zipFile.on("error", reject);

        zipFile.on("entry", (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipFile.readEntry();
            return;
          }

          zipFile.openReadStream(entry, (streamError, readStream) => {
            if (streamError) {
              reject(streamError);
              return;
            }

            const chunks = [];

            readStream.on("data", (chunk) => {
              chunks.push(Buffer.from(chunk));
            });

            readStream.on("error", reject);

            readStream.on("end", () => {
              entries[entry.fileName] = Buffer.concat(chunks);

              zipFile.readEntry();
            });
          });
        });

        zipFile.on("end", () => {
          resolve(entries);
        });

        zipFile.readEntry();
      },
    );
  });

describe("organizationDataExportPackageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockExportOrganizationDatabaseData.mockResolvedValue(
      createDatabaseExport(),
    );

    mockExportOrganizationAttachmentBinaries.mockResolvedValue(
      createAttachmentExport(),
    );
  });

  it("creates a portable ZIP containing datasets, manifests, and attachment binaries", async () => {
    const result = await buildOrganizationDataExportPackage({
      organizationId: ORGANIZATION_ID,
      storage: {
        provider: "test",
      },
    });

    expect(result).toMatchObject({
      mimeType: "application/zip",
      status: "complete",
    });

    expect(result.fileName).toBe(
      "labflow-export-pilot-chemistry-lab-2026-08-25T16-00-00-000Z.zip",
    );

    expect(result.size).toBeGreaterThan(0);

    expect(result.sha256).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));

    const entries = await readZipEntries(result.content);

    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "organization.json",
        "users.json",
        "projects.json",
        "project-members.json",
        "tasks.json",
        "experiments.json",
        "protocols.json",
        "equipment.json",
        "equipment-bookings.json",
        "notebook-entries.json",
        "review-events.json",
        "invitations.json",
        "audit-logs.json",
        "attachments/metadata.json",
        "attachments/manifest.json",
        "attachments/files/attachment-1/result.txt",
      ]),
    );

    expect(
      entries["attachments/files/attachment-1/result.txt"].equals(
        Buffer.from("test"),
      ),
    ).toBe(true);
  });

  it("marks the package complete when every attachment is exported", async () => {
    const result = await buildOrganizationDataExportPackage({
      organizationId: ORGANIZATION_ID,
    });

    expect(result.status).toBe("complete");
    expect(result.manifest.status).toBe("complete");

    expect(result.manifest.attachments).toEqual({
      attachmentCount: 1,
      exportedCount: 1,
      notExportedCount: 0,
      totalExportedBytes: 4,
    });
  });

  it("marks the package completed_with_attachment_omissions when an attachment cannot be exported", async () => {
    mockExportOrganizationAttachmentBinaries.mockResolvedValue(
      createAttachmentExport({
        omission: true,
      }),
    );

    const result = await buildOrganizationDataExportPackage({
      organizationId: ORGANIZATION_ID,
    });

    expect(result.status).toBe("completed_with_attachment_omissions");

    expect(result.manifest.status).toBe("completed_with_attachment_omissions");

    expect(result.manifest.attachments).toMatchObject({
      attachmentCount: 1,
      exportedCount: 0,
      notExportedCount: 1,
      totalExportedBytes: 0,
    });

    const entries = await readZipEntries(result.content);

    expect(
      entries["attachments/files/attachment-1/result.txt"],
    ).toBeUndefined();

    const attachmentManifest = JSON.parse(
      entries["attachments/manifest.json"].toString("utf8"),
    );

    expect(attachmentManifest.entries[0]).toMatchObject({
      status: "not_exported",
      reason: "STORAGE_OBJECT_UNAVAILABLE",
    });
  });

  it("passes only sanitized attachment metadata to the attachment export service", async () => {
    await buildOrganizationDataExportPackage({
      organizationId: ORGANIZATION_ID,
      storage: {
        provider: "test",
      },
    });

    expect(mockExportOrganizationAttachmentBinaries).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      attachments: createDatabaseExport().data.attachments,
      storage: {
        provider: "test",
      },
    });

    const suppliedAttachments =
      mockExportOrganizationAttachmentBinaries.mock.calls[0][0].attachments;

    expect(JSON.stringify(suppliedAttachments)).not.toContain("storageKey");
  });

  it("does not write sensitive/internal fields into the archive", async () => {
    const databaseExport = createDatabaseExport();

    databaseExport.data.users[0] = {
      id: 1,
      name: "Admin",
      email: "admin@test.com",
      organizationId: ORGANIZATION_ID,
    };

    databaseExport.data.invitations = [];

    databaseExport.data.auditLogs = [];

    mockExportOrganizationDatabaseData.mockResolvedValue(databaseExport);

    const result = await buildOrganizationDataExportPackage({
      organizationId: ORGANIZATION_ID,
    });

    const entries = await readZipEntries(result.content);

    const searchableText = Object.entries(entries)
      .filter(([path]) => path.endsWith(".json"))
      .map(([, content]) => content.toString("utf8"))
      .join("\n");

    expect(searchableText).not.toContain("passwordHash");
    expect(searchableText).not.toContain("tokenVersion");
    expect(searchableText).not.toContain("tokenHash");
    expect(searchableText).not.toContain("storageKey");
    expect(searchableText).not.toContain("emailProviderMessageId");
  });

  it("includes hashes and sizes for every payload file in manifest.json", async () => {
    const result = await buildOrganizationDataExportPackage({
      organizationId: ORGANIZATION_ID,
    });

    expect(result.manifest.files.length).toBeGreaterThan(0);

    for (const file of result.manifest.files) {
      expect(file.path).toEqual(expect.any(String));
      expect(file.size).toEqual(expect.any(Number));
      expect(file.size).toBeGreaterThanOrEqual(0);

      expect(file.sha256).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    }
  });

  it("creates a filesystem-safe export filename", () => {
    expect(
      createExportFileName({
        organization: {
          name: "Chemistry / Instrument Lab",
          slug: "Chemistry Instrument Lab",
        },
        exportedAt: "2026-08-25T16:10:25.123Z",
      }),
    ).toBe(
      "labflow-export-chemistry-instrument-lab-2026-08-25T16-10-25-123Z.zip",
    );
  });
});
