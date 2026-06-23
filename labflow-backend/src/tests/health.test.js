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
});
