"use strict";

const ATTACHMENT_ENTITY_TYPES = [
  "experiment",
  "protocol",
  "project",
  "notebook_entry",
  "equipment",
  "task",
];

const ATTACHMENT_UPLOAD_STATUSES = ["pending", "available", "failed"];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    );

    await queryInterface.createTable("attachments", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      organizationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      uploadedById: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      originalFileName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      fileName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      fileExtension: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      mimeType: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      fileSize: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      verifiedFileSize: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },

      storageProvider: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "r2",
      },

      storageKey: {
        type: Sequelize.STRING(1024),
        allowNull: false,
        unique: true,
      },

      checksum: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      etag: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      entityType: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      entityId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      category: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "other",
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      uploadStatus: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },

      uploadExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      isArchived: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      archivedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      archivedById: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addConstraint("attachments", {
      fields: ["entityType"],
      type: "check",
      name: "attachments_entity_type_check",
      where: {
        entityType: ATTACHMENT_ENTITY_TYPES,
      },
    });

    await queryInterface.addConstraint("attachments", {
      fields: ["uploadStatus"],
      type: "check",
      name: "attachments_upload_status_check",
      where: {
        uploadStatus: ATTACHMENT_UPLOAD_STATUSES,
      },
    });

    await queryInterface.addConstraint("attachments", {
      fields: ["fileSize"],
      type: "check",
      name: "attachments_file_size_positive_check",
      where: {
        fileSize: {
          [Sequelize.Op.gt]: 0,
        },
      },
    });

    await queryInterface.addConstraint("attachments", {
      fields: ["verifiedFileSize"],
      type: "check",
      name: "attachments_verified_file_size_positive_check",
      where: Sequelize.literal(
        '"verifiedFileSize" IS NULL OR "verifiedFileSize" > 0',
      ),
    });

    await queryInterface.addConstraint("attachments", {
      fields: ["archivedAt", "archivedById", "isArchived"],
      type: "check",
      name: "attachments_archive_state_check",
      where: Sequelize.literal(`
        (
          "isArchived" = false
          AND "archivedAt" IS NULL
          AND "archivedById" IS NULL
        )
        OR
        (
          "isArchived" = true
          AND "archivedAt" IS NOT NULL
          AND "archivedById" IS NOT NULL
        )
      `),
    });

    await queryInterface.addIndex("attachments", ["organizationId"], {
      name: "attachments_organization_id_index",
    });

    await queryInterface.addIndex(
      "attachments",
      ["organizationId", "entityType", "entityId"],
      {
        name: "attachments_target_lookup_index",
      },
    );

    await queryInterface.addIndex(
      "attachments",
      ["organizationId", "entityType", "entityId", "isArchived"],
      {
        name: "attachments_active_target_lookup_index",
      },
    );

    await queryInterface.addIndex(
      "attachments",
      ["organizationId", "uploadStatus"],
      {
        name: "attachments_upload_status_index",
      },
    );

    await queryInterface.addIndex(
      "attachments",
      ["organizationId", "category"],
      {
        name: "attachments_category_index",
      },
    );

    await queryInterface.addIndex("attachments", ["uploadedById"], {
      name: "attachments_uploaded_by_id_index",
    });

    await queryInterface.addIndex("attachments", ["archivedById"], {
      name: "attachments_archived_by_id_index",
    });

    await queryInterface.addIndex(
      "attachments",
      ["uploadStatus", "uploadExpiresAt"],
      {
        name: "attachments_pending_expiration_index",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("attachments");
  },
};
