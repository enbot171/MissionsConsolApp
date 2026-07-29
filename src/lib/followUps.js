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

export function countDue(people, profile) {
  const { scheduled, newContact, followUpDue, inactive } = classifyPeople(
    people.filter((p) => !p.noContact),
    profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS,
    profile?.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS
  );
  return scheduled.length + newContact.length + followUpDue.length + inactive.length;
}
