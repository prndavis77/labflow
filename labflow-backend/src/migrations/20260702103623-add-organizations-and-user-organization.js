"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("organizations", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      slug: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true,
      },

      type: {
        type: Sequelize.ENUM(
          "lab",
          "department",
          "institution",
          "company",
          "demo",
        ),
        allowNull: false,
        defaultValue: "lab",
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.bulkInsert("organizations", [
      {
        name: "LabFlow Demo Lab",
        slug: "labflow-demo",
        type: "demo",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const [organizations] = await queryInterface.sequelize.query(
      `SELECT id FROM organizations WHERE slug = 'labflow-demo' LIMIT 1;`,
    );

    const defaultOrganizationId = organizations[0].id;

    await queryInterface.addColumn("users", "organization_id", {
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
      `UPDATE users SET organization_id = ${defaultOrganizationId} WHERE organization_id IS NULL;`,
    );

    await queryInterface.changeColumn("users", "organization_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "organizations",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex("users", ["organization_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("users", ["organization_id"]);
    await queryInterface.removeColumn("users", "organization_id");

    await queryInterface.dropTable("organizations");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_organizations_type";',
    );
  },
};
