const { sequelize } = require("../../config/database");

const getDatabaseNameFromUrl = (databaseUrl) => {
  if (!databaseUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    return parsedUrl.pathname.replace("/", "");
  } catch {
    return null;
  }
};

const assertSafeTestDatabase = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to reset database unless NODE_ENV is test.");
  }

  const databaseName = getDatabaseNameFromUrl(process.env.DATABASE_URL);

  if (!databaseName) {
    throw new Error(
      "Refusing to reset database because DATABASE_URL is missing or invalid.",
    );
  }

  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      `Refusing to reset database "${databaseName}" because its name does not include "test".`,
    );
  }
};

const resetTestDatabase = async () => {
  assertSafeTestDatabase();

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
  assertSafeTestDatabase,
};
