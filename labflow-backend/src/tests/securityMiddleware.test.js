const request = require("supertest");

const app = require("../server");

describe("security middleware", () => {
  test("returns common Helmet security headers", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.headers).toHaveProperty(
      "x-content-type-options",
      "nosniff",
    );

    expect(response.headers).toHaveProperty("x-frame-options");

    expect(response.headers).toHaveProperty("referrer-policy");

    expect(response.headers).toHaveProperty("cross-origin-opener-policy");
  });

  test("returns the configured API rate-limit headers", async () => {
    const response = await request(app).get("/api/users/me").expect(401);

    expect(response.headers).toHaveProperty("ratelimit-limit");

    expect(response.headers).toHaveProperty("ratelimit-remaining");

    expect(response.headers).not.toHaveProperty("x-ratelimit-limit");
  });
});
