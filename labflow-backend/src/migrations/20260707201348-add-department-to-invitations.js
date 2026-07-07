"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("invitations", "department", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("invitations", "department");
  },
};
