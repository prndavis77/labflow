export const ATTACHMENT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const ATTACHMENT_MAX_FILE_COUNT = 1;

export const ATTACHMENT_ENTITY_TYPES = {
  PROJECT: "project",
  TASK: "task",
  EXPERIMENT: "experiment",
  PROTOCOL: "protocol",
  NOTEBOOK_ENTRY: "notebook_entry",
  EQUIPMENT: "equipment",
};

export const ATTACHMENT_UPLOAD_STATUSES = {
  PENDING: "pending",
  AVAILABLE: "available",
  FAILED: "failed",
};

export const ATTACHMENT_CATEGORIES = {
  RESULT: "result",
  RAW_DATA: "raw_data",
  IMAGE: "image",
  CHROMATOGRAM: "chromatogram",
  SPECTRUM: "spectrum",
  DNA_PROFILE: "dna_profile",
  REFERENCE_ARTICLE: "reference_article",
  MANUSCRIPT: "manuscript",
  PROTOCOL_ATTACHMENT: "protocol_attachment",
  EQUIPMENT_MANUAL: "equipment_manual",
  SAFETY_DOCUMENT: "safety_document",
  OTHER: "other",
};

export const ATTACHMENT_CATEGORY_OPTIONS = [
  {
    label: "Result",
    value: ATTACHMENT_CATEGORIES.RESULT,
  },
  {
    label: "Raw Data",
    value: ATTACHMENT_CATEGORIES.RAW_DATA,
  },
  {
    label: "Image",
    value: ATTACHMENT_CATEGORIES.IMAGE,
  },
  {
    label: "Chromatogram",
    value: ATTACHMENT_CATEGORIES.CHROMATOGRAM,
  },
  {
    label: "Spectrum",
    value: ATTACHMENT_CATEGORIES.SPECTRUM,
  },
  {
    label: "DNA Profile",
    value: ATTACHMENT_CATEGORIES.DNA_PROFILE,
  },
  {
    label: "Reference Article",
    value: ATTACHMENT_CATEGORIES.REFERENCE_ARTICLE,
  },
  {
    label: "Manuscript",
    value: ATTACHMENT_CATEGORIES.MANUSCRIPT,
  },
  {
    label: "Protocol Attachment",
    value: ATTACHMENT_CATEGORIES.PROTOCOL_ATTACHMENT,
  },
  {
    label: "Equipment Manual",
    value: ATTACHMENT_CATEGORIES.EQUIPMENT_MANUAL,
  },
  {
    label: "Safety Document",
    value: ATTACHMENT_CATEGORIES.SAFETY_DOCUMENT,
  },
  {
    label: "Other",
    value: ATTACHMENT_CATEGORIES.OTHER,
  },
];

export const ATTACHMENT_UPLOAD_STATUS_LABELS = {
  [ATTACHMENT_UPLOAD_STATUSES.PENDING]: "Pending",
  [ATTACHMENT_UPLOAD_STATUSES.AVAILABLE]: "Available",
  [ATTACHMENT_UPLOAD_STATUSES.FAILED]: "Failed",
};

export const DEFAULT_ATTACHMENT_CATEGORY = ATTACHMENT_CATEGORIES.OTHER;
