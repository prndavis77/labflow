jest.mock("../models", () => ({
  Equipment: {
    findOne: jest.fn(),
  },
  Experiment: {
    findOne: jest.fn(),
  },
  Project: {
    findOne: jest.fn(),
  },
  ProjectMember: {
    findOne: jest.fn(),
  },
  Protocol: {
    findOne: jest.fn(),
  },
  Task: {
    findOne: jest.fn(),
  },
}));

const {
  Equipment,
  Experiment,
  Project,
  ProjectMember,
  Protocol,
  Task,
} = require("../models");

const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");

describe("attachment target access", () => {
  const managementActions = ["upload", "update", "archive"];
  const allActions = ["view", ...managementActions];

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const admin = {
    id: 1,
    organizationId: 10,
    role: "admin",
    isActive: true,
  };

  const supervisor = {
    id: 2,
    organizationId: 10,
    role: "supervisor",
    isActive: true,
  };

  const researcher = {
    id: 3,
    organizationId: 10,
    role: "researcher",
    isActive: true,
    canEditExperiments: true,
    canEditProtocols: true,
  };
  const mockExperimentProject = ({
    experimentId = 5,
    projectId = 20,
    organizationId = 10,
    supervisorId = 2,
  } = {}) => {
    const experiment = {
      id: experimentId,
      organizationId,
      projectId,
    };

    const project = {
      id: projectId,
      organizationId,
      supervisorId,
    };

    Experiment.findOne.mockResolvedValue(experiment);
    Project.findOne.mockResolvedValue(project);

    return {
      experiment,
      project,
    };
  };

  test("rejects unauthenticated users", async () => {
    const result = await authorizeAttachmentTarget({
      user: null,
      entityType: "experiment",
      entityId: 1,
      action: "view",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "unauthenticated",
    });
  });

  test("rejects inactive users", async () => {
    const result = await authorizeAttachmentTarget({
      user: {
        ...researcher,
        isActive: false,
      },
      entityType: "experiment",
      entityId: 1,
      action: "view",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "inactive_user",
    });
  });

  test("rejects an invalid entity type", async () => {
    await expect(
      authorizeAttachmentTarget({
        user: admin,
        entityType: "user",
        entityId: 1,
        action: "view",
      }),
    ).rejects.toThrow("Invalid attachment entity type");
  });

  test("returns not found for a target outside the organization", async () => {
    Experiment.findOne.mockResolvedValue(null);

    const result = await authorizeAttachmentTarget({
      user: admin,
      entityType: "experiment",
      entityId: 99,
      action: "view",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "not_found",
    });

    expect(Experiment.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 99,
          organizationId: 10,
        },
      }),
    );
  });

  test("allows an admin to upload to an organization experiment", async () => {
    const experiment = {
      id: 5,
      organizationId: 10,
      projectId: 20,
    };

    Experiment.findOne.mockResolvedValue(experiment);

    const result = await authorizeAttachmentTarget({
      user: admin,
      entityType: "experiment",
      entityId: 5,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: true,
      target: experiment,
    });
  });

  test("allows a researcher to view an experiment in their project", async () => {
    const experiment = {
      id: 5,
      organizationId: 10,
      projectId: 20,
    };

    const project = {
      id: 20,
      organizationId: 10,
      supervisorId: 2,
    };

    Experiment.findOne.mockResolvedValue(experiment);
    Project.findOne.mockResolvedValue(project);

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "member",
    });

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "experiment",
      entityId: 5,
      action: "view",
    });

    expect(result.allowed).toBe(true);
  });

  test("allows a project member to upload when experiment editing is disabled", async () => {
    const experiment = {
      id: 5,
      organizationId: 10,
      projectId: 20,
    };

    const project = {
      id: 20,
      organizationId: 10,
      supervisorId: 2,
    };

    Experiment.findOne.mockResolvedValue(experiment);
    Project.findOne.mockResolvedValue(project);

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "member",
    });

    const result = await authorizeAttachmentTarget({
      user: {
        ...researcher,
        canEditExperiments: false,
      },
      entityType: "experiment",
      entityId: experiment.id,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: true,
      target: experiment,
    });
  });

  test("allows supervisors to upload general protocol attachments", async () => {
    const protocol = {
      id: 12,
      organizationId: 10,
      projectId: null,
    };

    Protocol.findOne.mockResolvedValue(protocol);

    const result = await authorizeAttachmentTarget({
      user: supervisor,
      entityType: "protocol",
      entityId: 12,
      action: "upload",
    });

    expect(result.allowed).toBe(true);
  });

  test("allows active organization users to view equipment files", async () => {
    const equipment = {
      id: 7,
      organizationId: 10,
    };

    Equipment.findOne.mockResolvedValue(equipment);

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "equipment",
      entityId: 7,
      action: "view",
    });

    expect(result.allowed).toBe(true);
  });

  test("prevents researchers from uploading equipment documents", async () => {
    const equipment = {
      id: 7,
      organizationId: 10,
    };

    Equipment.findOne.mockResolvedValue(equipment);

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "equipment",
      entityId: 7,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "forbidden",
    });
  });

  test("prevents project viewers from uploading attachments", async () => {
    const project = {
      id: 20,
      organizationId: 10,
      supervisorId: 2,
    };

    Project.findOne.mockResolvedValue(project);

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "viewer",
    });

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "project",
      entityId: 20,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "forbidden",
    });
  });

  test("allows project viewers to view attachments", async () => {
    const project = {
      id: 20,
      organizationId: 10,
      supervisorId: 2,
    };

    Project.findOne.mockResolvedValue(project);

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "viewer",
    });

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "project",
      entityId: 20,
      action: "view",
    });

    expect(result.allowed).toBe(true);
  });

  test("rejects an invalid attachment action", async () => {
    await expect(
      authorizeAttachmentTarget({
        user: admin,
        entityType: "experiment",
        entityId: 1,
        action: "delete",
      }),
    ).rejects.toThrow("Invalid attachment access action");
  });

  test("rejects an invalid entity ID", async () => {
    await expect(
      authorizeAttachmentTarget({
        user: admin,
        entityType: "experiment",
        entityId: 0,
        action: "view",
      }),
    ).rejects.toThrow("Entity ID must be a positive integer");
  });

  test("prevents an unassigned supervisor from viewing project files", async () => {
    const project = {
      id: 20,
      organizationId: 10,
      supervisorId: 99,
    };

    Project.findOne.mockResolvedValue(project);
    ProjectMember.findOne.mockResolvedValue(null);

    const result = await authorizeAttachmentTarget({
      user: supervisor,
      entityType: "project",
      entityId: 20,
      action: "view",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "forbidden",
    });
  });

  test("allows a project lead researcher to upload to an experiment", async () => {
    const { experiment, project } = mockExperimentProject();

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "lead",
    });

    const result = await authorizeAttachmentTarget({
      user: {
        ...researcher,
        canEditExperiments: false,
      },
      entityType: "experiment",
      entityId: experiment.id,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: true,
      target: experiment,
    });
  });

  test("allows a project member researcher to upload to an experiment", async () => {
    const { experiment, project } = mockExperimentProject();

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "member",
    });

    const result = await authorizeAttachmentTarget({
      user: {
        ...researcher,
        canEditExperiments: false,
      },
      entityType: "experiment",
      entityId: experiment.id,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: true,
      target: experiment,
    });
  });

  test("allows a project viewer to view experiment attachments", async () => {
    const { experiment, project } = mockExperimentProject();

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "viewer",
    });

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "experiment",
      entityId: experiment.id,
      action: "view",
    });

    expect(result).toEqual({
      allowed: true,
      target: experiment,
    });
  });

  test("prevents a project viewer from uploading experiment attachments", async () => {
    const { experiment, project } = mockExperimentProject();

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "viewer",
    });

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "experiment",
      entityId: experiment.id,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "forbidden",
    });
  });

  test("prevents a researcher without project membership from viewing attachments", async () => {
    const { experiment } = mockExperimentProject();

    ProjectMember.findOne.mockResolvedValue(null);

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "experiment",
      entityId: experiment.id,
      action: "view",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "forbidden",
    });
  });

  test.each(allActions)(
    "allows the assigned supervisor to %s project attachments",
    async (action) => {
      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: supervisor.id,
      };

      Project.findOne.mockResolvedValue(project);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "project",
        entityId: project.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: project,
      });
    },
  );

  test.each(allActions)(
    "prevents an unassigned supervisor from using %s on project attachments",
    async (action) => {
      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: 99,
      };

      Project.findOne.mockResolvedValue(project);
      ProjectMember.findOne.mockResolvedValue(null);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "project",
        entityId: project.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(["lead", "member"])(
    "allows a project %s to manage project attachments",
    async (projectRole) => {
      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: supervisor.id,
      };

      Project.findOne.mockResolvedValue(project);

      ProjectMember.findOne.mockResolvedValue({
        userId: researcher.id,
        projectId: project.id,
        projectRole,
      });

      for (const action of managementActions) {
        const result = await authorizeAttachmentTarget({
          user: researcher,
          entityType: "project",
          entityId: project.id,
          action,
        });

        expect(result).toEqual({
          allowed: true,
          target: project,
        });
      }
    },
  );

  test.each(["update", "archive"])(
    "prevents a project viewer from using %s on project attachments",
    async (action) => {
      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: supervisor.id,
      };

      Project.findOne.mockResolvedValue(project);

      ProjectMember.findOne.mockResolvedValue({
        userId: researcher.id,
        projectId: project.id,
        projectRole: "viewer",
      });

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "project",
        entityId: project.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(allActions)(
    "allows the assigned supervisor to %s experiment attachments",
    async (action) => {
      const { experiment } = mockExperimentProject({
        supervisorId: supervisor.id,
      });

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "experiment",
        entityId: experiment.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: experiment,
      });
    },
  );

  test.each(allActions)(
    "prevents an unassigned supervisor from using %s on experiment attachments",
    async (action) => {
      const { experiment } = mockExperimentProject({
        supervisorId: 99,
      });

      ProjectMember.findOne.mockResolvedValue(null);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "experiment",
        entityId: experiment.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(["update", "archive"])(
    "prevents a project viewer from using %s on experiment attachments",
    async (action) => {
      const { experiment, project } = mockExperimentProject();

      ProjectMember.findOne.mockResolvedValue({
        userId: researcher.id,
        projectId: project.id,
        projectRole: "viewer",
      });

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "experiment",
        entityId: experiment.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test("allows an active researcher to view general protocol attachments", async () => {
    const protocol = {
      id: 12,
      organizationId: 10,
      projectId: null,
    };

    Protocol.findOne.mockResolvedValue(protocol);

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "protocol",
      entityId: protocol.id,
      action: "view",
    });

    expect(result).toEqual({
      allowed: true,
      target: protocol,
    });
  });

  test.each(managementActions)(
    "prevents a researcher from using %s on general protocol attachments",
    async (action) => {
      const protocol = {
        id: 12,
        organizationId: 10,
        projectId: null,
      };

      Protocol.findOne.mockResolvedValue(protocol);

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "protocol",
        entityId: protocol.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(allActions)(
    "allows a supervisor to %s general protocol attachments",
    async (action) => {
      const protocol = {
        id: 12,
        organizationId: 10,
        projectId: null,
      };

      Protocol.findOne.mockResolvedValue(protocol);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "protocol",
        entityId: protocol.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: protocol,
      });
    },
  );

  test.each(managementActions)(
    "allows a contributing researcher with protocol permission to %s project protocol attachments",
    async (action) => {
      const protocol = {
        id: 12,
        organizationId: 10,
        projectId: 20,
      };

      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: supervisor.id,
      };

      Protocol.findOne.mockResolvedValue(protocol);
      Project.findOne.mockResolvedValue(project);

      ProjectMember.findOne.mockResolvedValue({
        userId: researcher.id,
        projectId: project.id,
        projectRole: "member",
      });

      const result = await authorizeAttachmentTarget({
        user: {
          ...researcher,
          canEditProtocols: true,
        },
        entityType: "protocol",
        entityId: protocol.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: protocol,
      });
    },
  );

  test.each(managementActions)(
    "prevents a contributing researcher without protocol permission from using %s on project protocol attachments",
    async (action) => {
      const protocol = {
        id: 12,
        organizationId: 10,
        projectId: 20,
      };

      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: supervisor.id,
      };

      Protocol.findOne.mockResolvedValue(protocol);
      Project.findOne.mockResolvedValue(project);

      ProjectMember.findOne.mockResolvedValue({
        userId: researcher.id,
        projectId: project.id,
        projectRole: "member",
      });

      const result = await authorizeAttachmentTarget({
        user: {
          ...researcher,
          canEditProtocols: false,
        },
        entityType: "protocol",
        entityId: protocol.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(allActions)(
    "prevents an unassigned supervisor from using %s on project protocol attachments",
    async (action) => {
      const protocol = {
        id: 12,
        organizationId: 10,
        projectId: 20,
      };

      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: 99,
      };

      Protocol.findOne.mockResolvedValue(protocol);
      Project.findOne.mockResolvedValue(project);
      ProjectMember.findOne.mockResolvedValue(null);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "protocol",
        entityId: protocol.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(managementActions)(
    "allows an admin to %s equipment attachments",
    async (action) => {
      const equipment = {
        id: 7,
        organizationId: 10,
      };

      Equipment.findOne.mockResolvedValue(equipment);

      const result = await authorizeAttachmentTarget({
        user: admin,
        entityType: "equipment",
        entityId: equipment.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: equipment,
      });
    },
  );

  test.each(managementActions)(
    "allows a supervisor to %s equipment attachments",
    async (action) => {
      const equipment = {
        id: 7,
        organizationId: 10,
      };

      Equipment.findOne.mockResolvedValue(equipment);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "equipment",
        entityId: equipment.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: equipment,
      });
    },
  );

  test.each(["update", "archive"])(
    "prevents a researcher from using %s on equipment attachments",
    async (action) => {
      const equipment = {
        id: 7,
        organizationId: 10,
      };

      Equipment.findOne.mockResolvedValue(equipment);

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "equipment",
        entityId: equipment.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(allActions)(
    "allows the creating supervisor to %s standalone task attachments",
    async (action) => {
      const task = {
        id: 30,
        organizationId: 10,
        projectId: null,
        assignedToId: researcher.id,
        createdById: supervisor.id,
      };

      Task.findOne.mockResolvedValue(task);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "task",
        entityId: task.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: task,
      });
    },
  );

  test.each(allActions)(
    "prevents another supervisor from using %s on standalone task attachments",
    async (action) => {
      const task = {
        id: 30,
        organizationId: 10,
        projectId: null,
        assignedToId: researcher.id,
        createdById: 99,
      };

      Task.findOne.mockResolvedValue(task);

      const result = await authorizeAttachmentTarget({
        user: supervisor,
        entityType: "task",
        entityId: task.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(allActions)(
    "allows the assigned researcher to %s standalone task attachments",
    async (action) => {
      const task = {
        id: 30,
        organizationId: 10,
        projectId: null,
        assignedToId: researcher.id,
        createdById: supervisor.id,
      };

      Task.findOne.mockResolvedValue(task);

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "task",
        entityId: task.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: task,
      });
    },
  );

  test.each(allActions)(
    "prevents an unassigned researcher from using %s on standalone task attachments",
    async (action) => {
      const task = {
        id: 30,
        organizationId: 10,
        projectId: null,
        assignedToId: 99,
        createdById: supervisor.id,
      };

      Task.findOne.mockResolvedValue(task);

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "task",
        entityId: task.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );

  test.each(allActions)(
    "allows the assigned researcher to %s project-linked task attachments",
    async (action) => {
      const task = {
        id: 30,
        organizationId: 10,
        projectId: 20,
        assignedToId: researcher.id,
        createdById: supervisor.id,
      };

      Task.findOne.mockResolvedValue(task);

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "task",
        entityId: task.id,
        action,
      });

      expect(result).toEqual({
        allowed: true,
        target: task,
      });
    },
  );

  test("allows a project viewer to view project-linked task attachments", async () => {
    const task = {
      id: 30,
      organizationId: 10,
      projectId: 20,
      assignedToId: 99,
      createdById: supervisor.id,
    };

    const project = {
      id: 20,
      organizationId: 10,
      supervisorId: supervisor.id,
    };

    Task.findOne.mockResolvedValue(task);
    Project.findOne.mockResolvedValue(project);

    ProjectMember.findOne.mockResolvedValue({
      userId: researcher.id,
      projectId: project.id,
      projectRole: "viewer",
    });

    const result = await authorizeAttachmentTarget({
      user: researcher,
      entityType: "task",
      entityId: task.id,
      action: "view",
    });

    expect(result).toEqual({
      allowed: true,
      target: task,
    });
  });

  test.each(managementActions)(
    "prevents a non-assigned project viewer from using %s on task attachments",
    async (action) => {
      const task = {
        id: 30,
        organizationId: 10,
        projectId: 20,
        assignedToId: 99,
        createdById: supervisor.id,
      };

      const project = {
        id: 20,
        organizationId: 10,
        supervisorId: supervisor.id,
      };

      Task.findOne.mockResolvedValue(task);
      Project.findOne.mockResolvedValue(project);

      ProjectMember.findOne.mockResolvedValue({
        userId: researcher.id,
        projectId: project.id,
        projectRole: "viewer",
      });

      const result = await authorizeAttachmentTarget({
        user: researcher,
        entityType: "task",
        entityId: task.id,
        action,
      });

      expect(result).toEqual({
        allowed: false,
        reason: "forbidden",
      });
    },
  );
});
