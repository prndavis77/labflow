const ARCHIVED_ITEM_ENTITY_TYPES = Object.freeze([
  "project",
  "task",
  "experiment",
  "protocol",
  "attachment",
]);

const ARCHIVED_ITEM_DEFAULT_PAGE_SIZE = 20;
const ARCHIVED_ITEM_MAX_PAGE_SIZE = 100;

module.exports = {
  ARCHIVED_ITEM_ENTITY_TYPES,
  ARCHIVED_ITEM_DEFAULT_PAGE_SIZE,
  ARCHIVED_ITEM_MAX_PAGE_SIZE,
};
