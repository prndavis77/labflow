const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User, AuditLog } = require("../models");
const { resetTestDatabase } = require("./helpers/dbHelpers");

const createUser = async ({ name, email, role }) => {
  const passwordHash = await bcrypt.hash("password123", 4);

  return User.create({
    name,
    email,
    passwordHash,
    role,
    department: "Testing",
    canCreateExperiments: true,
    canEditExperiments: true,
    canCreateProtocols: true,
    canEditProtocols: true,
  });
};

const loginAndGetToken = async (email) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: "password123",
  });

  return response.body.data.token;
};

describe("Audit Log API", () => {
  let admin;
  let researcher;
  let adminToken;
  let researcherToken;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    admin = await createUser({
      name: "Admin User",
      email: "admin.audit@example.com",
      role: "admin",
    });

    researcher = await createUser({
      name: "Researcher User",
      email: "researcher.audit@example.com",
      role: "researcher",
    });

    await AuditLog.create({
      actorUserId: admin.id,
      action: "user.password_reset",
      entityType: "user",
      entityId: researcher.id,
      targetUserId: researcher.id,
      summary: "Admin User reset Researcher User's password.",
      metadata: {
        resetByAdmin: true,
      },
    });

    await AuditLog.create({
      actorUserId: admin.id,
      action: "experiment.approved",
      entityType: "experiment",
      entityId: 1,
      summary: 'Admin User approved experiment "Example experiment".',
      metadata: {
        previousReviewStatus: "pending",
        newReviewStatus: "approved",
      },
    });

    adminToken = await loginAndGetToken("admin.audit@example.com");
    researcherToken = await loginAndGetToken("researcher.audit@example.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("allows admins to fetch audit logs", async () => {
    const response = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.data.auditLogs).toHaveLength(2);
    expect(response.body.data.pagination.total).toBe(2);
  });

  it("blocks non-admin users from fetching audit logs", async () => {
    const response = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${researcherToken}`)
      .expect(403);

    expect(response.body.status).toBe("error");
  });

  it("filters audit logs by action", async () => {
    const response = await request(app)
      .get("/api/audit-logs?action=user.password_reset")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.data.auditLogs).toHaveLength(1);
    expect(response.body.data.auditLogs[0].action).toBe("user.password_reset");
  });

  it("filters audit logs by entity type", async () => {
    const response = await request(app)
      .get("/api/audit-logs?entityType=experiment")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.data.auditLogs).toHaveLength(1);
    expect(response.body.data.auditLogs[0].entityType).toBe("experiment");
  });

  it("returns pagination metadata", async () => {
    const response = await request(app)
      .get("/api/audit-logs?page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.data.auditLogs).toHaveLength(1);
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(1);
    expect(response.body.data.pagination.total).toBe(2);
    expect(response.body.data.pagination.totalPages).toBe(2);
  });
});
