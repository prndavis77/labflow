"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("protocols", "review_status", {
      type: Sequelize.ENUM(
        "not_submitted",
        "pending",
        "approved",
        "changes_requested",
        "not_required",
      ),
      allowNull: false,
      defaultValue: "not_submitted",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("protocols", "review_status");

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_protocols_review_status";
    `);
  },
};
