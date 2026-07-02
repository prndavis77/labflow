"use strict";

/** @type {import("sequelize-cli").Migration} */

const TABLES = [
  "projects",
  "tasks",
  "experiments",
  "protocols",
  "equipment",
  "equipment_bookings",
  "notebook_entries",
  "project_members",
  "review_events",
  "audit_logs",
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const [organizations] = await queryInterface.sequelize.query(
      `SELECT id FROM organizations WHERE slug = 'labflow-demo' LIMIT 1;`,
    );

    if (!organizations.length) {
      throw new Error("Default organization labflow-demo was not found.");
    }

    const defaultOrganizationId = organizations[0].id;

    for (const tableName of TABLES) {
      await queryInterface.addColumn(tableName, "organization_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });

      await queryInterface.sequelize.query(
        `UPDATE ${tableName} SET organization_id = ${defaultOrganizationId} WHERE organization_id IS NULL;`,
      );

      await queryInterface.changeColumn(tableName, "organization_id", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });

      await queryInterface.addIndex(tableName, ["organization_id"], {
        name: `${tableName}_organization_id_idx`,
      });
    }
  },

  async down(queryInterface) {
    for (const tableName of [...TABLES].reverse()) {
      await queryInterface.removeIndex(
        tableName,
        `${tableName}_organization_id_idx`,
      );
      await queryInterface.removeColumn(tableName, "organization_id");
    }
  },
};
