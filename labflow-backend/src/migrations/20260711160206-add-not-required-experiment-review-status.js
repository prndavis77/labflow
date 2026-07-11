"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_experiments_review_status
      ADD VALUE IF NOT EXISTS 'not_required';
    `);
  },

  async down() {
    // PostgreSQL does not safely support removing enum values.
    // Leave this as a no-op.
  },
};
