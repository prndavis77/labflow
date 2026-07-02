const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../../server");
const { User, Project, Equipment, Organization } = require("../../models");

const TEST_PASSWORD = "password123";
const TEST_BCRYPT_ROUNDS = process.env.NODE_ENV === "test" ? 4 : 12;

const getOrCreateTestOrganization = async () => {
  const [organization] = await Organization.findOrCreate({
    where: { slug: "test-lab" },
    defaults: {
      name: "Test Lab",
      type: "demo",
      isActive: true,
    },
  });

  return organization;
};

const createTestUser = async ({
  name,
  email,
  role = "researcher",
  department = "Testing",
  organizationId,
  canCreateExperiments = true,
  canEditExperiments = true,
  canCreateProtocols = true,
  canEditProtocols = true,
}) => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, TEST_BCRYPT_ROUNDS);

  const organization = organizationId
    ? null
    : await getOrCreateTestOrganization();

  return User.create({
    name,
    email,
    passwordHash,
    role,
    department,
    organizationId: organizationId || organization.id,
    canCreateExperiments,
    canEditExperiments,
    canCreateProtocols,
    canEditProtocols,
  });
};

const loginAndGetToken = async (email) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: TEST_PASSWORD,
  });

  return response.body.data.token;
};

const createTestProject = async ({
  title = "Test Project",
  supervisorId,
  description = "Project created by automated test.",
  status = "active",
  startDate = "2030-01-01",
  targetEndDate = "2030-12-31",
}) => {
  return Project.create({
    title,
    description,
    status,
    startDate,
    targetEndDate,
    supervisorId,
  });
};

const createTestEquipment = async ({
  name = "Test Equipment",
  type = "HPLC",
  location = "Test Lab",
  status = "available",
  notes = "Equipment created by automated test.",
} = {}) => {
  return Equipment.create({
    name,
    type,
    location,
    status,
    notes,
  });
};

module.exports = {
  TEST_PASSWORD,
  createTestUser,
  loginAndGetToken,
  createTestProject,
  createTestEquipment,
  getOrCreateTestOrganization,
};
