jest.mock("../models", () => ({
  Attachment: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    sequelize: {
      transaction: jest.fn(),
    },
  },
  User: {},
}));

jest.mock("../utils/attachmentAccess", () => ({
  authorizeAttachmentTarget: jest.fn(),
}));

const { Attachment } = require("../models");

const sequelize = Attachment.sequelize;

const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");

const {
  getAttachmentById,
  listAttachments,
} = require("../controllers/attachmentController");

const ATTACHMENT_ID = "7dcf9559-0f93-4fb2-8193-5fda32180592";

const ORGANIZATION_ID = 10;
const USER_ID = 3;
const ENTITY_ID = 42;

const createResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);

  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const createUser = (overrides = {}) => ({
  id: USER_ID,
  organizationId: ORGANIZATION_ID,
  role: "researcher",
  isActive: true,
  ...overrides,
});

const createAttachment = (overrides = {}) => ({
  id: ATTACHMENT_ID,

  organizationId: ORGANIZATION_ID,

  uploadedById: USER_ID,

  originalFileName: "GC-MS Run 04.csv",

  fileName: "gc-ms-run-04.csv",

  fileExtension: ".csv",
  mimeType: "text/csv",
  fileSize: 1024,
  verifiedFileSize: 1024,

  storageProvider: "r2",

  storageKey:
    "organizations/10/experiment/42/" +
    `${ATTACHMENT_ID}/` +
    "gc-ms-run-04.csv",

  checksum: "hidden-checksum",
  etag: "hidden-etag",

  entityType: "experiment",
  entityId: ENTITY_ID,

  category: "raw_data",

  description: "Raw instrument export.",

  uploadStatus: "available",
  uploadExpiresAt: null,

  isArchived: false,
  archivedAt: null,
  archivedById: null,

  uploadedBy: {
    id: USER_ID,
    name: "Researcher",
    email: "researcher@example.com",
    role: "researcher",
  },

  createdAt: new Date("2026-07-24T10:00:00.000Z"),

  updatedAt: new Date("2026-07-24T10:05:00.000Z"),

  ...overrides,
});

describe("attachment read endpoints", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("listAttachments", () => {
    test("returns accessible available attachments", async () => {
      const attachment = createAttachment();

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      Attachment.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [attachment],
      });

      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
        user: req.user,

        entityType: "experiment",

        entityId: ENTITY_ID,

        action: "view",
      });

      expect(Attachment.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: ORGANIZATION_ID,

            entityType: "experiment",

            entityId: ENTITY_ID,

            uploadStatus: "available",

            isArchived: false,
          },

          limit: 20,
          offset: 0,
          distinct: true,
        }),
      );

      expect(res.status).toHaveBeenCalledWith(200);

      const responseBody = res.json.mock.calls[0][0];

      expect(responseBody.data.attachments).toHaveLength(1);

      expect(responseBody.data.pagination).toEqual({
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
      });

      expect(responseBody.data.attachments[0].storageKey).toBeUndefined();

      expect(responseBody.data.attachments[0].etag).toBeUndefined();

      expect(responseBody.data.attachments[0].checksum).toBeUndefined();
    });

    test("applies category and pagination filters", async () => {
      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      Attachment.findAndCountAll.mockResolvedValue({
        count: 45,
        rows: [],
      });

      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),

          category: "RESULT",
          page: "2",
          limit: "10",
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(Attachment.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: "result",
          }),

          limit: 10,
          offset: 10,
        }),
      );

      expect(res.json).toHaveBeenCalledWith({
        status: "success",

        data: {
          attachments: [],

          pagination: {
            page: 2,
            limit: 10,
            totalItems: 45,
            totalPages: 5,
          },
        },
      });
    });

    test("caps the page limit at 100", async () => {
      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      Attachment.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),

          limit: "500",
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(Attachment.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          offset: 0,
        }),
      );
    });

    test("returns 400 when entityType is missing", async () => {
      const req = {
        user: createUser(),

        query: {
          entityId: String(ENTITY_ID),
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(authorizeAttachmentTarget).not.toHaveBeenCalled();

      expect(Attachment.findAndCountAll).not.toHaveBeenCalled();
    });

    test("returns 400 for an invalid entityId", async () => {
      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: "abc",
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(authorizeAttachmentTarget).not.toHaveBeenCalled();
    });

    test("returns 400 for an invalid page", async () => {
      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),

          page: "0",
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 400 for an invalid limit", async () => {
      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),

          limit: "-1",
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 403 when target access is forbidden", async () => {
      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "forbidden",
      });

      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(Attachment.findAndCountAll).not.toHaveBeenCalled();
    });

    test("returns 404 when the target does not exist", async () => {
      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "not_found",
      });

      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(Attachment.findAndCountAll).not.toHaveBeenCalled();
    });

    test("returns 500 when the attachment query fails", async () => {
      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,
        target: {},
      });

      Attachment.findAndCountAll.mockRejectedValue(
        new Error("Database failure"),
      );

      const req = {
        user: createUser(),

        query: {
          entityType: "experiment",

          entityId: String(ENTITY_ID),
        },
      };

      const res = createResponse();

      await listAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getAttachmentById", () => {
    test("returns an accessible attachment", async () => {
      const attachment = createAttachment();

      Attachment.findOne.mockResolvedValue(attachment);

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: true,

        target: {
          id: ENTITY_ID,

          organizationId: ORGANIZATION_ID,
        },
      });

      const req = {
        user: createUser(),

        params: {
          id: ATTACHMENT_ID,
        },
      };

      const res = createResponse();

      await getAttachmentById(req, res);

      expect(Attachment.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: ATTACHMENT_ID,

            organizationId: ORGANIZATION_ID,

            uploadStatus: "available",

            isArchived: false,
          },
        }),
      );

      expect(authorizeAttachmentTarget).toHaveBeenCalledWith({
        user: req.user,

        entityType: "experiment",

        entityId: ENTITY_ID,

        action: "view",
      });

      expect(res.status).toHaveBeenCalledWith(200);

      const responseBody = res.json.mock.calls[0][0];

      expect(responseBody.data.attachment.id).toBe(ATTACHMENT_ID);

      expect(responseBody.data.attachment.storageKey).toBeUndefined();

      expect(responseBody.data.attachment.etag).toBeUndefined();

      expect(responseBody.data.attachment.checksum).toBeUndefined();
    });

    test("returns 400 for an invalid UUID", async () => {
      const req = {
        user: createUser(),

        params: {
          id: "invalid-id",
        },
      };

      const res = createResponse();

      await getAttachmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(Attachment.findOne).not.toHaveBeenCalled();
    });

    test("returns 404 when the attachment is unavailable", async () => {
      Attachment.findOne.mockResolvedValue(null);

      const req = {
        user: createUser(),

        params: {
          id: ATTACHMENT_ID,
        },
      };

      const res = createResponse();

      await getAttachmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(authorizeAttachmentTarget).not.toHaveBeenCalled();
    });

    test("returns 403 when attachment target access is forbidden", async () => {
      Attachment.findOne.mockResolvedValue(createAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "forbidden",
      });

      const req = {
        user: createUser(),

        params: {
          id: ATTACHMENT_ID,
        },
      };

      const res = createResponse();

      await getAttachmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("returns 404 when the linked target no longer exists", async () => {
      Attachment.findOne.mockResolvedValue(createAttachment());

      authorizeAttachmentTarget.mockResolvedValue({
        allowed: false,
        reason: "not_found",
      });

      const req = {
        user: createUser(),

        params: {
          id: ATTACHMENT_ID,
        },
      };

      const res = createResponse();

      await getAttachmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 500 when the attachment lookup fails", async () => {
      Attachment.findOne.mockRejectedValue(new Error("Database failure"));

      const req = {
        user: createUser(),

        params: {
          id: ATTACHMENT_ID,
        },
      };

      const res = createResponse();

      await getAttachmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
