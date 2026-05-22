const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Equipment = require("./Equipment");
const Project = require("./Project");
const Experiment = require("./Experiment");
const User = require("./User");

// EquipmentBooking represents a reserved time slot for using shared lab equipment
// Each booking belongs to one equipment item and one user
const EquipmentBooking = sequelize.define(
  "EquipmentBooking",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Booking title is required.",
        },
        len: {
          args: [3, 200],
          msg: "Booking title must be between 3 and 200 characters.",
        },
      },
    },

    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "start_time",
    },

    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "end_time",
    },

    status: {
      type: DataTypes.ENUM("confirmed", "cancelled", "completed"),
      allowNull: false,
      defaultValue: "confirmed",
    },

    purpose: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    equipmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "equipment_id",
      references: {
        model: Equipment,
        key: "id",
      },
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: User,
        key: "id",
      },
    },

    projectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "project_id",
      references: {
        model: Project,
        key: "id",
      },
    },

    experimentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "experiment_id",
      references: {
        model: Experiment,
        key: "id",
      },
    },
  },
  {
    tableName: "equipment_bookings",
    timestamps: true,
    underscored: true,
  },
);

// A booking belongs to one equipment item.
EquipmentBooking.belongsTo(Equipment, {
  foreignKey: "equipmentId",
  as: "equipment",
});

// Equipment can have many bookings.
Equipment.hasMany(EquipmentBooking, {
  foreignKey: "equipmentId",
  as: "bookings",
});

// A booking belongs to one user.
EquipmentBooking.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// A user can have many equipment bookings.
User.hasMany(EquipmentBooking, {
  foreignKey: "userId",
  as: "equipmentBookings",
});

// A booking may be linked to one project.
EquipmentBooking.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// A project can have many equipment bookings.
Project.hasMany(EquipmentBooking, {
  foreignKey: "projectId",
  as: "equipmentBookings",
});

// A booking may be linked to one experiment.
EquipmentBooking.belongsTo(Experiment, {
  foreignKey: "experimentId",
  as: "experiment",
});

// An experiment can have many equipment bookings.
Experiment.hasMany(EquipmentBooking, {
  foreignKey: "experimentId",
  as: "equipmentBookings",
});

module.exports = EquipmentBooking;
