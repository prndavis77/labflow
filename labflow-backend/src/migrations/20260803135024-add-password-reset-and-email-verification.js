"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.addColumn(
        "users",
        "emailVerifiedAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction },
      );

      await queryInterface.addColumn(
        "users",
        "tokenVersion",
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        { transaction },
      );

      /*
       * Existing users predate email verification.
       * Mark them as verified so the migration does not lock out
       * existing demo, invited, or workspace-administrator accounts.
       */
      await queryInterface.sequelize.query(
        `
          UPDATE "users"
          SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW())
        `,
        { transaction },
      );

      await queryInterface.createTable(
        "password_reset_tokens",
        {
          id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
          },

          userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "users",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },

          organizationId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "organizations",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },

          tokenHash: {
            type: Sequelize.STRING(64),
            allowNull: false,
          },

          expiresAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },

          consumedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },

          invalidatedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },

          requestIp: {
            type: Sequelize.STRING(45),
            allowNull: true,
          },

          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },

          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "email_verification_tokens",
        {
          id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
          },

          userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "users",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },

          organizationId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "organizations",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },

          tokenHash: {
            type: Sequelize.STRING(64),
            allowNull: false,
          },

          expiresAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },

          consumedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },

          invalidatedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },

          requestIp: {
            type: Sequelize.STRING(45),
            allowNull: true,
          },

          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },

          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.addIndex("password_reset_tokens", ["tokenHash"], {
        name: "password_reset_tokens_token_hash_unique",
        unique: true,
        transaction,
      });

      await queryInterface.addIndex("password_reset_tokens", ["userId"], {
        name: "password_reset_tokens_user_id",
        transaction,
      });

      await queryInterface.addIndex(
        "password_reset_tokens",
        ["organizationId"],
        {
          name: "password_reset_tokens_organization_id",
          transaction,
        },
      );

      await queryInterface.addIndex("password_reset_tokens", ["expiresAt"], {
        name: "password_reset_tokens_expires_at",
        transaction,
      });

      await queryInterface.addIndex(
        "password_reset_tokens",
        ["userId", "consumedAt", "invalidatedAt"],
        {
          name: "password_reset_tokens_user_status",
          transaction,
        },
      );

      await queryInterface.addIndex(
        "email_verification_tokens",
        ["tokenHash"],
        {
          name: "email_verification_tokens_token_hash_unique",
          unique: true,
          transaction,
        },
      );

      await queryInterface.addIndex("email_verification_tokens", ["userId"], {
        name: "email_verification_tokens_user_id",
        transaction,
      });

      await queryInterface.addIndex(
        "email_verification_tokens",
        ["organizationId"],
        {
          name: "email_verification_tokens_organization_id",
          transaction,
        },
      );

      await queryInterface.addIndex(
        "email_verification_tokens",
        ["expiresAt"],
        {
          name: "email_verification_tokens_expires_at",
          transaction,
        },
      );

      await queryInterface.addIndex(
        "email_verification_tokens",
        ["userId", "consumedAt", "invalidatedAt"],
        {
          name: "email_verification_tokens_user_status",
          transaction,
        },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.dropTable("email_verification_tokens", {
        transaction,
      });

      await queryInterface.dropTable("password_reset_tokens", { transaction });

      await queryInterface.removeColumn("users", "tokenVersion", {
        transaction,
      });

      await queryInterface.removeColumn("users", "emailVerifiedAt", {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
