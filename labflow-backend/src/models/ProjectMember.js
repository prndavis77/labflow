const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Project = require("./Project");
const User = require("./User");

// ProjectMember links users to projects
// This prepares LabFlow for project-specific access control
const ProjectMember = sequelize.define(
  "ProjectMember",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "project_id",
      references: {
        model: Project,
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

    projectRole: {
      type: DataTypes.ENUM("lead", "member", "viewer"),
      allowNull: false,
      defaultValue: "member",
      field: "project_role",
      validate: {
        isIn: {
          args: [["lead", "member", "viewer"]],
          msg: "Project role must be lead, member, or viewer.",
        },
      },
    },
  },
  {
    tableName: "project_members",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["project_id", "user_id"],
      },
    ],
  },
);

// A project membership belongs to one project
ProjectMember.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// A project membership belongs to one user
ProjectMember.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// A project can have many members
Project.hasMany(ProjectMember, {
  foreignKey: "projectId",
  as: "memberships",
});

// A user can belong to many projects
User.hasMany(ProjectMember, {
  foreignKey: "userId",
  as: "projectMemberships",
});

module.exports = ProjectMember;
