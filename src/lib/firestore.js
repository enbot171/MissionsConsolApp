import {
  runTransaction,
  writeBatch,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  getCountFromServer,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { attendanceId, mergeAttendance } from "./events";

// ── Users ─────────────────────────────────────────────────────────────────────

export const addUserProfile = async (uid, data) => {
  await setDoc(doc(db, "users", uid), { ...data, createdAt: serverTimestamp() });
};

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateUserProfile = async (uid, data) => {
  await updateDoc(doc(db, "users", uid), data);
};

export const deleteUserProfile = async (uid) => {
  await deleteDoc(doc(db, "users", uid));
};

export const getUsersByTeam = async (teamId) => {
  const q = query(collection(db, "users"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export const addTeam = async (data) => {
  const ref = await addDoc(collection(db, "teams"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getTeam = async (id) => {
  const snap = await getDoc(doc(db, "teams", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getAllTeams = async () => {
  const snap = await getDocs(collection(db, "teams"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateTeam = async (id, data) => {
  await updateDoc(doc(db, "teams", id), data);
};

export const deleteTeam = async (id) => {
  await deleteDoc(doc(db, "teams", id));
};

// ── People ────────────────────────────────────────────────────────────────────

export const addPerson = async (data) => {
  const { createdAt: providedDate, ...rest } = data;
  const ref = await addDoc(collection(db, "people"), {
    ...rest,
    createdAt: providedDate
      ? Timestamp.fromDate(new Date(providedDate))
      : serverTimestamp(),
  });
  return ref.id;
};

export const getPerson = async (id) => {
  const snap = await getDoc(doc(db, "people", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updatePerson = async (id, data) => {
  await updateDoc(doc(db, "people", id), data);
};

export const deletePerson = async (id) => {
  await deleteDoc(doc(db, "people", id));
};

export const getPeopleByTeam = async (teamId) => {
  const q = query(collection(db, "people"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.archived)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
};

// Returns { people, noContact } from a single Firestore query — avoids reading team docs twice.
export const getTeamPeopleAndNoContact = async (teamId) => {
  const q = query(collection(db, "people"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    people: docs.filter((p) => !p.archived && !p.noContact),
    noContact: docs.filter((p) => p.noContact === true),
  };
};

export const getNoContactByAssignee = async (uid) => {
  const q = query(collection(db, "people"), where("assignedTo", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.noContact === true);
};

export const getPeopleByAssigneeAndDate = async (uid, dateStr) => {
  const start = new Date(dateStr);
  const end = new Date(dateStr);
  end.setDate(end.getDate() + 1);
  const q = query(
    collection(db, "people"),
    where("assignedTo", "==", uid),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getPeopleByAssignee = async (uid) => {
  const q = query(
    collection(db, "people"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.archived);
};

// Single read returning both active and archived — avoids duplicate Firestore queries.
export const getAllPeopleByAssignee = async (uid) => {
  const q = query(
    collection(db, "people"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    people: docs.filter((p) => !p.archived),
    archived: docs.filter((p) => p.archived === true),
  };
};

// Live version of getAllPeopleByAssignee — first snapshot arrives instantly from
// the local cache, then updates when the server responds. Returns unsubscribe fn.
export const subscribeAllPeopleByAssignee = (uid, callback) => {
  const q = query(
    collection(db, "people"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback({
      people: docs.filter((p) => !p.archived),
      archived: docs.filter((p) => p.archived === true),
    });
  });
};

export const getArchivedByAssignee = async (uid) => {
  const q = query(
    collection(db, "people"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.archived === true);
};

export const getPeopleByRole = async (role, teamId) => {
  const q = query(
    collection(db, "people"),
    where("teamId", "==", teamId),
    where("roles", "array-contains", role),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.archived);
};

export const getPeopleByMinistry = async (ministry, teamId) => {
  const q = query(collection(db, "people"), where("ministries", "array-contains", ministry));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.archived && (!teamId || p.teamId === teamId));
};

export const getPeopleByCG = async (cgId) => {
  const q = query(
    collection(db, "people"),
    where("cgId", "==", cgId),
    orderBy("name", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.archived);
};


// ── Core Teams ────────────────────────────────────────────────────────────────

export const addCoreTeam = async (data) => {
  const ref = await addDoc(collection(db, "coreTeams"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const deleteCoreTeam = async (id) => {
  await deleteDoc(doc(db, "coreTeams", id));
};

export const getCoreTeamsByTeam = async (teamId) => {
  const q = query(collection(db, "coreTeams"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── CGs ───────────────────────────────────────────────────────────────────────

export const addCG = async (data) => {
  const ref = await addDoc(collection(db, "cgs"), {
    ...data,
    members: data.members || [],
    leaders: data.leaders || [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getCG = async (id) => {
  const snap = await getDoc(doc(db, "cgs", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getAllCGs = async () => {
  const snap = await getDocs(collection(db, "cgs"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getCGsByTeam = async (teamId) => {
  const q = query(collection(db, "cgs"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateCG = async (id, data) => {
  await updateDoc(doc(db, "cgs", id), data);
};

export const deleteCG = async (id) => {
  await deleteDoc(doc(db, "cgs", id));
};

// ── Attendance ────────────────────────────────────────────────────────────────

export const markAttendance = async (cgId, date, present, absent) => {
  const dateStr = date.toISOString().split("T")[0];
  const q = query(
    collection(db, "attendance"),
    where("cgId", "==", cgId),
    where("dateStr", "==", dateStr)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { present, absent, updatedAt: serverTimestamp() });
    return snap.docs[0].id;
  }
  const ref = await addDoc(collection(db, "attendance"), {
    cgId,
    dateStr,
    date: Timestamp.fromDate(date),
    present,
    absent,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

// ── Meetups ───────────────────────────────────────────────────────────────────

export const addMeetup = async (data) => {
  const meetupDate = new Date(data.date);
  const ref = await addDoc(collection(db, "meetups"), {
    ...data,
    date: Timestamp.fromDate(meetupDate),
    completed: meetupDate < new Date() ? true : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const getMeetupsByPerson = async (personId) => {
  const q = query(collection(db, "meetups"), where("personId", "==", personId));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs.sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return db_ - da;
  });
};

export const getMeetup = async (id) => {
  const snap = await getDoc(doc(db, "meetups", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// `since`/`until` bound the read — without them this scans every meetup the user
// has ever created. Callers that only render recent/upcoming should always pass one.
export const getMeetupsByAssignee = async (uid, { since, until } = {}) => {
  const q = query(
    collection(db, "meetups"),
    where("assignedTo", "==", uid),
    ...(since ? [where("date", ">=", Timestamp.fromDate(since))] : []),
    ...(until ? [where("date", "<", Timestamp.fromDate(until))] : []),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getMeetupsForMonth = (uid, year, month) =>
  getMeetupsByAssignee(uid, {
    since: new Date(year, month, 1),
    until: new Date(year, month + 1, 1),
  });

// Server-side count — avoids downloading every meetup just to show a stat.
export const countCompletedMeetups = async (uid, since) => {
  const q = query(
    collection(db, "meetups"),
    where("assignedTo", "==", uid),
    where("completed", "==", true),
    ...(since ? [where("date", ">=", Timestamp.fromDate(since))] : [])
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
};

export const updateMeetup = async (id, data) => {
  await updateDoc(doc(db, "meetups", id), {
    ...data,
    ...(data.date ? { date: Timestamp.fromDate(new Date(data.date)) } : {}),
    updatedAt: serverTimestamp(),
  });
};

export const deleteMeetup = async (id) => {
  await deleteDoc(doc(db, "meetups", id));
};

// Whole-team meetups inside a window — the weekly report needs everyone's, not
// just the signed-in user's. Always bounded; the report only ever asks for a week.
export const getMeetupsByTeam = async (teamId, { since, until } = {}) => {
  const q = query(
    collection(db, "meetups"),
    where("teamId", "==", teamId),
    ...(since ? [where("date", ">=", Timestamp.fromDate(since))] : []),
    ...(until ? [where("date", "<", Timestamp.fromDate(until))] : []),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Testimonies ───────────────────────────────────────────────────────────────
// Free-standing records: a testimony can name a person or nobody at all, so it
// lives in its own collection rather than as a field on `people`.

export const addTestimony = async (data) => {
  const ref = await addDoc(collection(db, "testimonies"), {
    ...data,
    date: Timestamp.fromDate(new Date(data.date)),
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getTestimoniesByTeam = async (teamId, { since, until } = {}) => {
  const q = query(
    collection(db, "testimonies"),
    where("teamId", "==", teamId),
    ...(since ? [where("date", ">=", Timestamp.fromDate(since))] : []),
    ...(until ? [where("date", "<", Timestamp.fromDate(until))] : []),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateTestimony = async (id, data) => {
  await updateDoc(doc(db, "testimonies", id), {
    ...data,
    ...(data.date ? { date: Timestamp.fromDate(new Date(data.date)) } : {}),
  });
};

export const deleteTestimony = async (id) => {
  await deleteDoc(doc(db, "testimonies", id));
};

export const getPeopleByAssigneeForMonth = async (uid, year, month) => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const q = query(
    collection(db, "people"),
    where("assignedTo", "==", uid),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Attendance ────────────────────────────────────────────────────────────────

export const getAttendanceByCG = async (cgId) => {
  const q = query(
    collection(db, "attendance"),
    where("cgId", "==", cgId),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Weekly report overrides ───────────────────────────────────────────────────
// One document per team per week. `weekStart` is the Monday as a local
// "YYYY-MM-DD" string (toDateInput), never toISOString: in UTC+8 that would name
// the Sunday before.

const reportOverridesRef = (teamId, weekStart) => doc(db, "reportOverrides", `${teamId}_${weekStart}`);

export const getReportOverrides = async (teamId, weekStart) => {
  const snap = await getDoc(reportOverridesRef(teamId, weekStart));
  return snap.exists() ? snap.data().cells || {} : {};
};

// Saves inside a transaction: re-reads the cells as they are now, lets `merge`
// apply this person's changes on top, and writes the result. Two people saving
// the same week keep each other's cells. Still a whole-map write (not a merging
// one), so cells `merge` drops are really removed. Returns the saved cells.
export const saveReportOverrides = async (teamId, weekStart, merge, uid) => {
  const ref = reportOverridesRef(teamId, weekStart);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cells = merge(snap.exists() ? snap.data().cells || {} : {});
    tx.set(ref, { teamId, weekStart, cells, updatedBy: uid, updatedAt: serverTimestamp() });
    return cells;
  });
};

// ── Events and their attendance ───────────────────────────────────────────────
//
// `events` holds one document per event; a weekly event is still one document.
// `eventAttendance` holds one document per event per date, with the fixed id
// `${eventId}_${dateStr}`, so saving the same date twice updates one record.
// It holds who came (`present`, `walkIns`), who was invited (`invited`), and
// `marked`: false while only invites are saved, true once attendance is taken.
// Dates are local "YYYY-MM-DD" strings (toDateInput), never toISOString.

const BATCH_LIMIT = 500;

const eventFields = (data) => ({
  name: data.name.trim(),
  isService: !!data.isService,
  recurrence: data.recurrence === "weekly" ? "weekly" : "none",
  dateStr: data.dateStr,
  time: data.time || "",
  location: (data.location || "").trim(),
});

export const createEvent = async (teamId, data, uid) => {
  const ref = await addDoc(collection(db, "events"), {
    ...eventFields(data),
    teamId,
    endedOn: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getEvent = async (id) => {
  const snap = await getDoc(doc(db, "events", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getEventsByTeam = async (teamId) => {
  const snap = await getDocs(query(collection(db, "events"), where("teamId", "==", teamId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const attendanceDocs = async (...filters) => {
  const snap = await getDocs(query(collection(db, "eventAttendance"), ...filters));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const newestFirst = (records) => records.sort((a, b) => (a.dateStr < b.dateStr ? 1 : a.dateStr > b.dateStr ? -1 : 0));

export const getAttendanceByEvent = async (eventId) =>
  newestFirst(await attendanceDocs(where("eventId", "==", eventId)));

// A team's records with fromStr <= dateStr <= toStr, newest first. Bounded so
// the Events page reads only the weeks it shows, not the team's whole history.
export const getAttendanceByTeam = async (teamId, fromStr, toStr) =>
  newestFirst(await attendanceDocs(
    where("teamId", "==", teamId),
    where("dateStr", ">=", fromStr),
    where("dateStr", "<=", toStr),
  ));

// Every record one person was ticked at or invited to, newest first. Two
// single-field queries, because Firestore allows only one array-contains per
// query, and sorted here so neither needs a composite index. A record in both
// comes back once.
export const getEventsForPerson = async (personId) => {
  const [came, invited] = await Promise.all([
    attendanceDocs(where("present", "array-contains", personId)),
    attendanceDocs(where("invited", "array-contains", personId)),
  ]);
  const byId = new Map([...came, ...invited].map((r) => [r.id, r]));
  return newestFirst([...byId.values()]);
};

// Sunday-service records with fromStr <= dateStr < toStr, for the weekly report.
export const getServiceAttendance = async (teamId, fromStr, toStr) =>
  attendanceDocs(
    where("teamId", "==", teamId),
    where("isService", "==", true),
    where("dateStr", ">=", fromStr),
    where("dateStr", "<", toStr),
  );

export const getEventAttendance = async (eventId, dateStr) => {
  const snap = await getDoc(doc(db, "eventAttendance", attendanceId(eventId, dateStr)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Thrown by saveEventAttendance when the event was deleted in the meantime.
export const EVENT_GONE = "event-deleted";

// Saves inside a transaction: re-reads the record as it is now and applies only
// what this person changed (see mergeAttendance), so two people marking the
// same service keep each other's ticks and invites. A save of invites alone
// leaves the record `marked: false` until someone takes attendance. The event is re-read too, so the copied
// name and "Sunday service" switch are current, and a save cannot recreate a
// record for an event someone has just deleted. Returns the saved record.
export const saveEventAttendance = async (event, dateStr, changes, uid) => {
  const eventRef = doc(db, "events", event.id);
  const ref = doc(db, "eventAttendance", attendanceId(event.id, dateStr));
  return runTransaction(db, async (tx) => {
    const [eventSnap, snap] = await Promise.all([tx.get(eventRef), tx.get(ref)]);
    if (!eventSnap.exists()) throw new Error(EVENT_GONE);
    const current = eventSnap.data();
    const merged = mergeAttendance(snap.exists() ? snap.data() : null, changes);
    const record = {
      eventId: event.id,
      teamId: current.teamId,
      dateStr,
      isService: !!current.isService,
      eventName: current.name,
      ...merged,
    };
    tx.set(ref, { ...record, updatedBy: uid, updatedAt: serverTimestamp() });
    return { id: ref.id, ...record };
  });
};

// Runs `apply(batch, ref)` over the refs in groups Firestore accepts.
const inBatches = async (refs, apply) => {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => apply(batch, ref));
    await batch.commit();
  }
};

const attendanceRefs = async (eventId) => {
  const snap = await getDocs(query(collection(db, "eventAttendance"), where("eventId", "==", eventId)));
  return snap.docs.map((d) => d.ref);
};

// The name and the "Sunday service" switch are copied onto every attendance
// record, so changing either rewrites those copies. The copies go first and the
// event last: if anything fails halfway, the event still has its old values,
// so saving the edit again (even after a reload) redoes the copies.
export const updateEvent = async (event, data) => {
  const fields = eventFields(data);
  if (fields.name !== event.name || fields.isService !== !!event.isService) {
    await inBatches(await attendanceRefs(event.id), (batch, ref) =>
      batch.update(ref, { eventName: fields.name, isService: fields.isService }));
  }
  await updateDoc(doc(db, "events", event.id), fields);
  return { ...event, ...fields };
};

// Stops a weekly event after `endedOn` (which itself still counts). Everything
// already recorded is kept.
export const stopEvent = async (id, endedOn) => {
  await updateDoc(doc(db, "events", id), { endedOn });
};

export const resumeEvent = async (id) => {
  await updateDoc(doc(db, "events", id), { endedOn: null });
};

export const countEventAttendance = async (eventId) => {
  const snap = await getCountFromServer(query(collection(db, "eventAttendance"), where("eventId", "==", eventId)));
  return snap.data().count;
};

// Attendance first, the event last: if this fails halfway the event is still
// there and deleting it again finishes the job.
export const deleteEvent = async (id) => {
  await inBatches(await attendanceRefs(id), (batch, ref) => batch.delete(ref));
  await deleteDoc(doc(db, "events", id));
};
