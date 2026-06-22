"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM("admin", "supervisor", "researcher"),
        allowNull: false,
        defaultValue: "researcher",
      },
      department: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      can_create_experiments: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      can_edit_experiments: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      can_create_protocols: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      can_edit_protocols: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("equipment", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "available",
          "maintenance",
          "out_of_service",
          "retired",
        ),
        allowNull: false,
        defaultValue: "available",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("projects", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "planning",
          "active",
          "on_hold",
          "completed",
          "archived",
        ),
        allowNull: false,
        defaultValue: "planning",
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      target_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      supervisor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("protocols", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      version: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "1.0",
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      approval_status: {
        type: Sequelize.ENUM(
          "draft",
          "pending_review",
          "approved",
          "changes_requested",
          "archived",
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      review_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      equipment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "equipment",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_by_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      approved_by_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      approved_at: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("tasks", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "todo",
          "in_progress",
          "blocked",
          "review",
          "completion_requested",
          "done",
        ),
        allowNull: false,
        defaultValue: "todo",
      },
      priority: {
        type: Sequelize.ENUM("low", "medium", "high", "urgent"),
        allowNull: false,
        defaultValue: "medium",
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      assigned_to_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_by_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("project_members", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      project_role: {
        type: Sequelize.ENUM("lead", "member", "viewer"),
        allowNull: false,
        defaultValue: "member",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex(
      "project_members",
      ["project_id", "user_id"],
      {
        unique: true,
        name: "project_members_project_id_user_id_unique",
      },
    );

    await queryInterface.createTable("experiments", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      objective: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "planned",
          "in_progress",
          "waiting_for_data",
          "needs_review",
          "completed",
          "failed",
          "repeated",
          "archived",
        ),
        allowNull: false,
        defaultValue: "planned",
      },
      review_status: {
        type: Sequelize.ENUM(
          "not_submitted",
          "pending",
          "approved",
          "changes_requested",
        ),
        allowNull: false,
        defaultValue: "not_submitted",
      },
      review_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      researcher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      task_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "tasks",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      protocol_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "protocols",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_by_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("equipment_bookings", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("confirmed", "cancelled", "completed"),
        allowNull: false,
        defaultValue: "confirmed",
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      equipment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "equipment",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      experiment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "experiments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("notebook_entries", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      entry_type: {
        type: Sequelize.ENUM(
          "general_note",
          "procedure",
          "observation",
          "result",
          "issue",
          "conclusion",
          "supervisor_comment",
        ),
        allowNull: false,
        defaultValue: "general_note",
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      content_format: {
        type: Sequelize.ENUM("plain_text", "rich_text"),
        allowNull: false,
        defaultValue: "plain_text",
      },
      experiment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "experiments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      author_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("review_events", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      target_type: {
        type: Sequelize.ENUM("experiment", "protocol", "task"),
        allowNull: false,
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      action: {
        type: Sequelize.ENUM("submitted", "approved", "changes_requested"),
        allowNull: false,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex(
      "review_events",
      ["target_type", "target_id"],
      {
        name: "review_events_target_type_target_id_idx",
      },
    );

    await queryInterface.addIndex("review_events", ["reviewer_id"], {
      name: "review_events_reviewer_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("review_events");
    await queryInterface.dropTable("notebook_entries");
    await queryInterface.dropTable("equipment_bookings");
    await queryInterface.dropTable("experiments");
    await queryInterface.dropTable("project_members");
    await queryInterface.dropTable("tasks");
    await queryInterface.dropTable("protocols");
    await queryInterface.dropTable("projects");
    await queryInterface.dropTable("equipment");
    await queryInterface.dropTable("users");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_review_events_action";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_review_events_target_type";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_notebook_entries_content_format";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_notebook_entries_entry_type";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_equipment_bookings_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_experiments_review_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_experiments_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_project_members_project_role";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_tasks_priority";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_tasks_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_protocols_approval_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_projects_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_equipment_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_users_role";',
    );
  },
};
