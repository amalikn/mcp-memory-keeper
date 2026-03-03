/**
 * Timestamp utility functions for converting between ISO and SQLite formats
 *
 * SQLite stores timestamps in "YYYY-MM-DD HH:MM:SS" format
 * JavaScript Date objects use ISO format with local timezone offset
 * "YYYY-MM-DDTHH:MM:SS.sss±HH:MM"
 */

function pad(value: number, length: number = 2): string {
  return String(value).padStart(length, '0');
}

function formatLocalOffset(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${sign}${pad(hours)}:${pad(minutes)}`;
}

function toLocalISOStringFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${formatLocalOffset(
    date
  )}`;
}

function toSQLiteLocalTimestampFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseSQLiteLocalTimestamp(sqliteTimestamp: string): Date {
  const match = sqliteTimestamp.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid SQLite timestamp format: ${sqliteTimestamp}`);
  }

  const [, year, month, day, hours, minutes, seconds] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
    0
  );
}

export function localISOString(date: Date = new Date()): string {
  return toLocalISOStringFromDate(date);
}

/**
 * Convert ISO timestamp to SQLite format
 * @param isoTimestamp - ISO format timestamp (e.g., "2025-06-27T02:07:07.253Z")
 * @returns SQLite format timestamp (e.g., "2025-06-27 02:07:07")
 */
export function toSQLiteTimestamp(isoTimestamp: string): string {
  if (!isoTimestamp) {
    throw new Error('Timestamp cannot be null or empty');
  }

  // Handle already converted timestamps (SQLite format)
  if (isSQLiteTimestamp(isoTimestamp)) {
    // Already in SQLite format or not an ISO timestamp
    return isoTimestamp;
  }

  try {
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Invalid date value');
    }

    return toSQLiteLocalTimestampFromDate(parsed);
  } catch (_error) {
    throw new Error(`Invalid ISO timestamp format: ${isoTimestamp}`);
  }
}

/**
 * Convert SQLite timestamp to ISO format
 * @param sqliteTimestamp - SQLite format timestamp (e.g., "2025-06-27 02:07:07")
 * @returns ISO format timestamp (e.g., "2025-06-27T02:07:07.000Z")
 */
export function toISOTimestamp(sqliteTimestamp: string): string {
  if (!sqliteTimestamp) {
    throw new Error('Timestamp cannot be null or empty');
  }

  // Handle already converted timestamps (ISO format)
  if (isISOTimestamp(sqliteTimestamp)) {
    // Already in ISO format
    return sqliteTimestamp;
  }

  try {
    const parsed = parseSQLiteLocalTimestamp(sqliteTimestamp);
    return toLocalISOStringFromDate(parsed);
  } catch (_error) {
    throw new Error(`Invalid SQLite timestamp format: ${sqliteTimestamp}`);
  }
}

/**
 * Check if a timestamp is in ISO format
 * @param timestamp - The timestamp to check
 * @returns true if the timestamp is in ISO format
 */
export function isISOTimestamp(timestamp: string): boolean {
  if (!timestamp) return false;

  // ISO format contains date/time separator and timezone designator
  return /T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp);
}

/**
 * Check if a timestamp is in SQLite format
 * @param timestamp - The timestamp to check
 * @returns true if the timestamp is in SQLite format
 */
export function isSQLiteTimestamp(timestamp: string): boolean {
  if (!timestamp) return false;

  // SQLite format contains space and doesn't end with 'Z'
  return timestamp.includes(' ') && !timestamp.endsWith('Z');
}

/**
 * Ensure a timestamp is in SQLite format, converting if necessary
 * @param timestamp - The timestamp in any supported format
 * @returns SQLite format timestamp
 */
export function ensureSQLiteFormat(timestamp: string): string {
  if (!timestamp) {
    throw new Error('Timestamp cannot be null or empty');
  }

  if (isISOTimestamp(timestamp)) {
    return toSQLiteTimestamp(timestamp);
  }

  // Assume it's already SQLite format or handle as-is
  return timestamp;
}

/**
 * Ensure a timestamp is in ISO format, converting if necessary
 * @param timestamp - The timestamp in any supported format
 * @returns ISO format timestamp
 */
export function ensureISOFormat(timestamp: string): string {
  if (!timestamp) {
    throw new Error('Timestamp cannot be null or empty');
  }

  if (isSQLiteTimestamp(timestamp)) {
    return toISOTimestamp(timestamp);
  }

  // Assume it's already ISO format or handle as-is
  return timestamp;
}
