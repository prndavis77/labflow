const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_UPLOAD_STATUSES,
} = require("../constants/attachments");

const Attachment = sequelize.define(
  "Attachment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    uploadedById: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    originalFileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },

    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },

    fileExtension: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 20],
      },
    },

    mimeType: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 150],
      },
    },

    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    verifiedFileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      validate: {
        min: 1,
      },
    },

    storageProvider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "r2",
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },

    storageKey: {
      type: DataTypes.STRING(1024),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 1024],
      },
    },

    checksum: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    etag: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    entityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [ATTACHMENT_ENTITY_TYPES],
      },
    },

    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "other",
      validate: {
        isIn: [ATTACHMENT_CATEGORIES],
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    uploadStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: [ATTACHMENT_UPLOAD_STATUSES],
      },
    },

    uploadExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    archivedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "attachments",
    timestamps: true,

    indexes: [
      {
        fields: ["organizationId"],
      },
      {
        fields: ["organizationId", "entityType", "entityId", "isArchived"],
      },
      {
        fields: ["organizationId", "uploadStatus"],
      },
      {
        fields: ["organizationId", "category"],
      },
    ],

    validate: {
      archiveStateIsValid() {
        if (this.isArchived) {
          if (!this.archivedAt || !this.archivedById) {
            throw new Error(
              "Archived attachments require archivedAt and archivedById.",
            );
          }

          return;
        }

        if (this.archivedAt || this.archivedById) {
          throw new Error("Active attachments cannot have archive metadata.");
        }
      },

      availableAttachmentHasVerifiedSize() {
        if (this.uploadStatus === "available" && !this.verifiedFileSize) {
          throw new Error(
            "Available attachments require a verified file size.",
          );
        }
      },
    },
  },
);

module.exports = Attachment;
