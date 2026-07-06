"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("invitations", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      role: {
        type: Sequelize.ENUM("admin", "supervisor", "researcher"),
        allowNull: false,
        defaultValue: "researcher",
      },

      token_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM("pending", "accepted", "revoked", "expired"),
        allowNull: false,
        defaultValue: "pending",
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      accepted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      invited_by_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      accepted_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      can_create_experiments: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      can_edit_experiments: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      can_create_protocols: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      can_edit_protocols: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("invitations", ["organization_id"]);
    await queryInterface.addIndex("invitations", ["email"]);
    await queryInterface.addIndex("invitations", ["status"]);
    await queryInterface.addIndex("invitations", ["token_hash"], {
      unique: true,
    });

    await queryInterface.addIndex(
      "invitations",
      ["organization_id", "email", "status"],
      {
        name: "invitations_org_email_status_idx",
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("invitations");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_invitations_role";',
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_invitations_status";',
    );
  },
};
