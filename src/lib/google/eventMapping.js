// Meetups have a start time but no end time, so every event gets a fixed block.
export const DEFAULT_DURATION_MINUTES = 60;

function toDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

export function meetupToEvent(meetup, { durationMinutes = DEFAULT_DURATION_MINUTES } = {}) {
  const start = toDate(meetup.date);
  if (!start) throw new Error("Meetup has no date");
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return {
    summary: meetup.personName || "Meetup",
    // Google rejects some empty-string fields and stores others as literal
    // blanks, so omit them entirely instead.
    ...(meetup.location ? { location: meetup.location } : {}),
    ...(meetup.notes ? { description: meetup.notes } : {}),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: { consolAppMeetupId: meetup.id },
    },
  };
}

export function eventToMeetupPatch(event) {
  if (!event || event.status === "cancelled") return null;
  // All-day events carry `start.date` instead of `start.dateTime`. Meetups are
  // point-in-time, so there is nothing sensible to map.
  const dateTime = event.start?.dateTime;
  if (!dateTime) return null;

  return {
    date: new Date(dateTime),
    location: event.location || "",
    notes: event.description || "",
  };
}
