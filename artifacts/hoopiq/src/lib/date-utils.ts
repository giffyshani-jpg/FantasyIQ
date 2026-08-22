/**
 * date-utils.ts — single source of truth for all local-timezone date helpers.
 *
 * All functions use the user's LOCAL calendar day, never raw UTC.
 * This matters for IST (UTC+5:30), AEST (UTC+10), and any timezone where
 * "today" in UTC differs from "today" locally.
 */

// ─── Local date strings ───────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD in LOCAL time for a given Date.
 * Used for cricket day-tab matching (fmtDate).
 */
export function localDateString(date: Date): string {
  return date.toLocaleDateString("en-CA"); // en-CA always produces YYYY-MM-DD
}

/**
 * Returns YYYY-MM-DD in LOCAL time from an ISO string.
 * Used to compare a game's startTimeIso against a tab date.
 */
export function localDateStringFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-CA");
  } catch {
    return "";
  }
}

/**
 * Returns YYYYMMDD (no separators) in LOCAL time for ESPN date-key fetches.
 * Used by the basketball date navigator.
 */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ─── Relative labels ──────────────────────────────────────────────────────────

/**
 * Returns "Today", "Tomorrow", "Yesterday", or a short date string.
 * Comparison is done by LOCAL calendar date (toDateString uses local zone).
 */
export function relativeDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const tom = new Date(now.getTime() + 86_400_000);
    if (d.toDateString() === tom.toDateString()) return "Tomorrow";
    const yest = new Date(now.getTime() - 86_400_000);
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Short display date for a Date object (e.g. "Mon, Jul 28").
 * Used by the basketball DateNav for offsets beyond ±1.
 */
export function fmtDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ─── Time display ─────────────────────────────────────────────────────────────

/**
 * Formats an ISO string to a local-time HH:MM string (e.g. "7:30 PM").
 * Used for cricket match start times.
 */
export function fmtTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return "";
  }
}

// ─── Today / Tomorrow / Day-After offset helpers ──────────────────────────────

/**
 * Returns the LOCAL date for "today + offsetDays".
 * Equivalent to new Date(Date.now() + offset * 86_400_000) but named clearly.
 */
export function localDayOffset(offsetDays: number): Date {
  return new Date(Date.now() + offsetDays * 86_400_000);
}
