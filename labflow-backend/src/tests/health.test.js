const request = require("supertest");
const app = require("../server");
const { sequelize } = require("../config/database");

describe("Health check", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns API health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: "success",
      message: "Labfluss API is running",
    });
  });

  it("returns ready when PostgreSQL is available", async () => {
    jest.spyOn(sequelize, "authenticate").mockResolvedValueOnce();

    const response = await request(app).get("/api/ready");

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: "success",
      message: "Labfluss API is ready",
      checks: {
        database: "ready",
      },
    });
  });

  it("returns 503 readiness while PostgreSQL is unavailable", async () => {
    jest
      .spyOn(sequelize, "authenticate")
      .mockRejectedValueOnce(new Error("Test database unavailable"));

    const response = await request(app).get("/api/ready");

    expect(response.statusCode).toBe(503);

    expect(response.body).toMatchObject({
      status: "error",
      message: "Labfluss API is not ready",
      checks: {
        database: "unavailable",
      },
      requestId: expect.any(String),
    });
  });

  it("does not reflect unknown route URLs or query-string secrets", async () => {
    const secretValue = "super-secret-reset-token";

    const response = await request(app).get(
      `/api/definitely-not-a-real-route?token=${secretValue}`,
    );

    expect(response.statusCode).toBe(404);

    expect(response.body).toEqual({
      status: "error",
      message: "Route not found.",
      requestId: expect.any(String),
    });

    const serializedResponse = JSON.stringify(response.body);

    expect(serializedResponse).not.toContain(secretValue);
    expect(serializedResponse).not.toContain(
      "/api/definitely-not-a-real-route",
    );
    expect(serializedResponse).not.toContain("token=");
  });
});
