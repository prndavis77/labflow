import dayjs from "dayjs";

// Converts snake_case values into readable labels
export function formatLabel(value) {
  if (!value) {
    return "Not Set";
  }

  return value
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Formats ISO date strings for table display
export function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }

  return dayjs(value).format("YYYY-MM-DD HH:mm");
}

// Formats date-only values for table display
export function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return dayjs(value).format("YYYY-MM-DD");
}
