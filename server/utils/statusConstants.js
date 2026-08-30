/**
 * Canonical Lead Status Constants
 */
export const LEAD_STATUS = {
  FRESH: 'fresh',
  FOLLOW_UP: 'follow-up',
  RNR: 'rnr',
  INTERESTED: 'interested',
  ADMISSION_DONE: 'admission-done',
  ORIENTATION_DONE: 'orientation-done',
  REGISTERED: 'registered',
  DEAD: 'dead',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
};

export const CANONICAL_STATUSES = Object.values(LEAD_STATUS);

/**
 * Normalizes input status strings to canonical status.
 * Maps legacy 'closed' -> 'registered'.
 */
export const normalizeStatus = (inputStatus) => {
  if (!inputStatus || typeof inputStatus !== 'string') return LEAD_STATUS.FRESH;
  const s = inputStatus.trim().toLowerCase();
  if (s === 'closed') return LEAD_STATUS.REGISTERED;
  if (CANONICAL_STATUSES.includes(s)) return s;
  return LEAD_STATUS.FRESH;
};
