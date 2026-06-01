// Project statuses must match the backend Project model ENUM
export const PROJECT_STATUS_OPTIONS = [
  { label: "Planning", value: "planning" },
  { label: "Active", value: "active" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

// Task statuses must match the backend Task model ENUM
export const TASK_STATUS_OPTIONS = [
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Blocked", value: "blocked" },
  { label: "Review", value: "review" },
  { label: "Done", value: "done" },
];

// Task priorities must match the backend Task model ENUM
export const TASK_PRIORITY_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

// Experiment statuses must match the backend Experiment model ENUM
export const EXPERIMENT_STATUS_OPTIONS = [
  { label: "Planned", value: "planned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Waiting for Data", value: "waiting_for_data" },
  { label: "Needs Review", value: "needs_review" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Repeated", value: "repeated" },
  { label: "Archived", value: "archived" },
];

// Review statuses must match the backend Experiment reviewStatus ENUM
export const REVIEW_STATUS_OPTIONS = [
  { label: "Not Submitted", value: "not_submitted" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Changes Requested", value: "changes_requested" },
];

export const EDITABLE_REVIEW_STATUS_OPTIONS = [
  { label: "Not Submitted", value: "not_submitted" },
  { label: "Pending", value: "pending" },
];

// Protocol approval statuses must match the backend Protocol approvalStatus ENUM
export const APPROVAL_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Pending Review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Changes Requested", value: "changes_requested" },
  { label: "Archived", value: "archived" },
];

export const EDITABLE_APPROVAL_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Pending Review", value: "pending_review" },
  { label: "Archived", value: "archived" },
];

// Equipment statuses must match the backend Equipment status ENUM
export const EQUIPMENT_STATUS_OPTIONS = [
  { label: "Available", value: "available" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Out of Service", value: "out_of_service" },
  { label: "Retired", value: "retired" },
];

// Booking statuses must match the backend EquipmentBooking status ENUM
export const BOOKING_STATUS_OPTIONS = [
  { label: "Confirmed", value: "confirmed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Completed", value: "completed" },
];

// Notebook entry types must match the backend NotebookEntry entryType ENUM
export const NOTEBOOK_ENTRY_TYPE_OPTIONS = [
  { label: "General Note", value: "general_note" },
  { label: "Procedure", value: "procedure" },
  { label: "Observation", value: "observation" },
  { label: "Result", value: "result" },
  { label: "Issue", value: "issue" },
  { label: "Conclusion", value: "conclusion" },
  { label: "Supervisor Comment", value: "supervisor_comment" },
];

// User roles must match backend role values
export const USER_ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Supervisor", value: "supervisor" },
  { label: "Researcher", value: "researcher" },
];

// Project-specific membership roles.
export const PROJECT_MEMBER_ROLE_OPTIONS = [
  { label: "Lead", value: "lead" },
  { label: "Member", value: "member" },
  { label: "Viewer", value: "viewer" },
];
