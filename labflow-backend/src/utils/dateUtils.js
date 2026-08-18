// Checks whether a value is a valid YYYY-MM-DD date string
// This is useful for DATEONLY fields such as dueDate, startDate, and completedAt
const isValidDateOnly = (value) => {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// Checks whether an end date is the same as or after a start date
// Empty values are allowed because many records may not have both dates yet
const isEndDateAfterStartDate = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return true;
  }

  return new Date(endDate) >= new Date(startDate);
};

module.exports = { isValidDateOnly, isEndDateAfterStartDate };
