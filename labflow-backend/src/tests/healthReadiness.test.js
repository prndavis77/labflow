const request = require("supertest");

const app = require("../server");
const { sequelize } = require("../config/database");

describe("Health and readiness endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /api/health", () => {
    test("returns 200 without checking the database", async () => {
      const authenticateSpy = jest.spyOn(sequelize, "authenticate");

      const response = await request(app).get("/api/health").expect(200);

      expect(response.body).toEqual({
        status: "success",
        message: "Labflow API is running",
      });

      expect(authenticateSpy).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/ready", () => {
    test("returns 200 when the database is reachable", async () => {
      const authenticateSpy = jest
        .spyOn(sequelize, "authenticate")
        .mockResolvedValue();

      const response = await request(app).get("/api/ready").expect(200);

      expect(authenticateSpy).toHaveBeenCalledTimes(1);

      expect(response.body).toEqual({
        status: "success",
        message: "LabFlow API is ready",
        checks: {
          database: "ready",
        },
      });
    });

    test("returns a safe 503 response when the database is unavailable", async () => {
      const databaseError = new Error(
        "connect ECONNREFUSED postgres://secret-database",
      );

      jest.spyOn(sequelize, "authenticate").mockRejectedValue(databaseError);

      const response = await request(app).get("/api/ready").expect(503);

      expect(response.body).toMatchObject({
        status: "error",
        message: "LabFlow API is not ready",
        checks: {
          database: "unavailable",
        },
      });

      expect(response.body.requestId).toEqual(expect.any(String));

      const serializedResponse = JSON.stringify(response.body);

      expect(serializedResponse).not.toContain("ECONNREFUSED");
      expect(serializedResponse).not.toContain("postgres://");
      expect(serializedResponse).not.toContain("secret-database");
    });
  });
});
