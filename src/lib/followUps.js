import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS } from "@/config/app";

export function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// Sorts people into the four reasons they might need a follow-up today.
// Shared so the follow-ups page and the nav badge can never disagree on the count.
export function classifyPeople(people, firstFollowUpDays, inactivityDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduled = [], newContact = [], followUpDue = [], inactive = [];

  people.forEach((p) => {
    const lastFollowedUp = p.lastFollowedUpAt?.toDate ? p.lastFollowedUpAt.toDate() : null;
    const created = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null);
    const scheduledDate = p.scheduledFollowUpAt?.toDate
      ? p.scheduledFollowUpAt.toDate()
      : (p.scheduledFollowUpAt ? new Date(p.scheduledFollowUpAt) : null);
    const interval = p.followUpDays ?? null;

    // Scheduled date takes full control — only show when past due
    if (scheduledDate) {
      const dueIn = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
      if (dueIn <= 0) scheduled.push({ ...p, _scheduled: scheduledDate });
      return;
    }

    // Interval-based (uses lastFollowedUpAt if exists, else createdAt)
    if (interval) {
      const ref = lastFollowedUp || created;
      const since = ref ? daysSince(ref) : null;
      if (since !== null && since >= interval) followUpDue.push({ ...p, _daysOverdue: since - interval });
      return;
    }

    // No schedule, no interval
    if (!lastFollowedUp) {
      // New contact — use global first follow-up threshold
      const since = created ? daysSince(created) : null;
      if (since !== null && since >= firstFollowUpDays) newContact.push({ ...p, _daysOverdue: since - firstFollowUpDays });
      return;
    }

    // Has been followed up, chose no interval/schedule → inactivity
    const since = daysSince(lastFollowedUp);
    if (since >= inactivityDays) inactive.push({ ...p, _since: since });
  });

  scheduled.sort((a, b) => a._scheduled - b._scheduled);
  newContact.sort((a, b) => b._daysOverdue - a._daysOverdue);
  followUpDue.sort((a, b) => b._daysOverdue - a._daysOverdue);
  inactive.sort((a, b) => b._since - a._since);

  return { scheduled, newContact, followUpDue, inactive };
}

/**
 * Everyone due today, as one list, most urgent first. Each person carries a
 * `_reason` naming which rule surfaced them, so callers can label them without
 * re-deriving the rule and drifting from this one.
 */
export function dueList(people, profile) {
  const { scheduled, newContact, followUpDue, inactive } = classifyPeople(
    people.filter((p) => !p.noContact),
    profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS,
    profile?.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS
  );
  return [
    ...scheduled.map((p) => ({ ...p, _reason: "scheduled" })),
    ...newContact.map((p) => ({ ...p, _reason: "new" })),
    ...followUpDue.map((p) => ({ ...p, _reason: "due" })),
    ...inactive.map((p) => ({ ...p, _reason: "inactive" })),
  ];
}

// Short label for a person from dueList. Shared so the dashboard and the
// follow-ups page describe the same person the same way.
export function dueBadge(p) {
  switch (p._reason) {
    case "scheduled":
      return `Scheduled · ${p._scheduled.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    case "new":
      return p._daysOverdue === 0 ? "First follow-up due" : `First follow-up · ${p._daysOverdue}d overdue`;
    case "inactive":
      return `${p._since}d without contact`;
    default:
      return p._daysOverdue === 0 ? "Due today" : `${p._daysOverdue}d overdue`;
  }
}

export function countDue(people, profile) {
  return dueList(people, profile).length;
}
