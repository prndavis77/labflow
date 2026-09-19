const bcrypt = require("bcrypt");
require("dotenv").config();
const { sequelize } = require("../config/database");
const { logError } = require("../utils/errorLogger");
const {
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
  Organization,
  Invitation,
  AuditLog,
  Attachment,
  PasswordResetToken,
  EmailVerificationToken,
} = require("../models");
const {
  deleteOrganizationAttachmentObjects,
} = require("../services/organizationAttachmentDeletionService");

const SALT_ROUNDS = 12;

const LEGACY_DEMO_SLUG = "labflow-demo";

const DEMO_ORGANIZATIONS = {
  analyticalChemistry: {
    slug: "analytical-chemistry-demo",
    name: "Analytical Chemistry Research Lab",
    type: "demo",
  },
  molecularBiology: {
    slug: "molecular-biology-demo",
    name: "Molecular Biology Research Lab",
    type: "demo",
  },
};

// Converts a Date object into YYYY-MM-DD format for Sequelize DATEONLY fields
const toDateOnly = (date) => {
  return date.toISOString().slice(0, 10);
};

// Returns a Date object offset by a number of days from now
const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Returns a Date object offset by a number of minutes from now
const minutesFromNow = (minutes) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

// Deletes records belonging only to a known demo organization.
// User-created organizations and their records are left unchanged.
//
// In production, attachment objects are deleted and verified before their
// database metadata is removed. Object-storage deletion cannot be rolled back
// if a later database operation fails, but demo organizations are deliberately
// disposable and the seed can be rerun to reconcile the database state.
const clearDemoData = async (
  organization,
  transaction,
  { deleteAttachmentStorage = false } = {},
) => {
  if (deleteAttachmentStorage) {
    const storageDeletion = await deleteOrganizationAttachmentObjects({
      organizationId: organization.id,
    });

    if (storageDeletion.verifiedEmpty !== true) {
      throw new Error(
        `Attachment storage cleanup could not be verified for demo organization ${organization.id}.`,
      );
    }
  }

  await Attachment.destroy({
    where: {
      organizationId: organization.id,
    },
    transaction,
  });

  const organizationWhere = {
    organizationId: organization.id,
  };

  await EquipmentBooking.destroy({
    where: organizationWhere,
    transaction,
  });

  await NotebookEntry.destroy({
    where: organizationWhere,
    transaction,
  });

  await ReviewEvent.destroy({
    where: organizationWhere,
    transaction,
  });

  await AuditLog.destroy({
    where: organizationWhere,
    transaction,
  });

  await ProjectMember.destroy({
    where: organizationWhere,
    transaction,
  });

  await Invitation.destroy({
    where: organizationWhere,
    transaction,
  });

  await PasswordResetToken.destroy({
    where: organizationWhere,
    transaction,
  });

  await EmailVerificationToken.destroy({
    where: organizationWhere,
    transaction,
  });

  await Experiment.destroy({
    where: organizationWhere,
    transaction,
  });

  await Protocol.destroy({
    where: organizationWhere,
    transaction,
  });

  await Task.destroy({
    where: organizationWhere,
    transaction,
  });

  await Equipment.destroy({
    where: organizationWhere,
    transaction,
  });

  await Project.destroy({
    where: organizationWhere,
    transaction,
  });

  await User.destroy({
    where: organizationWhere,
    transaction,
  });
};

const getOrCreateDemoOrganization = async (config, transaction) => {
  const [organization] = await Organization.findOrCreate({
    where: { slug: config.slug },
    defaults: {
      name: config.name,
      type: config.type,
      isActive: true,
    },
    transaction,
  });

  if (
    organization.name !== config.name ||
    organization.type !== config.type ||
    organization.isActive !== true
  ) {
    await organization.update(
      {
        name: config.name,
        type: config.type,
        isActive: true,
      },
      { transaction },
    );
  }

  return organization;
};

// Creates demo users for testing role-based access
const createUsers = async (organization, transaction) => {
  const passwordHash = await bcrypt.hash("password1234", SALT_ROUNDS);

  const admin = await User.create(
    {
      name: "Admin User",
      email: "admin@labfluss.test",
      passwordHash,
      role: "admin",
      department: "Analytical Chemistry",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: false,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const supervisor = await User.create(
    {
      name: "Dr. Anna Keller",
      email: "anna.keller@labfluss.test",
      passwordHash,
      role: "supervisor",
      department: "Analytical Chemistry",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: false,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const researcherOne = await User.create(
    {
      name: "Maria Schmidt",
      email: "maria.schmidt@labfluss.test",
      passwordHash,
      role: "researcher",
      department: "Analytical Chemistry",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: false,
      canEditProtocols: false,
      requiresReview: true,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const researcherTwo = await User.create(
    {
      name: "Jonas Weber",
      email: "jonas.weber@labfluss.test",
      passwordHash,
      role: "researcher",
      department: "Analytical Chemistry",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: false,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const researcherThree = await User.create(
    {
      name: "Sam Dean",
      email: "sam.dean@labfluss.test",
      passwordHash,
      role: "researcher",
      department: "Analytical Chemistry",
      organizationId: organization.id,
      canCreateExperiments: false,
      canEditExperiments: false,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: true,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  return {
    admin,
    supervisor,
    researcherOne,
    researcherTwo,
    researcherThree,
  };
};

// Creates realistic university lab research projects
const createProjects = async (users, organization, transaction) => {
  const caffeineProject = await Project.create(
    {
      title: "HPLC Method Development for Caffeine Analysis",
      description:
        "Develop and validate an HPLC-UV method for quantifying caffeine in beverage samples.",
      status: "active",
      startDate: toDateOnly(daysFromNow(-14)),
      targetEndDate: toDateOnly(daysFromNow(60)),
      supervisorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const microplasticProject = await Project.create(
    {
      title: "Soil Microplastic Extraction Study",
      description:
        "Optimize sample preparation and extraction methods for microplastic analysis in soil samples.",
      status: "active",
      startDate: toDateOnly(daysFromNow(-30)),
      targetEndDate: toDateOnly(daysFromNow(90)),
      supervisorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const gcmsProject = await Project.create(
    {
      title: "GC-MS Volatile Compound Screening",
      description:
        "Screen volatile organic compounds in forensic liquid samples using GC-MS.",
      status: "planning",
      startDate: toDateOnly(daysFromNow(7)),
      targetEndDate: toDateOnly(daysFromNow(120)),
      supervisorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    caffeineProject,
    microplasticProject,
    gcmsProject,
  };
};

const createProjectMembers = async (
  users,
  projects,
  organization,
  transaction,
) => {
  await ProjectMember.bulkCreate(
    [
      {
        projectId: projects.caffeineProject.id,
        userId: users.researcherThree.id,
        projectRole: "lead",
        organizationId: organization.id,
      },
      {
        projectId: projects.caffeineProject.id,
        userId: users.researcherOne.id,
        projectRole: "member",
        organizationId: organization.id,
      },
      {
        projectId: projects.gcmsProject.id,
        userId: users.researcherTwo.id,
        projectRole: "lead",
        organizationId: organization.id,
      },
      {
        projectId: projects.gcmsProject.id,
        userId: users.researcherThree.id,
        projectRole: "member",
        organizationId: organization.id,
      },
      {
        projectId: projects.microplasticProject.id,
        userId: users.researcherOne.id,
        projectRole: "lead",
        organizationId: organization.id,
      },
      {
        projectId: projects.microplasticProject.id,
        userId: users.researcherTwo.id,
        projectRole: "member",
        organizationId: organization.id,
      },
    ],
    { transaction },
  );
};

// Creates project-linked tasks with different priorities and due dates
const createTasks = async (users, projects, organization, transaction) => {
  const taskOne = await Task.create(
    {
      title: "Prepare caffeine calibration standards",
      description:
        "Prepare 10 ppm, 25 ppm, and 50 ppm caffeine standards for the next HPLC run.",
      status: "todo",
      priority: "high",
      dueDate: toDateOnly(daysFromNow(2)),
      projectId: projects.caffeineProject.id,
      assignedToId: users.researcherOne.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskTwo = await Task.create(
    {
      title: "Review caffeine chromatograms",
      description:
        "Check peak shape, retention time stability, and calibration curve linearity.",
      status: "in_progress",
      priority: "urgent",
      dueDate: toDateOnly(daysFromNow(-1)),
      projectId: projects.caffeineProject.id,
      assignedToId: users.researcherOne.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskThree = await Task.create(
    {
      title: "Prepare soil extraction blanks",
      description:
        "Prepare procedural blanks for soil microplastic extraction comparison.",
      status: "review",
      priority: "medium",
      dueDate: toDateOnly(daysFromNow(5)),
      projectId: projects.microplasticProject.id,
      assignedToId: users.researcherOne.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskFour = await Task.create(
    {
      title: "Prepare GC-MS screening method setup",
      description:
        "Prepare method parameters, solvent blanks, and sample sequence for volatile compound screening.",
      status: "todo",
      priority: "high",
      dueDate: toDateOnly(daysFromNow(10)),
      projectId: projects.gcmsProject.id,
      assignedToId: users.researcherTwo.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskFive = await Task.create(
    {
      title: "Clean and restock freezer",
      description:
        "Check storage boxes, remove expired material, and restock labels.",
      status: "todo",
      priority: "medium",
      dueDate: null,
      projectId: null,
      assignedToId: users.researcherOne.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskSix = await Task.create(
    {
      title: "Change GC column on Agilent GC-MS",
      description:
        "Install new DB-Wax GC column and run autotune after maintenance is complete.",
      status: "todo",
      priority: "medium",
      dueDate: null,
      projectId: null,
      assignedToId: users.researcherTwo.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    taskOne,
    taskTwo,
    taskThree,
    taskFour,
  };
};

// Creates reusable lab protocols and approval states
const createProtocols = async (users, projects, organization, transaction) => {
  const caffeineProtocol = await Protocol.create(
    {
      title: "HPLC Caffeine Quantification Method",
      version: "1.0",
      purpose:
        "Quantify caffeine in beverage samples using reversed-phase HPLC with UV detection.",
      content:
        "1. Prepare caffeine standards.\n2. Filter samples through 0.45 µm filters.\n3. Set HPLC method parameters.\n4. Inject calibration standards.\n5. Inject unknown samples.\n6. Calculate concentration from calibration curve.",
      approvalStatus: "approved",
      reviewStatus: "approved",
      reviewComment: null,
      projectId: projects.caffeineProject.id,
      equipmentId: null,
      createdById: users.supervisor.id,
      approvedById: users.supervisor.id,
      approvedAt: toDateOnly(daysFromNow(-3)),
      organizationId: organization.id,
    },
    { transaction },
  );

  const microplasticProtocol = await Protocol.create(
    {
      title: "Soil Microplastic Extraction SOP",
      version: "0.9",
      purpose:
        "Extract and isolate microplastic particles from soil samples for downstream analysis.",
      content:
        "1. Dry soil samples.\n2. Sieve samples.\n3. Perform density separation.\n4. Filter supernatant.\n5. Inspect filters under microscope.\n6. Record particle count and morphology.",
      approvalStatus: "approved",
      reviewStatus: "not_required",
      reviewComment: null,
      projectId: projects.microplasticProject.id,
      equipmentId: null,
      createdById: users.researcherTwo.id,
      approvedById: null,
      approvedAt: null,
      organizationId: organization.id,
    },
    { transaction },
  );

  const gcmsProtocol = await Protocol.create(
    {
      title: "GC-MS Volatile Compound Screening Method",
      version: "1.0",
      purpose:
        "Screen volatile organic compounds in liquid samples using GC-MS full scan acquisition.",
      content:
        "1. Prepare solvent blank and quality control sample.\n2. Dilute unknown samples if necessary.\n3. Set GC oven temperature program.\n4. Configure MS scan range.\n5. Inject solvent blank before samples.\n6. Run sample sequence.\n7. Review chromatograms and compare mass spectra against library matches.",
      approvalStatus: "changes_requested",
      reviewStatus: "changes_requested",
      reviewComment:
        "Please add acceptance criteria for blank runs and specify the mass scan range before this protocol can be approved.",
      projectId: projects.gcmsProject.id,
      equipmentId: null,
      createdById: users.supervisor.id,
      approvedById: null,
      approvedAt: null,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    caffeineProtocol,
    microplasticProtocol,
    gcmsProtocol,
  };
};

// Creates laboratory experiments linked to projects, tasks, researchers, and protocols
const createExperiments = async (
  users,
  projects,
  tasks,
  protocols,
  organization,
  transaction,
) => {
  const experimentOne = await Experiment.create(
    {
      title: "Caffeine calibration curve run 1",
      objective:
        "Generate a calibration curve using 10 ppm, 25 ppm, and 50 ppm caffeine standards.",
      notes:
        "Initial run showed stable retention time. Peak shape should be reviewed before final validation.",
      status: "needs_review",
      reviewStatus: "pending",
      reviewComment: null,
      startedAt: toDateOnly(daysFromNow(-2)),
      completedAt: toDateOnly(daysFromNow(-2)),
      projectId: projects.caffeineProject.id,
      researcherId: users.researcherOne.id,
      taskId: tasks.taskOne.id,
      protocolId: protocols.caffeineProtocol.id,
      createdById: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const experimentTwo = await Experiment.create(
    {
      title: "Soil extraction blank comparison",
      objective:
        "Compare blank contamination levels across two soil extraction workflows.",
      notes:
        "Blanks prepared. Waiting for microscope inspection and particle counting.",
      status: "needs_review",
      reviewStatus: "changes_requested",
      reviewComment:
        "The blank preparation details are clearer now, but the microscope inspection criteria still need to be specified.",
      startedAt: toDateOnly(daysFromNow(-1)),
      completedAt: null,
      projectId: projects.microplasticProject.id,
      researcherId: users.researcherOne.id,
      taskId: tasks.taskThree.id,
      protocolId: protocols.microplasticProtocol.id,
      createdById: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const experimentThree = await Experiment.create(
    {
      title: "Initial GC-MS volatile compound screening run",
      objective:
        "Screen unknown liquid samples for volatile organic compounds using full scan GC-MS acquisition.",
      notes:
        "Prepare solvent blank, QC sample, and initial sample sequence before running the instrument.",
      status: "planned",
      reviewStatus: "not_required",
      reviewComment: null,
      startedAt: toDateOnly(daysFromNow(8)),
      completedAt: null,
      projectId: projects.gcmsProject.id,
      researcherId: users.researcherTwo.id,
      taskId: tasks.taskFour.id,
      protocolId: protocols.gcmsProtocol.id,
      createdById: users.researcherTwo.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    experimentOne,
    experimentTwo,
    experimentThree,
  };
};

// Creates demo notebook entries linked to experiments.
const createNotebookEntries = async (
  users,
  experiments,
  organization,
  transaction,
) => {
  const entryOne = await NotebookEntry.create(
    {
      title: "Initial HPLC setup observation",
      entryType: "observation",
      content:
        "The HPLC system was equilibrated for 20 minutes before injection. Baseline looked stable before starting the calibration sequence.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentOne.id,
      projectId: experiments.experimentOne.projectId,
      authorId: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const entryTwo = await NotebookEntry.create(
    {
      title: "Calibration curve result notes",
      entryType: "result",
      content:
        "The calibration curve showed acceptable linearity across the tested concentration range. Peak shape should still be reviewed before final validation.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentOne.id,
      projectId: experiments.experimentOne.projectId,
      authorId: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const entryThree = await NotebookEntry.create(
    {
      title: "Soil extraction blank observation",
      entryType: "observation",
      content:
        "Prepared procedural blanks for comparison. Samples are waiting for microscope inspection and particle counting.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentTwo.id,
      projectId: experiments.experimentTwo.projectId,
      authorId: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const entryFour = await NotebookEntry.create(
    {
      title: "Supervisor review follow-up",
      entryType: "supervisor_comment",
      content:
        "The blank preparation details need to be expanded before this experiment can be approved.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentTwo.id,
      projectId: experiments.experimentTwo.projectId,
      authorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    entryOne,
    entryTwo,
    entryThree,
    entryFour,
  };
};

// Creates demo review history events for experiments and protocols.
// These records demonstrate repeated review cycles and the difference between
// the latest review feedback and the full review history.
const createReviewEvents = async (
  users,
  experiments,
  protocols,
  organization,
  transaction,
) => {
  const experimentChangeRequest = await ReviewEvent.create(
    {
      targetType: "experiment",
      targetId: experiments.experimentTwo.id,
      action: "changes_requested",
      comment:
        "Please add the blank preparation details and clarify whether the same filter batch was used for both workflows.",
      reviewerId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const experimentFollowUpChangeRequest = await ReviewEvent.create(
    {
      targetType: "experiment",
      targetId: experiments.experimentTwo.id,
      action: "changes_requested",
      comment:
        "The blank preparation details are clearer now, but the microscope inspection criteria still need to be specified.",
      reviewerId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const protocolChangeRequest = await ReviewEvent.create(
    {
      targetType: "protocol",
      targetId: protocols.gcmsProtocol.id,
      action: "changes_requested",
      comment:
        "Please add acceptance criteria for blank runs and specify the mass scan range before this protocol can be approved.",
      reviewerId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const protocolApproval = await ReviewEvent.create(
    {
      targetType: "protocol",
      targetId: protocols.caffeineProtocol.id,
      action: "approved",
      comment: "Protocol approved for caffeine quantification demo workflow.",
      reviewerId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    experimentChangeRequest,
    experimentFollowUpChangeRequest,
    protocolChangeRequest,
    protocolApproval,
  };
};

// Creates shared lab equipment inventory
const createEquipment = async (organization, transaction) => {
  const hplc = await Equipment.create(
    {
      name: "HPLC Agilent 1260",
      type: "HPLC",
      location: "Analytical Lab Room 203",
      status: "available",
      notes: "Main HPLC system for UV-based quantification.",
      organizationId: organization.id,
    },
    { transaction },
  );

  const gcms = await Equipment.create(
    {
      name: "GC-MS Shimadzu QP2020",
      type: "GC-MS",
      location: "Forensic Chemistry Lab 105",
      status: "available",
      notes:
        "Used for volatile compound screening and forensic sample analysis.",
      organizationId: organization.id,
    },
    { transaction },
  );

  const gcms_2 = await Equipment.create(
    {
      name: "Agilent 5977C GC/MS",
      type: "GC-MS",
      location: "Analytical Lab Room 203",
      status: "maintenance",
      notes:
        "Used for volatile compound screening and forensic sample analysis. Currently under maintenance for detector replacement.",
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    hplc,
    gcms,
    gcms_2,
  };
};

// Creates equipment-specific SOPs after equipment exists.
const createEquipmentProtocols = async (
  users,
  equipment,
  organization,
  transaction,
) => {
  const hplcSop = await Protocol.create(
    {
      title: "HPLC Agilent 1260 Startup and Shutdown SOP",
      version: "1.0",
      purpose:
        "Standard procedure for safely starting, preparing, and shutting down the HPLC Agilent 1260 system.",
      content:
        "1. Check solvent levels.\n2. Inspect waste container.\n3. Power on the HPLC modules.\n4. Prime solvent lines.\n5. Equilibrate the column.\n6. Run system suitability check.\n7. Flush the system after use.\n8. Shut down modules according to lab procedure.",
      approvalStatus: "approved",
      reviewStatus: "approved",
      reviewComment: null,
      projectId: null,
      equipmentId: equipment.hplc.id,
      createdById: users.supervisor.id,
      approvedById: users.supervisor.id,
      approvedAt: toDateOnly(daysFromNow(-5)),
      organizationId: organization.id,
    },
    { transaction },
  );

  const gcmsSop = await Protocol.create(
    {
      title: "GC-MS Shimadzu QP2020 Tuning SOP",
      version: "1.0",
      purpose:
        "Standard procedure for checking tuning status before GC-MS screening runs.",
      content:
        "1. Confirm carrier gas supply.\n2. Check vacuum status.\n3. Load tuning method.\n4. Run autotune check.\n5. Review ion ratios and sensitivity.\n6. Save tuning report.\n7. Notify supervisor if tuning fails.",
      approvalStatus: "pending_review",
      reviewStatus: "pending",
      reviewComment: null,
      projectId: null,
      equipmentId: equipment.gcms.id,
      createdById: users.supervisor.id,
      approvedById: null,
      approvedAt: null,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    hplcSop,
    gcmsSop,
  };
};

// Creates equipment bookings, including one active booking for dashboard testing
const createEquipmentBookings = async (
  users,
  projects,
  experiments,
  equipment,
  organization,
  transaction,
) => {
  const activeBooking = await EquipmentBooking.create(
    {
      title: "Active HPLC caffeine run",
      startTime: minutesFromNow(-30),
      endTime: minutesFromNow(90),
      status: "confirmed",
      purpose:
        "Run caffeine calibration standards for HPLC method development.",
      equipmentId: equipment.hplc.id,
      userId: users.researcherOne.id,
      projectId: projects.caffeineProject.id,
      experimentId: experiments.experimentOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const futureBooking = await EquipmentBooking.create(
    {
      title: "GC-MS volatile screening",
      startTime: daysFromNow(2),
      endTime: new Date(daysFromNow(2).getTime() + 2 * 60 * 60 * 1000),
      status: "confirmed",
      purpose: "Screen forensic liquid samples for volatile organic compounds.",
      equipmentId: equipment.gcms.id,
      userId: users.researcherTwo.id,
      projectId: projects.gcmsProject.id,
      experimentId: null,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    activeBooking,
    futureBooking,
  };
};

const createMolecularBiologyUsers = async (organization, transaction) => {
  const passwordHash = await bcrypt.hash("password1234", SALT_ROUNDS);

  const admin = await User.create(
    {
      name: "Admin User",
      email: "admin.molecular@labfluss.test",
      passwordHash,
      role: "admin",
      department: "Molecular Biology",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: false,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const supervisor = await User.create(
    {
      name: "Dr. Elena Fischer",
      email: "elena.fischer@labfluss.test",
      passwordHash,
      role: "supervisor",
      department: "Molecular Biology",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: false,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const researcherOne = await User.create(
    {
      name: "Daniel Kim",
      email: "daniel.kim@labfluss.test",
      passwordHash,
      role: "researcher",
      department: "Molecular Biology",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: false,
      canEditProtocols: false,
      requiresReview: true,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const researcherTwo = await User.create(
    {
      name: "Sophie Müller",
      email: "sophie.mueller@labfluss.test",
      passwordHash,
      role: "researcher",
      department: "Molecular Biology",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: false,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  const researcherThree = await User.create(
    {
      name: "Lucas Martin",
      email: "lucas.martin@labfluss.test",
      passwordHash,
      role: "researcher",
      department: "Molecular Biology",
      organizationId: organization.id,
      canCreateExperiments: true,
      canEditExperiments: true,
      canCreateProtocols: true,
      canEditProtocols: true,
      requiresReview: true,
      emailVerifiedAt: new Date(),
    },
    { transaction },
  );

  return {
    admin,
    supervisor,
    researcherOne,
    researcherTwo,
    researcherThree,
  };
};

const createMolecularBiologyProjects = async (
  users,
  organization,
  transaction,
) => {
  const qpcrProject = await Project.create(
    {
      title: "qPCR Gene Expression Validation",
      description:
        "Validate relative gene-expression changes across treated and control cell samples using quantitative PCR.",
      status: "active",
      startDate: toDateOnly(daysFromNow(-21)),
      targetEndDate: toDateOnly(daysFromNow(45)),
      supervisorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const proteinProject = await Project.create(
    {
      title: "Recombinant Protein Expression Study",
      description:
        "Optimize bacterial expression conditions for a recombinant target protein and evaluate soluble protein yield.",
      status: "active",
      startDate: toDateOnly(daysFromNow(-10)),
      targetEndDate: toDateOnly(daysFromNow(75)),
      supervisorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const cellCultureProject = await Project.create(
    {
      title: "Mammalian Cell Culture Optimization",
      description:
        "Compare culture conditions to improve cell viability, growth consistency, and experimental reproducibility.",
      status: "planning",
      startDate: toDateOnly(daysFromNow(5)),
      targetEndDate: toDateOnly(daysFromNow(100)),
      supervisorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    qpcrProject,
    proteinProject,
    cellCultureProject,
  };
};

const createMolecularBiologyProjectMembers = async (
  users,
  projects,
  organization,
  transaction,
) => {
  await ProjectMember.bulkCreate(
    [
      {
        projectId: projects.qpcrProject.id,
        userId: users.researcherOne.id,
        projectRole: "lead",
        organizationId: organization.id,
      },
      {
        projectId: projects.qpcrProject.id,
        userId: users.researcherTwo.id,
        projectRole: "member",
        organizationId: organization.id,
      },
      {
        projectId: projects.proteinProject.id,
        userId: users.researcherTwo.id,
        projectRole: "lead",
        organizationId: organization.id,
      },
      {
        projectId: projects.proteinProject.id,
        userId: users.researcherThree.id,
        projectRole: "member",
        organizationId: organization.id,
      },
      {
        projectId: projects.cellCultureProject.id,
        userId: users.researcherThree.id,
        projectRole: "lead",
        organizationId: organization.id,
      },
      {
        projectId: projects.cellCultureProject.id,
        userId: users.researcherOne.id,
        projectRole: "member",
        organizationId: organization.id,
      },
    ],
    { transaction },
  );
};

const createMolecularBiologyTasks = async (
  users,
  projects,
  organization,
  transaction,
) => {
  const taskOne = await Task.create(
    {
      title: "Prepare qPCR primer dilution series",
      description:
        "Prepare primer dilution series and template controls for efficiency testing.",
      status: "todo",
      priority: "high",
      dueDate: toDateOnly(daysFromNow(2)),
      projectId: projects.qpcrProject.id,
      assignedToId: users.researcherOne.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskTwo = await Task.create(
    {
      title: "Review qPCR amplification curves",
      description:
        "Review amplification plots, melting curves, and replicate consistency.",
      status: "in_progress",
      priority: "urgent",
      dueDate: toDateOnly(daysFromNow(-1)),
      projectId: projects.qpcrProject.id,
      assignedToId: users.researcherOne.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskThree = await Task.create(
    {
      title: "Prepare protein expression cultures",
      description:
        "Inoculate expression cultures and prepare induction conditions for comparison.",
      status: "review",
      priority: "medium",
      dueDate: toDateOnly(daysFromNow(4)),
      projectId: projects.proteinProject.id,
      assignedToId: users.researcherTwo.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskFour = await Task.create(
    {
      title: "Prepare cell culture viability test",
      description:
        "Set up replicate wells for comparison of culture conditions and viability.",
      status: "todo",
      priority: "high",
      dueDate: toDateOnly(daysFromNow(8)),
      projectId: projects.cellCultureProject.id,
      assignedToId: users.researcherThree.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const taskFive = await Task.create(
    {
      title: "Check incubator water pan and CO2 supply",
      description:
        "Inspect incubator humidity tray, water level, and carbon dioxide supply.",
      status: "todo",
      priority: "medium",
      dueDate: null,
      projectId: null,
      assignedToId: users.researcherThree.id,
      createdById: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    taskOne,
    taskTwo,
    taskThree,
    taskFour,
    taskFive,
  };
};

const createMolecularBiologyProtocols = async (
  users,
  projects,
  organization,
  transaction,
) => {
  const qpcrProtocol = await Protocol.create(
    {
      title: "qPCR Gene Expression Analysis Protocol",
      version: "1.0",
      purpose:
        "Measure relative gene-expression changes using quantitative PCR with technical replicates and appropriate controls.",
      content:
        "1. Prepare RNA-derived cDNA samples.\n2. Prepare primer working solutions.\n3. Assemble qPCR reactions with technical replicates.\n4. Include no-template and reference controls.\n5. Run amplification and melting-curve analysis.\n6. Review amplification efficiency and replicate consistency.\n7. Calculate relative expression values.",
      approvalStatus: "approved",
      reviewStatus: "approved",
      reviewComment: null,
      projectId: projects.qpcrProject.id,
      equipmentId: null,
      createdById: users.supervisor.id,
      approvedById: users.supervisor.id,
      approvedAt: toDateOnly(daysFromNow(-4)),
      organizationId: organization.id,
    },
    { transaction },
  );

  const proteinProtocol = await Protocol.create(
    {
      title: "Recombinant Protein Expression Screening Protocol",
      version: "0.8",
      purpose:
        "Compare induction conditions for recombinant protein expression in bacterial cultures.",
      content:
        "1. Prepare starter cultures.\n2. Inoculate expression cultures.\n3. Grow cultures to target optical density.\n4. Add inducer at selected concentrations.\n5. Incubate under test conditions.\n6. Harvest cells.\n7. Compare soluble and insoluble protein fractions.",
      approvalStatus: "changes_requested",
      reviewStatus: "changes_requested",
      reviewComment:
        "Please define the target optical-density range and specify the induction temperature for each comparison condition.",
      projectId: projects.proteinProject.id,
      equipmentId: null,
      createdById: users.researcherTwo.id,
      approvedById: null,
      approvedAt: null,
      organizationId: organization.id,
    },
    { transaction },
  );

  const cellCultureProtocol = await Protocol.create(
    {
      title: "Mammalian Cell Culture Maintenance Protocol",
      version: "1.0",
      purpose:
        "Maintain mammalian cell cultures under consistent conditions for experimental use.",
      content:
        "1. Inspect cultures for morphology and contamination.\n2. Warm medium and reagents.\n3. Remove spent medium.\n4. Wash cells if required.\n5. Passage cells at the defined confluence range.\n6. Record passage number and viability.\n7. Return cultures to the incubator.",
      approvalStatus: "approved",
      reviewStatus: "not_required",
      reviewComment: null,
      projectId: projects.cellCultureProject.id,
      equipmentId: null,
      createdById: users.supervisor.id,
      approvedById: null,
      approvedAt: null,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    qpcrProtocol,
    proteinProtocol,
    cellCultureProtocol,
  };
};

const createMolecularBiologyExperiments = async (
  users,
  projects,
  tasks,
  protocols,
  organization,
  transaction,
) => {
  const experimentOne = await Experiment.create(
    {
      title: "qPCR primer efficiency assessment",
      objective:
        "Determine primer amplification efficiency using a serial dilution of cDNA template.",
      notes:
        "Initial amplification curves are consistent across replicates. Melting curves should be reviewed before final approval.",
      status: "needs_review",
      reviewStatus: "pending",
      reviewComment: null,
      startedAt: toDateOnly(daysFromNow(-2)),
      completedAt: toDateOnly(daysFromNow(-2)),
      projectId: projects.qpcrProject.id,
      researcherId: users.researcherOne.id,
      taskId: tasks.taskOne.id,
      protocolId: protocols.qpcrProtocol.id,
      createdById: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const experimentTwo = await Experiment.create(
    {
      title: "IPTG induction condition comparison",
      objective:
        "Compare recombinant protein expression across selected inducer concentrations and incubation conditions.",
      notes:
        "Cultures were induced successfully. Soluble and insoluble fractions still need to be compared.",
      status: "needs_review",
      reviewStatus: "changes_requested",
      reviewComment:
        "Add the measured culture density at induction and identify which temperature was used for each sample set.",
      startedAt: toDateOnly(daysFromNow(-1)),
      completedAt: null,
      projectId: projects.proteinProject.id,
      researcherId: users.researcherTwo.id,
      taskId: tasks.taskThree.id,
      protocolId: protocols.proteinProtocol.id,
      createdById: users.researcherTwo.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const experimentThree = await Experiment.create(
    {
      title: "Cell viability condition comparison",
      objective:
        "Compare cell viability under two culture-medium conditions before selecting a standard workflow.",
      notes: "Replicate wells are planned for the initial comparison.",
      status: "planned",
      reviewStatus: "not_required",
      reviewComment: null,
      startedAt: toDateOnly(daysFromNow(6)),
      completedAt: null,
      projectId: projects.cellCultureProject.id,
      researcherId: users.researcherThree.id,
      taskId: tasks.taskFour.id,
      protocolId: protocols.cellCultureProtocol.id,
      createdById: users.researcherThree.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    experimentOne,
    experimentTwo,
    experimentThree,
  };
};

const createMolecularBiologyNotebookEntries = async (
  users,
  experiments,
  organization,
  transaction,
) => {
  const entryOne = await NotebookEntry.create(
    {
      title: "qPCR dilution-series setup notes",
      entryType: "observation",
      content:
        "Prepared the cDNA dilution series and technical replicates. No-template controls were included in the plate layout.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentOne.id,
      projectId: experiments.experimentOne.projectId,
      authorId: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const entryTwo = await NotebookEntry.create(
    {
      title: "qPCR amplification review",
      entryType: "result",
      content:
        "Amplification curves were consistent across most replicates. One dilution point should be reviewed before the efficiency calculation is finalized.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentOne.id,
      projectId: experiments.experimentOne.projectId,
      authorId: users.researcherOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const entryThree = await NotebookEntry.create(
    {
      title: "Protein induction observation",
      entryType: "observation",
      content:
        "Cultures reached the planned induction stage. Samples were collected for soluble and insoluble fraction comparison.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentTwo.id,
      projectId: experiments.experimentTwo.projectId,
      authorId: users.researcherTwo.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const entryFour = await NotebookEntry.create(
    {
      title: "Supervisor review follow-up",
      entryType: "supervisor_comment",
      content:
        "Please add the measured culture density at induction and record the incubation temperature for each condition.",
      contentFormat: "plain_text",
      experimentId: experiments.experimentTwo.id,
      projectId: experiments.experimentTwo.projectId,
      authorId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    entryOne,
    entryTwo,
    entryThree,
    entryFour,
  };
};

const createMolecularBiologyReviewEvents = async (
  users,
  experiments,
  protocols,
  organization,
  transaction,
) => {
  const experimentChangeRequest = await ReviewEvent.create(
    {
      targetType: "experiment",
      targetId: experiments.experimentTwo.id,
      action: "changes_requested",
      comment:
        "Please add the measured culture density at induction and identify the incubation temperature used for each condition.",
      reviewerId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const protocolChangeRequest = await ReviewEvent.create(
    {
      targetType: "protocol",
      targetId: protocols.proteinProtocol.id,
      action: "changes_requested",
      comment:
        "Define the target optical-density range and specify the induction temperature before this protocol is approved.",
      reviewerId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const protocolApproval = await ReviewEvent.create(
    {
      targetType: "protocol",
      targetId: protocols.qpcrProtocol.id,
      action: "approved",
      comment: "qPCR protocol approved for the demo workflow.",
      reviewerId: users.supervisor.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    experimentChangeRequest,
    protocolChangeRequest,
    protocolApproval,
  };
};

const createMolecularBiologyEquipment = async (organization, transaction) => {
  const qpcr = await Equipment.create(
    {
      name: "Bio-Rad CFX96 Real-Time PCR System",
      type: "qPCR",
      location: "Molecular Biology Lab Room 310",
      status: "available",
      notes: "Used for quantitative PCR and gene-expression analysis.",
      organizationId: organization.id,
    },
    { transaction },
  );

  const incubator = await Equipment.create(
    {
      name: "Thermo Scientific Heracell VIOS CO2 Incubator",
      type: "CO2 Incubator",
      location: "Cell Culture Room 312",
      status: "available",
      notes: "Primary incubator for mammalian cell culture experiments.",
      organizationId: organization.id,
    },
    { transaction },
  );

  const gelDoc = await Equipment.create(
    {
      name: "Bio-Rad Gel Doc Go Imaging System",
      type: "Gel Imaging",
      location: "Molecular Biology Lab Room 311",
      status: "maintenance",
      notes:
        "Used for agarose gel documentation and protein-gel imaging. Currently undergoing routine maintenance.",
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    qpcr,
    incubator,
    gelDoc,
  };
};

const createMolecularBiologyEquipmentProtocols = async (
  users,
  equipment,
  organization,
  transaction,
) => {
  const qpcrSop = await Protocol.create(
    {
      title: "Bio-Rad CFX96 Startup and Run SOP",
      version: "1.0",
      purpose:
        "Standard procedure for preparing and running qPCR plates on the Bio-Rad CFX96 system.",
      content:
        "1. Inspect the instrument and plate block.\n2. Prepare and seal the qPCR plate.\n3. Confirm plate orientation.\n4. Load the plate.\n5. Select the validated run method.\n6. Start the run.\n7. Review amplification and melting curves.\n8. Export run data.",
      approvalStatus: "approved",
      reviewStatus: "approved",
      reviewComment: null,
      projectId: null,
      equipmentId: equipment.qpcr.id,
      createdById: users.supervisor.id,
      approvedById: users.supervisor.id,
      approvedAt: toDateOnly(daysFromNow(-6)),
      organizationId: organization.id,
    },
    { transaction },
  );

  const incubatorSop = await Protocol.create(
    {
      title: "CO2 Incubator Cleaning and Monitoring SOP",
      version: "1.0",
      purpose:
        "Standard procedure for checking, cleaning, and documenting the mammalian cell culture incubator.",
      content:
        "1. Check temperature and CO2 readings.\n2. Inspect humidity tray and water level.\n3. Check for spills or contamination.\n4. Clean internal surfaces according to lab procedure.\n5. Refill sterile water if required.\n6. Record the maintenance check.",
      approvalStatus: "pending_review",
      reviewStatus: "pending",
      reviewComment: null,
      projectId: null,
      equipmentId: equipment.incubator.id,
      createdById: users.supervisor.id,
      approvedById: null,
      approvedAt: null,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    qpcrSop,
    incubatorSop,
  };
};

const createMolecularBiologyEquipmentBookings = async (
  users,
  projects,
  experiments,
  equipment,
  organization,
  transaction,
) => {
  const activeBooking = await EquipmentBooking.create(
    {
      title: "Active qPCR primer efficiency run",
      startTime: minutesFromNow(-20),
      endTime: minutesFromNow(80),
      status: "confirmed",
      purpose: "Run the primer dilution series for qPCR efficiency assessment.",
      equipmentId: equipment.qpcr.id,
      userId: users.researcherOne.id,
      projectId: projects.qpcrProject.id,
      experimentId: experiments.experimentOne.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  const futureBooking = await EquipmentBooking.create(
    {
      title: "Cell culture viability incubation",
      startTime: daysFromNow(3),
      endTime: new Date(daysFromNow(3).getTime() + 3 * 60 * 60 * 1000),
      status: "confirmed",
      purpose:
        "Reserve incubator access for the initial cell viability condition comparison.",
      equipmentId: equipment.incubator.id,
      userId: users.researcherThree.id,
      projectId: projects.cellCultureProject.id,
      experimentId: experiments.experimentThree.id,
      organizationId: organization.id,
    },
    { transaction },
  );

  return {
    activeBooking,
    futureBooking,
  };
};

const ensureSchemaExists = async () => {
  const tableNames = await sequelize.getQueryInterface().showAllTables();

  const normalizedTableNames = tableNames.map((tableName) => {
    if (typeof tableName === "string") {
      return tableName;
    }

    return tableName.tableName;
  });

  if (!normalizedTableNames.includes("users")) {
    throw new Error(
      "Database schema not found. Run `npm run migrate` before running `npm run seed`.",
    );
  }
};

// Main seed runner
const seedDemoData = async () => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_SEED !== "true"
  ) {
    throw new Error(
      "Refusing to run seed script in production without ALLOW_PRODUCTION_SEED=true.",
    );
  }

  const deleteAttachmentStorage = process.env.NODE_ENV === "production";

  let transaction;

  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();

    console.log("Checking database schema...");
    await ensureSchemaExists();

    transaction = await sequelize.transaction();

    console.log("Removing legacy demo organization if present...");
    const legacyOrganization = await Organization.findOne({
      where: { slug: LEGACY_DEMO_SLUG },
      transaction,
    });

    if (legacyOrganization) {
      await clearDemoData(legacyOrganization, transaction, {
        deleteAttachmentStorage,
      });
      await legacyOrganization.destroy({ transaction });
    }

    console.log(
      "Creating or finding analytical chemistry demo organization...",
    );
    const analyticalOrganization = await getOrCreateDemoOrganization(
      DEMO_ORGANIZATIONS.analyticalChemistry,
      transaction,
    );

    console.log("Clearing existing analytical chemistry demo data...");
    await clearDemoData(analyticalOrganization, transaction, {
      deleteAttachmentStorage,
    });

    console.log("Creating analytical chemistry demo users...");
    const analyticalUsers = await createUsers(
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo projects...");
    const analyticalProjects = await createProjects(
      analyticalUsers,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry project memberships...");
    await createProjectMembers(
      analyticalUsers,
      analyticalProjects,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo tasks...");
    const analyticalTasks = await createTasks(
      analyticalUsers,
      analyticalProjects,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo protocols...");
    const analyticalProtocols = await createProtocols(
      analyticalUsers,
      analyticalProjects,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo experiments...");
    const analyticalExperiments = await createExperiments(
      analyticalUsers,
      analyticalProjects,
      analyticalTasks,
      analyticalProtocols,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo notebook entries...");
    await createNotebookEntries(
      analyticalUsers,
      analyticalExperiments,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo review history...");
    await createReviewEvents(
      analyticalUsers,
      analyticalExperiments,
      analyticalProtocols,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo equipment...");
    const analyticalEquipment = await createEquipment(
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry equipment SOPs...");
    await createEquipmentProtocols(
      analyticalUsers,
      analyticalEquipment,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating analytical chemistry demo equipment bookings...");
    await createEquipmentBookings(
      analyticalUsers,
      analyticalProjects,
      analyticalExperiments,
      analyticalEquipment,
      analyticalOrganization,
      transaction,
    );

    console.log("Creating or finding molecular biology demo organization...");
    const molecularOrganization = await getOrCreateDemoOrganization(
      DEMO_ORGANIZATIONS.molecularBiology,
      transaction,
    );

    console.log("Clearing existing molecular biology demo data...");
    await clearDemoData(molecularOrganization, transaction, {
      deleteAttachmentStorage,
    });

    console.log("Creating molecular biology demo users...");
    const molecularUsers = await createMolecularBiologyUsers(
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo projects...");
    const molecularProjects = await createMolecularBiologyProjects(
      molecularUsers,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology project memberships...");
    await createMolecularBiologyProjectMembers(
      molecularUsers,
      molecularProjects,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo tasks...");
    const molecularTasks = await createMolecularBiologyTasks(
      molecularUsers,
      molecularProjects,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo protocols...");
    const molecularProtocols = await createMolecularBiologyProtocols(
      molecularUsers,
      molecularProjects,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo experiments...");
    const molecularExperiments = await createMolecularBiologyExperiments(
      molecularUsers,
      molecularProjects,
      molecularTasks,
      molecularProtocols,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo notebook entries...");
    await createMolecularBiologyNotebookEntries(
      molecularUsers,
      molecularExperiments,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo review history...");
    await createMolecularBiologyReviewEvents(
      molecularUsers,
      molecularExperiments,
      molecularProtocols,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo equipment...");
    const molecularEquipment = await createMolecularBiologyEquipment(
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology equipment SOPs...");
    await createMolecularBiologyEquipmentProtocols(
      molecularUsers,
      molecularEquipment,
      molecularOrganization,
      transaction,
    );

    console.log("Creating molecular biology demo equipment bookings...");
    await createMolecularBiologyEquipmentBookings(
      molecularUsers,
      molecularProjects,
      molecularExperiments,
      molecularEquipment,
      molecularOrganization,
      transaction,
    );

    await transaction.commit();

    console.log("Demo data seeded successfully.");
    console.log("");

    console.log("Analytical Chemistry Research Lab:");
    console.log("Admin: admin@labfluss.test / password1234");
    console.log("Supervisor: anna.keller@labfluss.test / password1234");
    console.log("Researcher 1: maria.schmidt@labfluss.test / password1234");
    console.log("Researcher 2: jonas.weber@labfluss.test / password1234");
    console.log("Researcher 3: sam.dean@labfluss.test / password1234");
    console.log("");

    console.log("Molecular Biology Research Lab:");
    console.log("Admin: admin.molecular@labfluss.test / password1234");
    console.log("Supervisor: elena.fischer@labfluss.test / password1234");
    console.log("Researcher 1: daniel.kim@labfluss.test / password1234");
    console.log("Researcher 2: sophie.mueller@labfluss.test / password1234");
    console.log("Researcher 3: lucas.martin@labfluss.test / password1234");
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    logError(error, {
      event: "demo_seed_failed",
      message: "Demo seed script failed",
    });

    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

seedDemoData();
