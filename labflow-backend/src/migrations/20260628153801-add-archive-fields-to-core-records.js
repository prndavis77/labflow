"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("projects", "is_archived", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("projects", "archived_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("projects", "archived_by_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("projects", "archive_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("tasks", "is_archived", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("tasks", "archived_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("tasks", "archived_by_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("tasks", "archive_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("experiments", "is_archived", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("experiments", "archived_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("experiments", "archived_by_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("experiments", "archive_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("protocols", "is_archived", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("protocols", "archived_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("protocols", "archived_by_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("protocols", "archive_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("protocols", "archive_reason");
    await queryInterface.removeColumn("protocols", "archived_by_id");
    await queryInterface.removeColumn("protocols", "archived_at");
    await queryInterface.removeColumn("protocols", "is_archived");

    await queryInterface.removeColumn("experiments", "archive_reason");
    await queryInterface.removeColumn("experiments", "archived_by_id");
    await queryInterface.removeColumn("experiments", "archived_at");
    await queryInterface.removeColumn("experiments", "is_archived");

    await queryInterface.removeColumn("tasks", "archive_reason");
    await queryInterface.removeColumn("tasks", "archived_by_id");
    await queryInterface.removeColumn("tasks", "archived_at");
    await queryInterface.removeColumn("tasks", "is_archived");

    await queryInterface.removeColumn("projects", "archive_reason");
    await queryInterface.removeColumn("projects", "archived_by_id");
    await queryInterface.removeColumn("projects", "archived_at");
    await queryInterface.removeColumn("projects", "is_archived");
  },
};
