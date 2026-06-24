const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../server");
const { sequelize } = require("../config/database");
const { User, Equipment, EquipmentBooking } = require("../models");

const {
  createTestUser,
  loginAndGetToken,
  createTestEquipment,
} = require("./helpers/testHelpers");

const { resetTestDatabase } = require("./helpers/dbHelpers");

describe("Equipment booking conflicts", () => {
  let adminUser;
  let equipment;
  let adminToken;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    adminUser = await createTestUser({
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
    });

    equipment = await createTestEquipment();
    adminToken = await loginAndGetToken("admin@test.com");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("rejects an overlapping confirmed booking for the same equipment", async () => {
    await EquipmentBooking.create({
      title: "Existing HPLC booking",
      startTime: new Date("2030-01-01T09:00:00.000Z"),
      endTime: new Date("2030-01-01T11:00:00.000Z"),
      status: "confirmed",
      purpose: "Existing confirmed booking.",
      equipmentId: equipment.id,
      userId: adminUser.id,
      projectId: null,
      experimentId: null,
    });

    const response = await request(app)
      .post("/api/equipment-bookings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Overlapping HPLC booking",
        startTime: "2030-01-01T10:00:00.000Z",
        endTime: "2030-01-01T12:00:00.000Z",
        status: "confirmed",
        purpose: "This should conflict.",
        equipmentId: equipment.id,
        projectId: null,
        experimentId: null,
      });

    expect([400, 409]).toContain(response.statusCode);
    expect(response.body.status).toBe("error");
    expect(response.body.message.toLowerCase()).toMatch(
      /conflict|overlap|booked|already/,
    );
  });

  it("allows a confirmed booking that starts when another booking ends", async () => {
    await EquipmentBooking.create({
      title: "Existing HPLC booking",
      startTime: new Date("2030-01-01T09:00:00.000Z"),
      endTime: new Date("2030-01-01T11:00:00.000Z"),
      status: "confirmed",
      purpose: "Existing confirmed booking.",
      equipmentId: equipment.id,
      userId: adminUser.id,
      projectId: null,
      experimentId: null,
    });

    const response = await request(app)
      .post("/api/equipment-bookings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Back-to-back HPLC booking",
        startTime: "2030-01-01T11:00:00.000Z",
        endTime: "2030-01-01T12:00:00.000Z",
        status: "confirmed",
        purpose: "This should not conflict.",
        equipmentId: equipment.id,
        projectId: null,
        experimentId: null,
      });

    expect([200, 201]).toContain(response.statusCode);
    expect(response.body.status).toBe("success");
  });

  it("allows a confirmed booking that overlaps only with a cancelled booking", async () => {
    await EquipmentBooking.create({
      title: "Cancelled HPLC booking",
      startTime: new Date("2030-01-01T09:00:00.000Z"),
      endTime: new Date("2030-01-01T11:00:00.000Z"),
      status: "cancelled",
      purpose: "Cancelled booking should not block.",
      equipmentId: equipment.id,
      userId: adminUser.id,
      projectId: null,
      experimentId: null,
    });

    const response = await request(app)
      .post("/api/equipment-bookings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Replacement HPLC booking",
        startTime: "2030-01-01T10:00:00.000Z",
        endTime: "2030-01-01T12:00:00.000Z",
        status: "confirmed",
        purpose: "This should be allowed.",
        equipmentId: equipment.id,
        projectId: null,
        experimentId: null,
      });

    expect([200, 201]).toContain(response.statusCode);
    expect(response.body.status).toBe("success");
  });
});
