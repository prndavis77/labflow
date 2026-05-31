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
};
