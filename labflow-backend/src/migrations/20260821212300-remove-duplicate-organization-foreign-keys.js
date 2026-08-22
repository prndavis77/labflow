"use strict";

const DUPLICATE_ORGANIZATION_FOREIGN_KEYS = [
  {
    tableName: "audit_logs",
    constraintName: "audit_logs_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "equipment",
    constraintName: "equipment_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "equipment_bookings",
    constraintName: "equipment_bookings_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "experiments",
    constraintName: "experiments_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "notebook_entries",
    constraintName: "notebook_entries_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "project_members",
    constraintName: "project_members_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "projects",
    constraintName: "projects_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "protocols",
    constraintName: "protocols_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "review_events",
    constraintName: "review_events_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "tasks",
    constraintName: "tasks_organization_id_fkey1",
    columnName: "organization_id",
  },
  {
    tableName: "users",
    constraintName: "users_organization_id_fkey1",
    columnName: "organization_id",
  },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const {
        tableName,
        constraintName,
      } of DUPLICATE_ORGANIZATION_FOREIGN_KEYS) {
        await queryInterface.removeConstraint(tableName, constraintName, {
          transaction,
        });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const {
        tableName,
        constraintName,
        columnName,
      } of DUPLICATE_ORGANIZATION_FOREIGN_KEYS) {
        await queryInterface.addConstraint(tableName, {
          fields: [columnName],
          type: "foreign key",
          name: constraintName,
          references: {
            table: "organizations",
            field: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
          transaction,
        });
      }
    });
  },
};
