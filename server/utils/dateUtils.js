/**
 * Date Utility Helper for Standardized CRM Date/Time Operations
 */

/**
 * Returns the start of the week (Monday at 00:00:00.000)
 */
export const getStartOfWeek = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = (day === 0 ? -6 : 1 - day); // adjust when day is sunday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Returns the end of the week (Sunday at 23:59:59.999)
 */
export const getEndOfWeek = (d = new Date()) => {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * Returns the start of the current month (1st at 00:00:00.000)
 */
export const getStartOfMonth = (d = new Date()) => {
  const date = new Date(d);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Returns the end of the current month (last day at 23:59:59.999)
 */
export const getEndOfMonth = (d = new Date()) => {
  const date = new Date(d);
  date.setMonth(date.getMonth() + 1, 0);
  date.setHours(23, 59, 59, 999);
  return date;
};

/**
 * Returns rolling last 7 days start date
 */
export const getLast7DaysStart = (d = new Date()) => {
  const date = new Date(d);
  date.setDate(date.getDate() - 6);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Returns start of previous week (Monday 00:00:00.000)
 */
export const getPreviousWeekStart = (d = new Date()) => {
  const startThisWeek = getStartOfWeek(d);
  const prevWeek = new Date(startThisWeek);
  prevWeek.setDate(prevWeek.getDate() - 7);
  return prevWeek;
};

/**
 * Returns end of previous week (Sunday 23:59:59.999)
 */
export const getPreviousWeekEnd = (d = new Date()) => {
  const startThisWeek = getStartOfWeek(d);
  const prevWeekEnd = new Date(startThisWeek);
  prevWeekEnd.setMilliseconds(-1);
  return prevWeekEnd;
};
