// Centralized tag colors used across the UI
export const PROJECT_STATUS_COLORS = {
  planning: "default",
  active: "green",
  on_hold: "orange",
  completed: "blue",
  archived: "red",
};

export const TASK_STATUS_COLORS = {
  todo: "default",
  in_progress: "blue",
  blocked: "red",
  review: "orange",
  done: "green",
};

export const TASK_PRIORITY_COLORS = {
  low: "default",
  medium: "blue",
  high: "orange",
  urgent: "red",
};

export const EXPERIMENT_STATUS_COLORS = {
  planned: "default",
  in_progress: "blue",
  waiting_for_data: "purple",
  needs_review: "orange",
  completed: "green",
  failed: "red",
  repeated: "cyan",
  archived: "default",
};

export const REVIEW_STATUS_COLORS = {
  not_submitted: "default",
  pending: "orange",
  approved: "green",
  changes_requested: "red",
};

export const APPROVAL_STATUS_COLORS = {
  draft: "default",
  pending_review: "orange",
  approved: "green",
  changes_requested: "red",
  archived: "default",
};

export const EQUIPMENT_STATUS_COLORS = {
  available: "green",
  maintenance: "orange",
  out_of_service: "red",
  retired: "default",
};

export const BOOKING_STATUS_COLORS = {
  confirmed: "blue",
  cancelled: "red",
  completed: "green",
};

// Centralized tag colors for experiment-linked notebook entry types
export const NOTEBOOK_ENTRY_TYPE_COLORS = {
  general_note: "default",
  procedure: "blue",
  observation: "purple",
  result: "green",
  issue: "red",
  conclusion: "cyan",
  supervisor_comment: "orange",
};

// Centralized tag colors for review history actions
export const REVIEW_EVENT_ACTION_COLORS = {
  approved: "green",
  changes_requested: "orange",
};
