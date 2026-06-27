"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      entity_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      target_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      summary: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      ip_address: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex("audit_logs", ["actor_user_id"]);
    await queryInterface.addIndex("audit_logs", ["target_user_id"]);
    await queryInterface.addIndex("audit_logs", ["action"]);
    await queryInterface.addIndex("audit_logs", ["entity_type", "entity_id"]);
    await queryInterface.addIndex("audit_logs", ["created_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");
  },
};
