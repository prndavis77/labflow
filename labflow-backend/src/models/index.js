// Import all Sequelize models from one central location
// This keeps controller imports clean as the app grows
const User = require("./User");
const Project = require("./Project");
const Task = require("./Task");
const Experiment = require("./Experiment");
const Protocol = require("./Protocol");
const Equipment = require("./Equipment");
const EquipmentBooking = require("./EquipmentBooking");
const NotebookEntry = require("./NotebookEntry");
const ReviewEvent = require("./ReviewEvent");
const ProjectMember = require("./ProjectMember");
const AuditLog = require("./AuditLog");
const Organization = require("./Organization");
const Invitation = require("./Invitation");
const Attachment = require("./Attachment");

AuditLog.belongsTo(User, {
  foreignKey: "actorUserId",
  as: "actor",
});

AuditLog.belongsTo(User, {
  foreignKey: "targetUserId",
  as: "targetUser",
});

User.hasMany(AuditLog, {
  foreignKey: "actorUserId",
  as: "auditActions",
});

User.hasMany(AuditLog, {
  foreignKey: "targetUserId",
  as: "targetedAuditLogs",
});

Organization.hasMany(User, {
  foreignKey: "organizationId",
  as: "users",
});

User.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(Project, {
  foreignKey: "organizationId",
  as: "projects",
});

Project.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(Task, {
  foreignKey: "organizationId",
  as: "tasks",
});

Task.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(Experiment, {
  foreignKey: "organizationId",
  as: "experiments",
});

Experiment.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(Protocol, {
  foreignKey: "organizationId",
  as: "protocols",
});

Protocol.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(Equipment, {
  foreignKey: "organizationId",
  as: "equipment",
});

Equipment.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(EquipmentBooking, {
  foreignKey: "organizationId",
  as: "equipmentBookings",
});

EquipmentBooking.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(NotebookEntry, {
  foreignKey: "organizationId",
  as: "notebookEntries",
});

NotebookEntry.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(ProjectMember, {
  foreignKey: "organizationId",
  as: "projectMembers",
});

ProjectMember.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(ReviewEvent, {
  foreignKey: "organizationId",
  as: "reviewEvents",
});

ReviewEvent.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(AuditLog, {
  foreignKey: "organizationId",
  as: "auditLogs",
});

AuditLog.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Organization.hasMany(Invitation, {
  foreignKey: "organizationId",
  as: "invitations",
});

Invitation.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

User.hasMany(Invitation, {
  foreignKey: "invitedById",
  as: "sentInvitations",
});

Invitation.belongsTo(User, {
  foreignKey: "invitedById",
  as: "invitedBy",
});

User.hasMany(Invitation, {
  foreignKey: "acceptedUserId",
  as: "acceptedInvitations",
});

Invitation.belongsTo(User, {
  foreignKey: "acceptedUserId",
  as: "acceptedUser",
});

Organization.hasMany(Attachment, {
  foreignKey: "organizationId",
  as: "attachments",
});

User.hasMany(Attachment, {
  foreignKey: "uploadedById",
  as: "uploadedAttachments",
});

User.hasMany(Attachment, {
  foreignKey: "archivedById",
  as: "archivedAttachments",
});

Attachment.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization",
});

Attachment.belongsTo(User, {
  foreignKey: "uploadedById",
  as: "uploadedBy",
});

Attachment.belongsTo(User, {
  foreignKey: "archivedById",
  as: "archivedBy",
});

module.exports = {
  User,
  Project,
  Task,
  Experiment,
  Protocol,
  Equipment,
  EquipmentBooking,
  NotebookEntry,
  ReviewEvent,
  ProjectMember,
  AuditLog,
  Organization,
  Invitation,
  Attachment,
};
