jest.mock("../models", () => ({
  Equipment: {
    findOne: jest.fn(),
  },
  Experiment: {
    findOne: jest.fn(),
  },
  NotebookEntry: {
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
} = require("../models");

const { authorizeAttachmentTarget } = require("../utils/attachmentAccess");

describe("attachment target access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  test("rejects researcher upload when experiment editing is disabled", async () => {
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
      entityId: 5,
      action: "upload",
    });

    expect(result).toEqual({
      allowed: false,
      reason: "forbidden",
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
});
