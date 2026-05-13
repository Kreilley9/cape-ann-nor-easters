/**
 * Date formatting utilities that use Eastern Time (America/New_York)
 */

const EASTERN_TIMEZONE = "America/New_York";

/**
 * Format a date string as a full date and time in Eastern Time
 * Example: "1/15/2024, 3:30 PM"
 */
export function formatDateTime(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleString("en-US", {
    timeZone: EASTERN_TIMEZONE,
  });
}

/**
 * Format a date string as just the date in Eastern Time
 * Example: "1/15/2024"
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIMEZONE,
  });
}

/**
 * Format a date string as just the time in Eastern Time
 * Example: "3:30 PM"
 */
export function formatTime(dateString: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleTimeString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    ...options,
  });
}

/**
 * Format a date with custom options in Eastern Time
 */
export function formatDateCustom(dateString: string | Date, options: Intl.DateTimeFormatOptions): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    ...options,
  });
}

/**
 * Format a date as a relative time string (e.g., "2h ago", "5d ago")
 * in Eastern Time
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}
