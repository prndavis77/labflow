"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      /*
       * Reconcile only successfully stored attachments whose objects were
       * migrated from R2 to S3.
       *
       * Failed historical upload records remain marked as R2 because they
       * describe upload attempts that occurred while R2 was the provider and
       * do not represent live objects migrated to S3.
       */
      await queryInterface.sequelize.query(
        `
          UPDATE attachments
          SET
            "storageProvider" = 's3',
            "updatedAt" = NOW()
          WHERE
            "storageProvider" = 'r2'
            AND "uploadStatus" = 'available';
        `,
        { transaction },
      );

      /*
       * Make S3 the database-level default for any insertion path that does
       * not explicitly supply storageProvider.
       */
      await queryInterface.changeColumn(
        "attachments",
        "storageProvider",
        {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: "s3",
        },
        { transaction },
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      /*
       * Restore only the schema default.
       *
       * Do not rewrite S3 attachment metadata back to R2 automatically.
       * Reversing those rows safely would require an actual S3-to-R2 object
       * migration and cannot be inferred from the database alone.
       */
      await queryInterface.changeColumn(
        "attachments",
        "storageProvider",
        {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: "r2",
        },
        { transaction },
      );
    });
  },
};
