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
  requiresReview = true,
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
    requiresReview,
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
  description = "Test project description",
  status = "active",
  supervisorId,
  organizationId,
} = {}) => {
  const organization = organizationId
    ? null
    : await getOrCreateTestOrganization();

  return Project.create({
    title,
    description,
    status,
    supervisorId,
    organizationId: organizationId || organization.id,
  });
};

const createTestEquipment = async ({
  name = "Test Equipment",
  type = "HPLC",
  location = "Lab 1",
  status = "available",
  notes = "Test equipment",
  organizationId,
} = {}) => {
  const organization = organizationId
    ? null
    : await getOrCreateTestOrganization();

  return Equipment.create({
    name,
    type,
    location,
    status,
    notes,
    organizationId: organizationId || organization.id,
  });
};

const createSecondTestOrganization = async () => {
  const [organization] = await Organization.findOrCreate({
    where: { slug: "second-test-lab" },
    defaults: {
      name: "Second Test Lab",
      type: "demo",
      isActive: true,
    },
  });

  return organization;
};

module.exports = {
  TEST_PASSWORD,
  createTestUser,
  loginAndGetToken,
  createTestProject,
  createTestEquipment,
  getOrCreateTestOrganization,
  createSecondTestOrganization,
};
