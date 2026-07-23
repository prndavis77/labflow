const request = require("supertest");

const app = require("../server");
const { Organization, User } = require("../models");
const { resetTestDatabase } = require("./helpers/dbHelpers");
const { createBaseOrganizationSlug } = require("../utils/organizationSlug");

const createUniqueTestValue = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

describe("Workspace registration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await User.sequelize.close();
  });

  it("creates a new organization and its first admin", async () => {
    const suffix = createUniqueTestValue("workspace");
    const organizationName = `Analytical Chemistry ${suffix}`;
    const expectedSlug = createBaseOrganizationSlug(organizationName);

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        organizationName,
        organizationType: "lab",
        name: "John Doe",
        email: `${suffix}@university.edu`,
        department: "Analytical Chemistry",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.token).toEqual(expect.any(String));

    expect(response.body.data.user).toMatchObject({
      name: "John Doe",
      email: `${suffix}@university.edu`,
      role: "admin",
      department: "Analytical Chemistry",
      isActive: true,
      organization: {
        name: organizationName,
        slug: expectedSlug,
        type: "lab",
      },
    });

    const organization = await Organization.findOne({
      where: {
        slug: expectedSlug,
      },
    });

    expect(organization).not.toBeNull();

    const user = await User.findOne({
      where: {
        email: `${suffix}@university.edu`,
      },
    });

    expect(user).not.toBeNull();
    expect(user.role).toBe("admin");
    expect(user.organizationId).toBe(organization.id);
  });

  it("normalizes the registration email", async () => {
    const response = await request(app).post("/api/auth/register").send({
      organizationName: "Forensic Chemistry Laboratory",
      organizationType: "lab",
      name: "Jane Doe",
      email: "  JANE.DOE@UNIVERSITY.EDU  ",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe("jane.doe@university.edu");

    const user = await User.findOne({
      where: {
        email: "jane.doe@university.edu",
      },
    });

    expect(user).not.toBeNull();
  });

  it("creates a unique slug when organization names match", async () => {
    const suffix = createUniqueTestValue("duplicate-slug");
    const organizationName = `Chemistry Laboratory ${suffix}`;
    const baseSlug = createBaseOrganizationSlug(organizationName);

    const firstResponse = await request(app)
      .post("/api/auth/register")
      .send({
        organizationName,
        organizationType: "lab",
        name: "First Admin",
        email: `first-${suffix}@university.edu`,
        password: "password123",
      });

    const secondResponse = await request(app)
      .post("/api/auth/register")
      .send({
        organizationName,
        organizationType: "lab",
        name: "Second Admin",
        email: `second-${suffix}@university.edu`,
        password: "password123",
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    expect(firstResponse.body.data.user.organization.slug).toBe(baseSlug);

    expect(secondResponse.body.data.user.organization.slug).toBe(
      `${baseSlug}-2`,
    );

    const organizations = await Organization.findAll({
      where: {
        name: organizationName,
      },
      order: [["id", "ASC"]],
    });

    expect(organizations).toHaveLength(2);
    expect(organizations.map((organization) => organization.slug)).toEqual([
      baseSlug,
      `${baseSlug}-2`,
    ]);
  });

  it("ignores client-supplied role and organization fields", async () => {
    const suffix = createUniqueTestValue("security");

    const existingOrganization = await Organization.create({
      name: `Existing Organization ${suffix}`,
      slug: `existing-organization-${suffix}`,
      type: "lab",
      isActive: true,
    });

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        organizationName: `Security Test Laboratory ${suffix}`,
        organizationType: "lab",
        name: "Security Test Admin",
        email: `security-${suffix}@university.edu`,
        password: "password123",
        role: "researcher",
        organizationId: existingOrganization.id,
        isActive: false,
        requiresReview: false,
        canCreateExperiments: false,
        canEditExperiments: false,
        canCreateProtocols: false,
        canEditProtocols: false,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("admin");
    expect(response.body.data.user.isActive).toBe(true);

    expect(response.body.data.user.organizationId).not.toBe(
      existingOrganization.id,
    );
  });

  it("rejects an email that already has an account", async () => {
    const payload = {
      organizationName: "First Laboratory",
      organizationType: "lab",
      name: "First Admin",
      email: "duplicate@university.edu",
      password: "password123",
    };

    const firstResponse = await request(app)
      .post("/api/auth/register")
      .send(payload);

    const secondResponse = await request(app)
      .post("/api/auth/register")
      .send({
        ...payload,
        organizationName: "Second Laboratory",
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(409);

    expect(secondResponse.body).toMatchObject({
      status: "error",
      message: "An account with this email already exists.",
    });

    const users = await User.findAll({
      where: {
        email: "duplicate@university.edu",
      },
    });

    expect(users).toHaveLength(1);
  });

  it("requires an organization name", async () => {
    const userCountBefore = await User.count();
    const organizationCountBefore = await Organization.count();

    const response = await request(app).post("/api/auth/register").send({
      organizationType: "lab",
      name: "Missing Organization Admin",
      email: "missing.organization@university.edu",
      password: "password123",
    });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");

    expect(await User.count()).toBe(userCountBefore);
    expect(await Organization.count()).toBe(organizationCountBefore);
  });

  it("rejects a password shorter than eight characters", async () => {
    const userCountBefore = await User.count();
    const organizationCountBefore = await Organization.count();

    const response = await request(app).post("/api/auth/register").send({
      organizationName: "Password Test Laboratory",
      organizationType: "lab",
      name: "Password Test Admin",
      email: "password.test@university.edu",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: "error",
      message: "Password must be at least 8 characters long.",
    });

    expect(await User.count()).toBe(userCountBefore);
    expect(await Organization.count()).toBe(organizationCountBefore);
  });

  it("rejects an unsupported organization type", async () => {
    const userCountBefore = await User.count();
    const organizationCountBefore = await Organization.count();

    const response = await request(app).post("/api/auth/register").send({
      organizationName: "Invalid Type Laboratory",
      organizationType: "University Research Laboratory",
      name: "Invalid Type Admin",
      email: "invalid.type@university.edu",
      password: "password123",
    });

    expect(response.status).toBe(400);

    expect(response.body).toMatchObject({
      status: "error",
      message:
        "Organization type must be one of: lab, department, institution, company.",
    });

    expect(await User.count()).toBe(userCountBefore);
    expect(await Organization.count()).toBe(organizationCountBefore);
  });
});
