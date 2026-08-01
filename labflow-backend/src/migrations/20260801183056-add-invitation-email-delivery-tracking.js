"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("invitations", "email_delivery_status", {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "not_attempted",
    });

    await queryInterface.addColumn("invitations", "email_provider", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn("invitations", "email_provider_message_id", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("invitations", "email_last_attempted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("invitations", "email_sent_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addConstraint("invitations", {
      fields: ["email_delivery_status"],
      type: "check",
      name: "invitations_email_delivery_status_check",
      where: {
        email_delivery_status: ["not_attempted", "sent", "failed", "skipped"],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      "invitations",
      "invitations_email_delivery_status_check",
    );

    await queryInterface.removeColumn("invitations", "email_sent_at");

    await queryInterface.removeColumn("invitations", "email_last_attempted_at");

    await queryInterface.removeColumn(
      "invitations",
      "email_provider_message_id",
    );

    await queryInterface.removeColumn("invitations", "email_provider");

    await queryInterface.removeColumn("invitations", "email_delivery_status");
  },
};
