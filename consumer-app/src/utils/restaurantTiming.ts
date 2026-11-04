// Restaurant operating-hours display helpers (restaurant page). Open/closed is
// always the backend's answer; these only word it and lay out the saved week.

export type DaySchedule = { closed?: boolean; shifts?: { open?: string; close?: string }[] };

export interface Availability {
  state?: 'online' | 'closed' | 'offline';
  closes_at_label?: string | null;
  next_opening?: { in_days?: number; day_label?: string; at_label?: string } | null;
  today_hours?: string | null;
  has_schedule?: boolean;
}


export const WEEK: [string, string][] = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
];

export const to12h = (hhmm?: string): string | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * "Open · Closes at 11:00 PM" / "Closed · Opens Tuesday at 10:00 AM" /
 * "Currently unavailable". Open or closed is the BACKEND's answer — it applies
 * the saved weekly hours in IST, overnight slots and the restaurant's manual
 * online switch — so the phone's clock and time zone never decide it.
 */
export function timingStatus(a?: Availability | null) {
  if (!a || !a.state) return null;
  if (a.state === 'online') {
    if (!a.has_schedule) return { tone: 'open' as const, title: 'Open', detail: null };
    return a.closes_at_label
      ? { tone: 'open' as const, title: 'Open', detail: `Closes at ${a.closes_at_label}` }
      : { tone: 'open' as const, title: 'Open 24 hours', detail: null };
  }
  if (a.state === 'closed') {
    const n = a.next_opening;
    const detail = !n?.at_label ? null
      : n.in_days === 0 ? `Opens at ${n.at_label}`
        : n.in_days === 1 ? `Opens tomorrow at ${n.at_label}`
          : `Opens ${n.day_label} at ${n.at_label}`;
    return { tone: 'closed' as const, title: 'Closed', detail };
  }
  return { tone: 'offline' as const, title: 'Currently unavailable', detail: null };
}

/** One day of the saved schedule, for the weekly list. Malformed slots are skipped. */
export function dayHours(d?: DaySchedule): string {
  if (!d) return '—';
  if (d.closed) return 'Closed';
  const shifts = d.shifts || [];
  if (!shifts.length) return 'Open 24 hours';
  const parts = shifts
    .map((s) => { const o = to12h(s.open), c = to12h(s.close); return o && c ? `${o} – ${c}` : null; })
    .filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

// Today's weekday in IST, only to highlight today's row in the weekly list.
export const istDayKey = () => WEEK[(new Date(Date.now() + 330 * 60_000).getUTCDay() + 6) % 7][0];
