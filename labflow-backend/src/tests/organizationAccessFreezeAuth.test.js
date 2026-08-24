const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../server");

const { Organization, User } = require("../models");

const {
  freezeOrganizationAccess,
} = require("../services/organizationAccessFreezeService");

const { TEST_PASSWORD, createTestUser } = require("./helpers/testHelpers");

describe("organization access freeze authentication", () => {
  let organization;
  let user;
  let token;

  let neighborOrganization;
  let neighborUser;
  let neighborToken;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    organization = await Organization.create({
      name: `Access Freeze Test Lab ${suffix}`,
      slug: `access-freeze-test-${suffix}`,
      type: "demo",
      isActive: true,
    });

    user = await createTestUser({
      name: "Freeze Test Admin",
      email: `freeze-test-${suffix}@example.com`,
      role: "admin",
      organizationId: organization.id,
      emailVerifiedAt: new Date(),
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: TEST_PASSWORD,
    });

    expect(loginResponse.status).toBe(200);

    token = loginResponse.body.data.token;

    expect(token).toBeTruthy();

    neighborOrganization = await Organization.create({
      name: `Access Freeze Neighbor Lab ${suffix}`,
      slug: `access-freeze-neighbor-${suffix}`,
      type: "demo",
      isActive: true,
    });

    neighborUser = await createTestUser({
      name: "Freeze Neighbor Admin",
      email: `freeze-neighbor-${suffix}@example.com`,
      role: "admin",
      organizationId: neighborOrganization.id,
      emailVerifiedAt: new Date(),
    });

    const neighborLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: neighborUser.email,
        password: TEST_PASSWORD,
      });

    expect(neighborLoginResponse.status).toBe(200);

    neighborToken = neighborLoginResponse.body.data.token;

    expect(neighborToken).toBeTruthy();
  });

  afterEach(async () => {
    const organizationIds = [organization?.id, neighborOrganization?.id].filter(
      Boolean,
    );

    for (const organizationId of organizationIds) {
      await User.destroy({
        where: {
          organizationId,
        },
      });

      await Organization.destroy({
        where: {
          id: organizationId,
        },
      });
    }
  });

  afterAll(async () => {
    await Organization.sequelize.close();
  });

  it("invalidates an existing JWT when the organization is frozen", async () => {
    const decodedBeforeFreeze = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "labflow-api",
      audience: "labflow-web",
    });

    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    const reloadedUser = await User.findByPk(user.id);

    expect(reloadedUser.tokenVersion).toBe(
      Number(decodedBeforeFreeze.tokenVersion || 0) + 1,
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);

    expect(response.body).toMatchObject({
      status: "error",
      code: "SESSION_INVALIDATED",
      message: "Your session is no longer valid. Please log in again.",
    });
  });

  it("rejects a fresh login after the organization is frozen", async () => {
    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      status: "error",
      code: "ORGANIZATION_INACTIVE",
      message: "This workspace is no longer active.",
    });

    expect(response.body.data?.token).toBeUndefined();
  });

  it("rejects a version-matching JWT when the organization itself is inactive", async () => {
    await Organization.update(
      {
        isActive: false,
      },
      {
        where: {
          id: organization.id,
        },
      },
    );

    /*
     * Deliberately do not increment tokenVersion here.
     *
     * This proves authMiddleware checks the organization itself instead of
     * relying exclusively on session-version invalidation.
     */
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);

    expect(response.body).toMatchObject({
      status: "error",
      code: "SESSION_INVALIDATED",
    });
  });

  it("does not allow the frozen organization to regain access with a version-matching token", async () => {
    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    const frozenUser = await User.findByPk(user.id);

    /*
     * Construct a deliberately version-matching JWT.
     *
     * This proves organization.isActive is an independent access barrier and
     * that tokenVersion invalidation is not the only protection.
     */
    const matchingToken = jwt.sign(
      {
        id: frozenUser.id,
        tokenVersion: frozenUser.tokenVersion,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
        issuer: "labflow-api",
        audience: "labflow-web",
      },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${matchingToken}`);

    expect(response.status).toBe(401);

    expect(response.body).toMatchObject({
      status: "error",
      code: "SESSION_INVALIDATED",
    });
  });

  it("freezes one organization without invalidating access for a neighboring organization", async () => {
    const neighborDecodedBeforeFreeze = jwt.verify(
      neighborToken,
      process.env.JWT_SECRET,
      {
        issuer: "labflow-api",
        audience: "labflow-web",
      },
    );

    const neighborUserBeforeFreeze = await User.findByPk(neighborUser.id);

    expect(neighborUserBeforeFreeze.tokenVersion).toBe(
      Number(neighborDecodedBeforeFreeze.tokenVersion || 0),
    );

    await freezeOrganizationAccess({
      organizationId: organization.id,
    });

    /*
     * The target organization's existing JWT must stop working.
     */
    const targetResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(targetResponse.status).toBe(401);

    expect(targetResponse.body).toMatchObject({
      status: "error",
      code: "SESSION_INVALIDATED",
    });

    /*
     * The neighboring organization's existing JWT must remain valid.
     */
    const neighborExistingSessionResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${neighborToken}`);

    expect(neighborExistingSessionResponse.status).toBe(200);

    /*
     * A fresh login for the frozen organization must still be blocked.
     */
    const frozenLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: TEST_PASSWORD,
      });

    expect(frozenLoginResponse.status).toBe(403);

    expect(frozenLoginResponse.body).toMatchObject({
      status: "error",
      code: "ORGANIZATION_INACTIVE",
    });

    /*
     * A fresh login for the neighboring organization must still succeed.
     */
    const neighborFreshLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: neighborUser.email,
        password: TEST_PASSWORD,
      });

    expect(neighborFreshLoginResponse.status).toBe(200);
    expect(neighborFreshLoginResponse.body.data.token).toBeTruthy();

    /*
     * Freezing the target organization must not change the neighbor's
     * organization state or tokenVersion.
     */
    const reloadedNeighborOrganization = await Organization.findByPk(
      neighborOrganization.id,
    );

    const reloadedNeighborUser = await User.findByPk(neighborUser.id);

    expect(reloadedNeighborOrganization.isActive).toBe(true);

    expect(reloadedNeighborUser.tokenVersion).toBe(
      neighborUserBeforeFreeze.tokenVersion,
    );
  });
});
