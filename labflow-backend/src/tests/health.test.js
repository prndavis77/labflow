const request = require("supertest");
const app = require("../server");

describe("Health check", () => {
  it("returns API health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: "success",
      message: "Labflow API is running",
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
