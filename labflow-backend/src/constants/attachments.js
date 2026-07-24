const ATTACHMENT_ACCESS_ACTIONS = ["view", "upload", "update", "archive"];

const ATTACHMENT_ENTITY_TYPES = [
  "experiment",
  "protocol",
  "project",
  "notebook_entry",
  "equipment",
  "task",
];

const ATTACHMENT_CATEGORIES = [
  "result",
  "raw_data",
  "image",
  "chromatogram",
  "spectrum",
  "dna_profile",
  "reference_article",
  "manuscript",
  "protocol_attachment",
  "equipment_manual",
  "safety_document",
  "other",
];

const ATTACHMENT_UPLOAD_STATUSES = ["pending", "available", "failed"];

const ATTACHMENT_STORAGE_PROVIDERS = ["r2"];

const ATTACHMENT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ATTACHMENT_UPLOAD_URL_TTL_SECONDS = 300;
const ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS = 60;
const ATTACHMENT_PENDING_TTL_MINUTES = 30;

const ATTACHMENT_MAX_ORIGINAL_FILE_NAME_LENGTH = 255;
const ATTACHMENT_MAX_SAFE_FILE_NAME_LENGTH = 255;
const ATTACHMENT_MAX_DESCRIPTION_LENGTH = 2000;

const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
];

const BLOCKED_ATTACHMENT_EXTENSIONS = [
  ".exe",
  ".js",
  ".mjs",
  ".cjs",
  ".html",
  ".htm",
  ".bat",
  ".cmd",
  ".scr",
  ".msi",
  ".svg",
  ".zip",
];

const MIME_TYPES_BY_EXTENSION = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".csv": [
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
  ],
  ".txt": ["text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".tif": ["image/tiff"],
  ".tiff": ["image/tiff"],
};

const ALLOWED_ATTACHMENT_MIME_TYPES = Array.from(
  new Set(Object.values(MIME_TYPES_BY_EXTENSION).flat()),
);

module.exports = {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS,
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_MAX_DESCRIPTION_LENGTH,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  ATTACHMENT_MAX_ORIGINAL_FILE_NAME_LENGTH,
  ATTACHMENT_MAX_SAFE_FILE_NAME_LENGTH,
  ATTACHMENT_PENDING_TTL_MINUTES,
  ATTACHMENT_STORAGE_PROVIDERS,
  ATTACHMENT_UPLOAD_STATUSES,
  ATTACHMENT_UPLOAD_URL_TTL_SECONDS,
  BLOCKED_ATTACHMENT_EXTENSIONS,
  MIME_TYPES_BY_EXTENSION,
  ATTACHMENT_ACCESS_ACTIONS,
};
