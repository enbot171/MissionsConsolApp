import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

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

export const getAttendanceByCG = async (cgId) => {
  const q = query(
    collection(db, "attendance"),
    where("cgId", "==", cgId),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
