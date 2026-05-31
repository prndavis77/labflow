const bcrypt = require("bcrypt");
require("dotenv").config();

const { sequelize } = require("../config/database");
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
} = require("../models");

const SALT_ROUNDS = 12;

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

// Clears existing demo data and resets IDs
// This is destructive and should only be used for local development
const clearDatabase = async () => {
  await sequelize.query(`
    TRUNCATE TABLE
      equipment_bookings,
      notebook_entries,
      review_events,
      protocols,
      experiments,
      tasks,
      equipment,
      projects,
      users
    RESTART IDENTITY CASCADE;
  `);
};

// Creates demo users for testing role-based access
const createUsers = async () => {
  const passwordHash = await bcrypt.hash("password123", SALT_ROUNDS);

  const admin = await User.create({
    name: "Admin User",
    email: "admin@labflow.test",
    passwordHash,
    role: "admin",
    department: "Research Administration",
    canCreateExperiments: true,
    canEditExperiments: true,
    canCreateProtocols: true,
    canEditProtocols: true,
  });

  const supervisor = await User.create({
    name: "Dr. Anna Keller",
    email: "anna.keller@labflow.test",
    passwordHash,
    role: "supervisor",
    department: "Analytical Chemistry",
    canCreateExperiments: true,
    canEditExperiments: true,
    canCreateProtocols: true,
    canEditProtocols: true,
  });

  const researcherOne = await User.create({
    name: "Maria Schmidt",
    email: "maria.schmidt@labflow.test",
    passwordHash: await bcrypt.hash("password123", 10),
    role: "researcher",
    department: "Analytical Chemistry",
    canCreateExperiments: true,
    canEditExperiments: true,
    canCreateProtocols: false,
    canEditProtocols: false,
  });

  const researcherTwo = await User.create({
    name: "Jonas Weber",
    email: "jonas.weber@labflow.test",
    passwordHash: await bcrypt.hash("password123", 10),
    role: "researcher",
    department: "Environmental Chemistry",
    canCreateExperiments: true,
    canEditExperiments: true,
    canCreateProtocols: true,
    canEditProtocols: true,
  });

  const researcherThree = await User.create({
    name: "Sam Dean",
    email: "sam.dean@labflow.test",
    passwordHash,
    role: "researcher",
    department: "Analytical Chemistry",
    canCreateExperiments: false,
    canEditExperiments: false,
    canCreateProtocols: true,
    canEditProtocols: true,
  });

  return {
    admin,
    supervisor,
    researcherOne,
    researcherTwo,
    researcherThree,
  };
};

// Creates realistic university lab research projects
const createProjects = async (users) => {
  const caffeineProject = await Project.create({
    title: "HPLC Method Development for Caffeine Analysis",
    description:
      "Develop and validate an HPLC-UV method for quantifying caffeine in beverage samples.",
    status: "active",
    startDate: toDateOnly(daysFromNow(-14)),
    targetEndDate: toDateOnly(daysFromNow(60)),
    supervisorId: users.supervisor.id,
  });

  const microplasticProject = await Project.create({
    title: "Soil Microplastic Extraction Study",
    description:
      "Optimize sample preparation and extraction methods for microplastic analysis in soil samples.",
    status: "active",
    startDate: toDateOnly(daysFromNow(-30)),
    targetEndDate: toDateOnly(daysFromNow(90)),
    supervisorId: users.supervisor.id,
  });

  const gcmsProject = await Project.create({
    title: "GC-MS Volatile Compound Screening",
    description:
      "Screen volatile organic compounds in forensic liquid samples using GC-MS.",
    status: "planning",
    startDate: toDateOnly(daysFromNow(7)),
    targetEndDate: toDateOnly(daysFromNow(120)),
    supervisorId: users.supervisor.id,
  });

  return {
    caffeineProject,
    microplasticProject,
    gcmsProject,
  };
};

// Creates project-linked tasks with different priorities and due dates
const createTasks = async (users, projects) => {
  const taskOne = await Task.create({
    title: "Prepare caffeine calibration standards",
    description:
      "Prepare 10 ppm, 25 ppm, and 50 ppm caffeine standards for the next HPLC run.",
    status: "todo",
    priority: "high",
    dueDate: toDateOnly(daysFromNow(2)),
    projectId: projects.caffeineProject.id,
    assignedToId: users.researcherOne.id,
    createdById: users.supervisor.id,
  });

  const taskTwo = await Task.create({
    title: "Review caffeine chromatograms",
    description:
      "Check peak shape, retention time stability, and calibration curve linearity.",
    status: "in_progress",
    priority: "urgent",
    dueDate: toDateOnly(daysFromNow(-1)),
    projectId: projects.caffeineProject.id,
    assignedToId: users.researcherOne.id,
    createdById: users.supervisor.id,
  });

  const taskThree = await Task.create({
    title: "Prepare soil extraction blanks",
    description:
      "Prepare procedural blanks for soil microplastic extraction comparison.",
    status: "review",
    priority: "medium",
    dueDate: toDateOnly(daysFromNow(5)),
    projectId: projects.microplasticProject.id,
    assignedToId: users.researcherTwo.id,
    createdById: users.supervisor.id,
  });

  const taskFour = await Task.create({
    title: "Prepare GC-MS screening method setup",
    description:
      "Prepare method parameters, solvent blanks, and sample sequence for volatile compound screening.",
    status: "todo",
    priority: "high",
    dueDate: toDateOnly(daysFromNow(10)),
    projectId: projects.gcmsProject.id,
    assignedToId: users.researcherTwo.id,
    createdById: users.supervisor.id,
  });

  return {
    taskOne,
    taskTwo,
    taskThree,
    taskFour,
  };
};

// Creates reusable lab protocols and approval states
const createProtocols = async (users, projects) => {
  const caffeineProtocol = await Protocol.create({
    title: "HPLC Caffeine Quantification Method",
    version: "1.0",
    purpose:
      "Quantify caffeine in beverage samples using reversed-phase HPLC with UV detection.",
    content:
      "1. Prepare caffeine standards.\n2. Filter samples through 0.45 µm filters.\n3. Set HPLC method parameters.\n4. Inject calibration standards.\n5. Inject unknown samples.\n6. Calculate concentration from calibration curve.",
    approvalStatus: "approved",
    reviewComment: null,
    projectId: projects.caffeineProject.id,
    equipmentId: null,
    createdById: users.supervisor.id,
    approvedById: users.supervisor.id,
    approvedAt: toDateOnly(daysFromNow(-3)),
  });

  const microplasticProtocol = await Protocol.create({
    title: "Soil Microplastic Extraction SOP",
    version: "0.9",
    purpose:
      "Extract and isolate microplastic particles from soil samples for downstream analysis.",
    content:
      "1. Dry soil samples.\n2. Sieve samples.\n3. Perform density separation.\n4. Filter supernatant.\n5. Inspect filters under microscope.\n6. Record particle count and morphology.",
    approvalStatus: "pending_review",
    reviewComment: null,
    projectId: projects.microplasticProject.id,
    equipmentId: null,
    createdById: users.researcherTwo.id,
    approvedById: null,
    approvedAt: null,
  });

  const gcmsProtocol = await Protocol.create({
    title: "GC-MS Volatile Compound Screening Method",
    version: "1.0",
    purpose:
      "Screen volatile organic compounds in liquid samples using GC-MS full scan acquisition.",
    content:
      "1. Prepare solvent blank and quality control sample.\n2. Dilute unknown samples if necessary.\n3. Set GC oven temperature program.\n4. Configure MS scan range.\n5. Inject solvent blank before samples.\n6. Run sample sequence.\n7. Review chromatograms and compare mass spectra against library matches.",
    approvalStatus: "changes_requested",
    reviewComment:
      "Please add acceptance criteria for blank runs and specify the mass scan range before this protocol can be approved.",
    projectId: projects.gcmsProject.id,
    equipmentId: null,
    createdById: users.supervisor.id,
    approvedById: null,
    approvedAt: null,
  });

  return {
    caffeineProtocol,
    microplasticProtocol,
    gcmsProtocol,
  };
};

// Creates laboratory experiments linked to projects, tasks, researchers, and protocols
const createExperiments = async (users, projects, tasks, protocols) => {
  const experimentOne = await Experiment.create({
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
  });

  const experimentTwo = await Experiment.create({
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
    researcherId: users.researcherTwo.id,
    taskId: tasks.taskThree.id,
    protocolId: protocols.microplasticProtocol.id,
    createdById: users.researcherTwo.id,
  });

  const experimentThree = await Experiment.create({
    title: "Initial GC-MS volatile compound screening run",
    objective:
      "Screen unknown liquid samples for volatile organic compounds using full scan GC-MS acquisition.",
    notes:
      "Prepare solvent blank, QC sample, and initial sample sequence before running the instrument.",
    status: "planned",
    reviewStatus: "not_submitted",
    reviewComment: null,
    startedAt: toDateOnly(daysFromNow(8)),
    completedAt: null,
    projectId: projects.gcmsProject.id,
    researcherId: users.researcherTwo.id,
    taskId: tasks.taskFour.id,
    protocolId: protocols.gcmsProtocol.id,
    createdById: users.researcherTwo.id,
  });

  return {
    experimentOne,
    experimentTwo,
    experimentThree,
  };
};

// Creates demo notebook entries linked to experiments.
const createNotebookEntries = async (users, experiments) => {
  const entryOne = await NotebookEntry.create({
    title: "Initial HPLC setup observation",
    entryType: "observation",
    content:
      "The HPLC system was equilibrated for 20 minutes before injection. Baseline looked stable before starting the calibration sequence.",
    contentFormat: "plain_text",
    experimentId: experiments.experimentOne.id,
    projectId: experiments.experimentOne.projectId,
    authorId: users.researcherOne.id,
  });

  const entryTwo = await NotebookEntry.create({
    title: "Calibration curve result notes",
    entryType: "result",
    content:
      "The calibration curve showed acceptable linearity across the tested concentration range. Peak shape should still be reviewed before final validation.",
    contentFormat: "plain_text",
    experimentId: experiments.experimentOne.id,
    projectId: experiments.experimentOne.projectId,
    authorId: users.researcherOne.id,
  });

  const entryThree = await NotebookEntry.create({
    title: "Soil extraction blank observation",
    entryType: "observation",
    content:
      "Prepared procedural blanks for comparison. Samples are waiting for microscope inspection and particle counting.",
    contentFormat: "plain_text",
    experimentId: experiments.experimentTwo.id,
    projectId: experiments.experimentTwo.projectId,
    authorId: users.researcherTwo.id,
  });

  const entryFour = await NotebookEntry.create({
    title: "Supervisor review follow-up",
    entryType: "supervisor_comment",
    content:
      "The blank preparation details need to be expanded before this experiment can be approved.",
    contentFormat: "plain_text",
    experimentId: experiments.experimentTwo.id,
    projectId: experiments.experimentTwo.projectId,
    authorId: users.supervisor.id,
  });

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
const createReviewEvents = async (users, experiments, protocols) => {
  const experimentChangeRequest = await ReviewEvent.create({
    targetType: "experiment",
    targetId: experiments.experimentTwo.id,
    action: "changes_requested",
    comment:
      "Please add the blank preparation details and clarify whether the same filter batch was used for both workflows.",
    reviewerId: users.supervisor.id,
  });

  const experimentFollowUpChangeRequest = await ReviewEvent.create({
    targetType: "experiment",
    targetId: experiments.experimentTwo.id,
    action: "changes_requested",
    comment:
      "The blank preparation details are clearer now, but the microscope inspection criteria still need to be specified.",
    reviewerId: users.supervisor.id,
  });

  const protocolChangeRequest = await ReviewEvent.create({
    targetType: "protocol",
    targetId: protocols.gcmsProtocol.id,
    action: "changes_requested",
    comment:
      "Please add acceptance criteria for blank runs and specify the mass scan range before this protocol can be approved.",
    reviewerId: users.supervisor.id,
  });

  const protocolApproval = await ReviewEvent.create({
    targetType: "protocol",
    targetId: protocols.caffeineProtocol.id,
    action: "approved",
    comment: "Protocol approved for caffeine quantification demo workflow.",
    reviewerId: users.supervisor.id,
  });

  return {
    experimentChangeRequest,
    experimentFollowUpChangeRequest,
    protocolChangeRequest,
    protocolApproval,
  };
};

// Creates shared lab equipment inventory
const createEquipment = async () => {
  const hplc = await Equipment.create({
    name: "HPLC Agilent 1260",
    type: "HPLC",
    location: "Analytical Lab Room 203",
    status: "available",
    notes: "Main HPLC system for UV-based quantification.",
  });

  const gcms = await Equipment.create({
    name: "GC-MS Shimadzu QP2020",
    type: "GC-MS",
    location: "Forensic Chemistry Lab 105",
    status: "available",
    notes: "Used for volatile compound screening and forensic sample analysis.",
  });

  const gcms_2 = await Equipment.create({
    name: "Agilent 5977C GC/MS",
    type: "GC-MS",
    location: "Analytical Lab Room 203",
    status: "maintenance",
    notes:
      "Used for volatile compound screening and forensic sample analysis. Currently under maintenance for detector replacement.",
  });

  return {
    hplc,
    gcms,
    gcms_2,
  };
};

// Creates equipment-specific SOPs after equipment exists.
const createEquipmentProtocols = async (users, equipment) => {
  const hplcSop = await Protocol.create({
    title: "HPLC Agilent 1260 Startup and Shutdown SOP",
    version: "1.0",
    purpose:
      "Standard procedure for safely starting, preparing, and shutting down the HPLC Agilent 1260 system.",
    content:
      "1. Check solvent levels.\n2. Inspect waste container.\n3. Power on the HPLC modules.\n4. Prime solvent lines.\n5. Equilibrate the column.\n6. Run system suitability check.\n7. Flush the system after use.\n8. Shut down modules according to lab procedure.",
    approvalStatus: "approved",
    reviewComment: null,
    projectId: null,
    equipmentId: equipment.hplc.id,
    createdById: users.supervisor.id,
    approvedById: users.supervisor.id,
    approvedAt: toDateOnly(daysFromNow(-5)),
  });

  const gcmsSop = await Protocol.create({
    title: "GC-MS Shimadzu QP2020 Tuning SOP",
    version: "1.0",
    purpose:
      "Standard procedure for checking tuning status before GC-MS screening runs.",
    content:
      "1. Confirm carrier gas supply.\n2. Check vacuum status.\n3. Load tuning method.\n4. Run autotune check.\n5. Review ion ratios and sensitivity.\n6. Save tuning report.\n7. Notify supervisor if tuning fails.",
    approvalStatus: "pending_review",
    reviewComment: null,
    projectId: null,
    equipmentId: equipment.gcms.id,
    createdById: users.supervisor.id,
    approvedById: null,
    approvedAt: null,
  });

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
) => {
  const activeBooking = await EquipmentBooking.create({
    title: "Active HPLC caffeine run",
    startTime: minutesFromNow(-30),
    endTime: minutesFromNow(90),
    status: "confirmed",
    purpose: "Run caffeine calibration standards for HPLC method development.",
    equipmentId: equipment.hplc.id,
    userId: users.researcherOne.id,
    projectId: projects.caffeineProject.id,
    experimentId: experiments.experimentOne.id,
  });

  const futureBooking = await EquipmentBooking.create({
    title: "GC-MS volatile screening",
    startTime: daysFromNow(2),
    endTime: new Date(daysFromNow(2).getTime() + 2 * 60 * 60 * 1000),
    status: "confirmed",
    purpose: "Screen forensic liquid samples for volatile organic compounds.",
    equipmentId: equipment.gcms.id,
    userId: users.researcherTwo.id,
    projectId: projects.gcmsProject.id,
    experimentId: null,
  });

  return {
    activeBooking,
    futureBooking,
  };
};

// Main seed runner
const seedDemoData = async () => {
  try {
    console.log("Connecting to database...");

    await sequelize.authenticate();

    console.log("Syncing database models...");

    await sequelize.sync({ alter: true });

    console.log("Clearing existing data...");

    await clearDatabase();

    console.log("Creating demo users...");

    const users = await createUsers();

    console.log("Creating demo projects...");

    const projects = await createProjects(users);

    console.log("Creating demo tasks...");

    const tasks = await createTasks(users, projects);

    console.log("Creating demo protocols...");

    const protocols = await createProtocols(users, projects);

    console.log("Creating demo experiments...");

    const experiments = await createExperiments(
      users,
      projects,
      tasks,
      protocols,
    );

    console.log("Creating demo notebook entries...");

    await createNotebookEntries(users, experiments);

    console.log("Creating demo review history...");

    await createReviewEvents(users, experiments, protocols);

    console.log("Creating demo equipment...");

    const equipment = await createEquipment();

    console.log("Creating equipment SOPs...");

    await createEquipmentProtocols(users, equipment);

    console.log("Creating demo equipment bookings...");

    await createEquipmentBookings(users, projects, experiments, equipment);

    console.log("Demo data seeded successfully.");
    console.log("");
    console.log("Demo login credentials:");
    console.log("Admin: admin@labflow.test / password123");
    console.log("Supervisor: anna.keller@labflow.test / password123");
    console.log("Researcher 1: maria.schmidt@labflow.test / password123");
    console.log("Researcher 2: jonas.weber@labflow.test / password123");
    console.log("Researcher 3: sam.dean@labflow.test / password123");
  } catch (error) {
    console.error("Seed script failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

seedDemoData();
