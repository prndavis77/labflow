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

module.exports = {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_UPLOAD_STATUSES,
};
