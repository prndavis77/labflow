// Checks whether a value is a valid YYYY-MM-DD date string
// This is useful for DATEONLY fields such as dueDate, startDate, and completedAt
const isValidDateOnly = (value) => {
  if (!value) {
    return true;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
