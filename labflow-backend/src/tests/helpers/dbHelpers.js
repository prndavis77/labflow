const { sequelize } = require("../../config/database");

const resetTestDatabase = async () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to reset database unless NODE_ENV is test.");
  }

  await sequelize.query(`
    TRUNCATE TABLE
      equipment_bookings,
      notebook_entries,
      review_events,
      project_members,
      protocols,
      experiments,
      tasks,
      equipment,
      projects,
      users
    RESTART IDENTITY CASCADE;
  `);
};

module.exports = {
  resetTestDatabase,
};
