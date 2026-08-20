jest.mock("../config/database", () => ({
  sequelize: {
    authenticate: jest.fn(),
    sync: jest.fn(),
    close: jest.fn(),
  },
}));

jest.mock("../utils/errorLogger", () => ({
  logError: jest.fn(),
}));

jest.mock("../models", () => ({}));

const { assertDatabaseSetupAllowed } = require("../scripts/setupDatabase");

describe("database setup production safety", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test("refuses automatic schema synchronization in production", () => {
    process.env.NODE_ENV = "production";

    expect(() => assertDatabaseSetupAllowed()).toThrow(
      "Refusing to run automatic database schema sync in production.",
    );
  });

  test("allows schema setup outside production", () => {
    process.env.NODE_ENV = "development";

    expect(() => assertDatabaseSetupAllowed()).not.toThrow();
  });
});
