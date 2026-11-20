"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { confirmLeave, useLeaveGuard } from "@/hooks/useLeaveGuard";
import { getPerson, updatePerson, getCGsByTeam, getUsersByTeam, getCoreTeamsByTeam, getMeetupsByPerson, getEventsForPerson } from "@/lib/firestore";
import { formatEventDay, isMarked } from "@/lib/events";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import { Avatar, Button, Card, Chip, Field, RoleTag, inputClass } from "@/components/ui";
import { FiAlertCircle, FiArchive, FiCalendar, FiCheck, FiMail, FiMinus, FiPlus, FiUserX } from "react-icons/fi";
import { ContactHandle, ContactTypeTag } from "@/components/ContactActions";
import { CONTACT_TYPES, SOURCES, CONTACT_ROLES, MILESTONES } from "@/config/app";

export default function PersonView() {
  const { id } = useParams();
  const { loading: authLoading, profile } = useRequireAuth();
  const router = useRouter();

  const [person, setPerson] = useState(null);
  const [cgs, setCgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [coreTeams, setCoreTeams] = useState([]);
  const [meetups, setMeetups] = useState([]);
  // Event records this person was ticked at or invited to, newest first. Null
  // while unknown or if the read failed.
  const [attended, setAttended] = useState(null);
  const [showAllAttended, setShowAllAttended] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Single unified form state across all sections
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!profile?.teamId) return;
    Promise.all([
      getPerson(id),
      getCGsByTeam(profile.teamId),
      getUsersByTeam(profile.teamId),
      getCoreTeamsByTeam(profile.teamId),
    ]).then(([p, c, u, ct]) => {
      setPerson(p);
      setForm(p);
      setCgs(c);
      setUsers(u);
      setCoreTeams(ct);
      setFetching(false);
    });
    getMeetupsByPerson(id).then(setMeetups).catch(() => setMeetups([]));
    getEventsForPerson(id).then(setAttended).catch(() => setAttended(null));
  }, [id, profile?.teamId]);

  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  // Leaving with unsaved edits asks first (menus, back link, closing the tab).
  const hasUnsaved = Boolean(
    person && form && Object.keys(form).some((k) => JSON.stringify(form[k]) !== JSON.stringify(person[k]))
  );
  useLeaveGuard(hasUnsaved);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await updatePerson(id, {
        name: form.name ?? null,
        contactType: form.contactType ?? null,
        contact: form.contact ?? null,
        source: form.source ?? null,
        age: form.age ?? null,
        address: form.address ?? null,
        metAt: form.metAt ?? null,
        description: form.description ?? null,
        roles: form.roles ?? [],
        ministries: form.ministries ?? [],
        teamId: profile?.teamId || form.teamId || "",
        createdAt: form.createdAt instanceof Date
          ? Timestamp.fromDate(form.createdAt)
          : (form.createdAt ?? null),
        gospelShared: form.gospelShared ?? false,
        prayed: form.prayed ?? false,
        saved: form.saved ?? false,
        milestones: form.milestones || {},
        progressRemarks: form.progressRemarks || "",
        followUpRemarks: form.followUpRemarks || "",
        // Always sent, so clearing the interval really clears it.
        followUpDays: parseInt(form.followUpDays) || null,
        scheduledFollowUpAt: form.scheduledFollowUpAt instanceof Date
          ? Timestamp.fromDate(form.scheduledFollowUpAt)
          : (form.scheduledFollowUpAt ?? null),
        cgId: form.cgId ?? null,
        assignedTo: form.assignedTo ?? null,
        assignedToName: form.assignedToName ?? null,
      });
      setPerson((p) => ({ ...p, ...form }));
      showSaved();
    } catch { setError("Failed to save."); }
    setSaving(false);
  };

  const handleRemoveFromCG = async () => {
    setSaving(true);
    try {
      await updatePerson(id, { cgId: "" });
      setPerson((p) => ({ ...p, cgId: "" }));
      setForm((f) => ({ ...f, cgId: "" }));
      showSaved();
    } catch { setError("Failed to remove from CG."); }
    setSaving(false);
  };

  const handleArchive = async () => {
    if (!confirm(`Archive ${person.name}?`)) return;
    setSaving(true);
    try {
      await updatePerson(id, { archived: true });
      router.push("/people");
    } catch { setError("Failed to archive."); }
    setSaving(false);
  };

  const handleUnarchive = async () => {
    setSaving(true);
    try {
      await updatePerson(id, { archived: false });
      setPerson((p) => ({ ...p, archived: false }));
      setForm((f) => ({ ...f, archived: false }));
      showSaved();
    } catch { setError("Failed to unarchive."); }
    setSaving(false);
  };

  if (authLoading || fetching) return <Spinner fullScreen />;
  if (!person || !form) {
    return (
      <PageShell title={<span className="sr-only">Person not found</span>} backHref="/people" backLabel="My people">
        <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-line-soft">
          <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <FiUserX size={26} />
          </span>
          <p className="mt-1.5 text-[17px] font-bold tracking-[-0.015em] text-ink">Person not found.</p>
        </div>
      </PageShell>
    );
  }

  // Anything in the form that no longer matches what was last loaded or saved.
  const dirty = hasUnsaved;
  const discard = () => setForm(person);

  const roles = form.roles || [];
  const isCoreTeam = roles.includes("Core Team");
  const milestonesDone = MILESTONES.filter((m) => form.milestones?.[m]).length;
  const archiveLabel = person.archived ? "Unarchive" : "Archive";
  const onArchive = person.archived ? handleUnarchive : handleArchive;
  const saveLabel = saving ? "Saving…" : "Save changes";
  const scheduleMeeting = () => confirmLeave() && router.push(`/calendar?scheduleFor=${id}&name=${encodeURIComponent(person.name)}`);

  // Heading subline: how to reach them, then when and where they were met.
  const now = new Date();
  const metDate = toDate(person.createdAt);
  const met = metDate
    ? `Met ${shortDate(metDate, now)}${person.metAt ? ` at ${person.metAt}` : ""}`
    : person.metAt ? `Met at ${person.metAt}` : "";
  const hasContactLine = Boolean(person.contactType || person.contact || met);
  const lastFollowedUp = toDate(form.lastFollowedUpAt);

  return (
    <PageShell
      title={
        // On a phone the heading always takes the whole row (w-screen capped at
        // the row width), so the gap under it is the same for every name.
        <span className="flex items-center gap-3.5 max-md:w-screen max-md:max-w-full md:gap-4">
          <Avatar
            name={person.name}
            size="lg"
            className="font-bold! tracking-normal md:h-16 md:w-16 md:rounded-[20px] md:text-[22px]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-[26px] leading-[1.15] md:gap-2.5 md:text-[32px]">
              {person.name}
              {(person.roles || []).map((r) => <RoleTag key={r} role={r} className={TAG_SIZE} />)}
              {person.archived && (
                <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full bg-line-soft px-2.5 text-[12.5px] font-semibold text-ink-2 ${TAG_SIZE}`}>
                  Archived
                </span>
              )}
            </span>
            {hasContactLine && (
              <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-normal leading-normal tracking-normal text-muted md:gap-x-2.5 md:text-[15px]">
                <ContactTypeTag contactType={person.contactType} />
                <ContactHandle contactType={person.contactType} contact={person.contact} />
                {met && <span className="basis-full md:basis-auto">{met}</span>}
              </span>
            )}
          </span>
        </span>
      }
      backHref="/people"
      backLabel="My people"
      rightAction={
        <div className="hidden flex-wrap items-center gap-2.5 md:flex">
          {person.archived ? (
            <Button variant="outline" onClick={onArchive} disabled={saving}>{archiveLabel}</Button>
          ) : (
            <Button variant="outline" className="w-11 px-0!" onClick={onArchive} disabled={saving} title="Archive" aria-label={`Archive ${person.name}`}>
              <FiArchive size={18} aria-hidden="true" />
            </Button>
          )}
          <Button variant={dirty ? "primary" : "outline"} className="px-5" onClick={handleSave} disabled={saving || !dirty} aria-busy={saving}>
            {dirty || saving ? saveLabel : "Saved"}
          </Button>
        </div>
      }
      bottomBar={
        <Button size="lg" className="flex-1" onClick={handleSave} disabled={saving} aria-busy={saving}>{saveLabel}</Button>
      }
    >
      {/* Phone only: the two quick actions under the heading. The negative margin
          takes back the empty second row of the shell's heading. */}
      <div className="-mt-3.5 mb-3.5 flex gap-2 md:hidden">
        <Button variant="soft" className="flex-1" onClick={scheduleMeeting}>
          <FiPlus size={17} strokeWidth={2.2} aria-hidden="true" /> Schedule meeting
        </Button>
      </div>

      {(error || saved) && (
        <div className="sticky top-3 z-30 mb-3.5 flex flex-col gap-2 md:mb-[18px]">
          {error && (
            <Notice role="alert" className="bg-danger-soft text-danger-ink">
              <FiAlertCircle size={18} className="shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </Notice>
          )}
          {saved && (
            <Notice role="status" className="bg-ok-soft text-ok-ink">
              <FiCheck size={18} className="shrink-0" aria-hidden="true" />
              <span>Changes saved.</span>
            </Notice>
          )}
        </div>
      )}

      {/* Two columns on a laptop. On a phone the cards are one list, in the order set by order-N. */}
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-start md:gap-4">
        <div className="contents md:flex md:min-w-0 md:flex-[1.5_1_400px] md:flex-col md:gap-4">
          <Card className="order-5 flex flex-col gap-3 md:order-none md:gap-3.5 md:px-[22px] md:pb-[22px]">
            <SectionTitle>Details</SectionTitle>
            {/* Laptop reads in source order. The phone board has its own order: order-N. */}
            <div className="grid grid-cols-2 gap-3 md:gap-3.5">
              <TextField className="order-1 col-span-2 md:order-none md:col-span-1" label="Name" value={form.name} onChange={(v) => set("name", v)} />
              <TextField className="order-5 md:order-none" label="Age" type="number" value={form.age || ""} onChange={(v) => set("age", v ? parseInt(v) : null)} />
              <TextField className="order-2 md:order-none" label="Contact type" value={form.contactType} onChange={(v) => set("contactType", v)} select={CONTACT_TYPES} />
              <TextField className="order-3 md:order-none" label="Contact info" value={form.contact} onChange={(v) => set("contact", v)} />
              <TextField className="order-4 md:order-none" label="Source" value={form.source || ""} onChange={(v) => set("source", v)} select={SOURCES} />
              <TextField className="order-8 col-span-2 md:order-none md:col-span-1" label="Address" value={form.address || ""} onChange={(v) => set("address", v)} />
              <TextField
                className="order-6 md:order-none"
                label="Date met"
                type="date"
                value={form.createdAt?.toDate ? form.createdAt.toDate().toISOString().split("T")[0] : form.createdAt instanceof Date ? form.createdAt.toISOString().split("T")[0] : ""}
                onChange={(v) => set("createdAt", v ? new Date(v) : form.createdAt)}
              />
              <TextField className="order-7 md:order-none" label="Met at" value={form.metAt || ""} onChange={(v) => set("metAt", v)} />
              <TextField className="order-9 col-span-2 md:order-none" label="Remarks" value={form.description || ""} onChange={(v) => set("description", v)} textarea />
            </div>
          </Card>

          <Card tone="soft" className="order-1 flex flex-col gap-3 md:order-none md:gap-3.5 md:px-[22px] md:pb-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-2 md:gap-2.5">
              <SectionTitle>Follow-up</SectionTitle>
              {lastFollowedUp && (
                <p className="text-[13px] text-ink-2">
                  Last followed up{" "}
                  <span className="md:hidden">
                    {lastFollowedUp.toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </span>
                  <span className="hidden md:inline">{shortDate(lastFollowedUp, now)}</span>
                </p>
              )}
            </div>
            <TextField
              label="Follow-up remarks"
              value={form.followUpRemarks || ""}
              onChange={(v) => set("followUpRemarks", v)}
              placeholder="What to follow up on"
              textarea
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3 md:gap-3.5">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="scheduled-follow-up" className="text-sm font-semibold text-ink">Scheduled follow-up</label>
                <input
                  id="scheduled-follow-up"
                  type="date"
                  value={
                    form.scheduledFollowUpAt instanceof Date
                      ? form.scheduledFollowUpAt.toISOString().split("T")[0]
                      : form.scheduledFollowUpAt?.toDate
                      ? form.scheduledFollowUpAt.toDate().toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => set("scheduledFollowUpAt", e.target.value ? new Date(e.target.value) : null)}
                  className={`${CONTROL} min-w-0 max-md:px-2.5`}
                />
              </div>
              <TextField
                label="Then every (days)"
                type="number"
                value={form.followUpDays ?? ""}
                onChange={(v) => set("followUpDays", v === "" ? null : parseInt(v) || null)}
                placeholder="None"
              />
            </div>
            {/* The laptop board has no hint line, so there this row is only the Clear button. */}
            <div className={`-mt-1.5 min-h-11 items-center justify-between gap-2.5 ${form.scheduledFollowUpAt ? "flex" : "flex md:hidden"}`}>
              <p className="text-[13px] text-ink-2 md:hidden">Optional. Set a date to be reminded to follow up.</p>
              {form.scheduledFollowUpAt && (
                <button
                  type="button"
                  onClick={() => set("scheduledFollowUpAt", null)}
                  className="h-11 shrink-0 px-2 text-sm font-semibold text-brand hover:text-navy md:ml-auto"
                >
                  Clear
                </button>
              )}
            </div>
          </Card>

          <Card className="order-2 flex flex-col gap-1 pb-2 md:order-none md:gap-1.5 md:px-[22px] md:pb-3">
            <div className="flex items-center justify-between gap-2.5">
              <SectionTitle>Meetings</SectionTitle>
              <div className="hidden md:block">
                <Button variant="soft" onClick={scheduleMeeting}>
                  <FiPlus size={17} strokeWidth={2.2} aria-hidden="true" /> Schedule meeting
                </Button>
              </div>
            </div>
            {meetups.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 pb-[22px] pt-5 text-center">
                <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
                  <FiCalendar size={26} />
                </span>
                <p className="mt-1.5 text-[17px] font-bold tracking-[-0.015em] text-ink">No meetings yet</p>
                <p className="text-sm text-muted">Schedule one above.</p>
              </div>
            ) : (
              meetups.map((m) => {
                const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                const isPast = d < now;
                const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
                const day = d.toDateString() === now.toDateString()
                  ? "Today"
                  : d.getFullYear() === now.getFullYear()
                  ? d.toLocaleDateString("en-GB", { weekday: "long" })
                  : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                const where = [m.location, m.notes].filter(Boolean).join(" · ");
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => confirmLeave() && router.push(`/calendar?editMeetup=${m.id}`)}
                    className="-mx-2 flex min-h-15 items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-tint"
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[14px] leading-[1.1] ${
                        isPast ? "bg-fill text-ink" : "bg-navy text-white"
                      }`}
                    >
                      <span className={`text-[11.5px] font-semibold uppercase ${isPast ? "text-muted" : "text-nav-muted"}`}>
                        {d.toLocaleDateString("en-GB", { month: "short" })}
                      </span>
                      <span className="text-base font-bold">{d.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{day}, {time}</span>
                      {where && (
                        <span className="block truncate text-[13px] text-muted md:overflow-visible md:whitespace-normal">{where}</span>
                      )}
                      {m.outcomeNotes && (
                        <span className="my-1.5 block whitespace-pre-wrap border-l-2 border-ok-ink pl-2 text-[13px] italic text-ink-2">
                          {m.outcomeNotes}
                        </span>
                      )}
                    </span>
                    {m.completed === true && <MeetingState dot="bg-ok-ink">Done</MeetingState>}
                    {m.completed === false && <MeetingState dot="bg-warn" className="text-warn-ink">Missed</MeetingState>}
                    {m.completed == null && !isPast && <MeetingState dot="bg-role-contact-ink">Upcoming</MeetingState>}
                  </button>
                );
              })
            )}
          </Card>

          {attended && attended.length > 0 && (
            <Card className="order-2 flex flex-col gap-1 pb-2 md:order-none md:px-[22px] md:pb-3">
              <div className="flex items-center justify-between gap-2.5">
                <SectionTitle>
                  Events{" "}
                  <span className="font-medium text-muted">
                    {[
                      `${attended.filter((r) => (r.present || []).includes(id)).length} came`,
                      ...(attended.some((r) => (r.invited || []).includes(id))
                        ? [`${attended.filter((r) => (r.invited || []).includes(id)).length} invited`]
                        : []),
                    ].join(" · ")}
                  </span>
                </SectionTitle>
                <span className="text-[13px] text-muted">Newest first</span>
              </div>
              {(showAllAttended ? attended : attended.slice(0, 5)).map((rec) => {
                const came = (rec.present || []).includes(id);
                const invited = (rec.invited || []).includes(id);
                let status;
                let Icon = FiCheck;
                let tone = "bg-ok-soft text-ok-ink";
                let ink = "text-ok-ink";
                if (came) {
                  status = invited ? "Invited · came" : "Came";
                } else if (isMarked(rec)) {
                  status = "Invited · didn't come";
                  Icon = FiMinus;
                  tone = "bg-fill text-muted";
                  ink = "text-muted";
                } else {
                  status = "Invited";
                  Icon = FiMail;
                  tone = "bg-brand-soft text-brand";
                  ink = "text-brand-ink";
                }
                return (
                  <Link
                    key={rec.id}
                    href={`/events/${rec.eventId}?date=${rec.dateStr}`}
                    onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }}
                    className="-mx-2 flex min-h-[52px] items-center gap-3 rounded-2xl px-2 py-1 text-ink transition-colors hover:bg-tint"
                  >
                    <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                      <Icon size={17} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{rec.eventName}</span>
                      <span className={`block text-[13px] ${ink}`}>{status}</span>
                    </span>
                    <span className="shrink-0 text-sm text-muted">{formatEventDay(rec.dateStr)}</span>
                  </Link>
                );
              })}
              {attended.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllAttended((v) => !v)}
                  aria-expanded={showAllAttended}
                  className="inline-flex min-h-11 items-center self-start font-semibold text-brand hover:text-navy"
                >
                  {showAllAttended ? "Show fewer" : `Show all ${attended.length}`}
                </button>
              )}
            </Card>
          )}
        </div>

        <div className="contents md:flex md:min-w-0 md:flex-[1_1_300px] md:flex-col md:gap-4">
          <Card className="order-6 flex flex-col gap-3 md:order-none md:gap-3.5 md:px-[22px]">
            <SectionTitle>Roles</SectionTitle>
            <div role="group" aria-label="Role" className="flex flex-wrap gap-2">
              {CONTACT_ROLES.map((r) => {
                const on = roles.includes(r);
                return (
                  <Chip
                    key={r}
                    active={on}
                    className="inline-flex items-center gap-1.5"
                    onClick={() => {
                      const cur = form.roles || [];
                      if (cur.includes(r)) {
                        set("roles", cur.filter((x) => x !== r));
                      } else {
                        const exclusive = ["Contact", "Disciple"];
                        set("roles", exclusive.includes(r)
                          ? [...cur.filter((x) => !exclusive.includes(x)), r]
                          : [...cur, r]);
                      }
                    }}
                  >
                    {on && <FiCheck size={15} strokeWidth={2.6} aria-hidden="true" />}
                    {r}
                  </Chip>
                );
              })}
            </div>
            <ToggleRow
              label="Core Team member"
              strong
              checked={isCoreTeam}
              onToggle={() => {
                const isCT = (form.roles || []).includes("Core Team");
                const newRoles = isCT
                  ? (form.roles || []).filter((r) => r !== "Core Team")
                  : [...(form.roles || []), "Core Team"];
                if (isCT) {
                  setForm((f) => ({ ...f, roles: newRoles, ministries: [] }));
                } else {
                  set("roles", newRoles);
                }
              }}
            />
            {isCoreTeam && (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-muted">Ministry team</p>
                <div role="group" aria-label="Ministry team" className="flex flex-wrap gap-2">
                  {coreTeams.map((t) => {
                    const m = t.name;
                    const on = (form.ministries || []).includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const cur = form.ministries || [];
                          set("ministries", cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]);
                        }}
                        className={`h-11 rounded-full px-4 text-sm font-semibold transition-colors ${SMALL_CHIP} ${
                          on ? "bg-warn-soft text-warn-ink" : "bg-fill text-ink hover:bg-line-soft"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card className="order-3 flex flex-col gap-0.5 pb-2.5 md:order-none md:gap-1 md:px-[22px] md:pb-5">
            <SectionTitle className="mb-1 md:mb-1.5">Status</SectionTitle>
            {[
              { key: "gospelShared", label: "Gospel shared" },
              { key: "prayed", label: "Prayed" },
              { key: "saved", label: "Saved" },
            ].map(({ key, label }) => (
              <ToggleRow
                key={key}
                label={label}
                checked={!!form[key]}
                onToggle={() => set(key, !form[key])}
              />
            ))}
          </Card>

          <Card className="order-4 flex flex-col gap-3 md:order-none md:px-[22px]">
            <div className="flex items-center justify-between gap-2.5">
              <SectionTitle>Milestones</SectionTitle>
              <p className="text-[13px] text-muted">{milestonesDone} of {MILESTONES.length}</p>
            </div>
            <div
              role="progressbar"
              aria-label="Milestones done"
              aria-valuenow={milestonesDone}
              aria-valuemin={0}
              aria-valuemax={MILESTONES.length}
              className="h-2 overflow-hidden rounded-full bg-line-soft"
            >
              <div className="h-2 rounded-full bg-brand" style={{ width: `${(milestonesDone / MILESTONES.length) * 100}%` }} />
            </div>
            <div role="group" aria-label="Milestones" className="flex flex-wrap gap-2">
              {MILESTONES.map((m) => (
                <Chip
                  key={m}
                  active={!!form.milestones?.[m]}
                  className={SMALL_CHIP}
                  onClick={() => set("milestones", { ...form.milestones, [m]: !form.milestones?.[m] })}
                >
                  {m}
                </Chip>
              ))}
            </div>
            <TextField
              label="Progress remarks"
              value={form.progressRemarks || ""}
              onChange={(v) => set("progressRemarks", v)}
              placeholder="Enter progress notes"
              textarea
              rows={2}
            />
          </Card>

          <Card className="order-7 flex flex-col gap-3 md:order-none md:gap-3.5 md:px-[22px] md:pb-[22px]">
            <SectionTitle>Assignment</SectionTitle>
            <TextField
              label="Connect Group"
              value={form.cgId || ""}
              onChange={(v) => set("cgId", v)}
              select={cgs.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="No CG"
            />
            <TextField
              label="Assigned to (POC)"
              value={form.assignedTo || ""}
              onChange={(v) => {
                const u = users.find((u) => u.id === v);
                setForm((f) => ({ ...f, assignedTo: v, assignedToName: u?.name || "" }));
              }}
              select={users.map((u) => ({ value: u.id, label: u.name }))}
            />
            {form.cgId && (
              <Button variant="outline" className="w-full text-warn-ink!" onClick={handleRemoveFromCG} disabled={saving}>
                Remove from CG
              </Button>
            )}
          </Card>
        </div>
      </div>

      {/* Phone only: the laptop has this button in the heading row. */}
      {/* Laptop: edits bring up a bar that stays in view until saved or discarded. */}
      {dirty && (
        <div role="status" className="sticky bottom-5 z-30 mt-5 hidden items-center gap-3 rounded-2xl bg-navy py-2.5 pl-5 pr-2.5 text-white shadow-float md:flex">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-warn" />
          <span className="flex-1 font-semibold">You have unsaved changes</span>
          <button type="button" onClick={discard} disabled={saving} className="h-11 rounded-[14px] px-4 font-semibold text-nav-muted transition-colors hover:bg-white/10 hover:text-white">
            Discard
          </button>
          <button type="button" onClick={handleSave} disabled={saving} aria-busy={saving} className="h-11 rounded-[14px] bg-white px-5 font-semibold text-navy transition-colors hover:bg-brand-soft disabled:opacity-60">
            {saveLabel}
          </button>
        </div>
      )}

      <Button variant="danger" size="lg" className="mt-5 w-full md:hidden" onClick={onArchive} disabled={saving}>
        <FiArchive size={19} aria-hidden="true" /> {archiveLabel} {person.name}
      </Button>
    </PageShell>
  );
}

// ── Helpers and sub-components ────────────────────────────────────────────────

// Inputs are 48px tall with 16px text on a phone, 44px with 15px text on a laptop.
const CONTROL = `${inputClass} font-normal md:min-h-11 md:text-[15px]`;
// Ministry and milestone chips are 38px tall on a laptop, 44px on a phone.
const SMALL_CHIP = "md:h-[38px] md:px-3.5";
// Tags beside the name are a step larger on a laptop.
const TAG_SIZE = "tracking-normal md:h-[26px] md:px-3 md:text-[13px]";

// Firestore Timestamp, Date or date string to a valid Date, else null.
function toDate(v) {
  if (!v) return null;
  const d = v.toDate ? v.toDate() : v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "14 Sep", with the year only when it is not this year.
function shortDate(d, now) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function SectionTitle({ className = "", children }) {
  return <h2 className={`text-[17px] font-bold tracking-[-0.015em] text-ink ${className}`}>{children}</h2>;
}

function Notice({ role, className, children }) {
  return (
    <div role={role} className={`flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-sm font-medium ${className}`}>
      {children}
    </div>
  );
}

// One labelled control: text input, select or textarea.
function TextField({ label, value, onChange, type = "text", select, placeholder, textarea, rows = 3, className = "" }) {
  return (
    <Field label={label} className={`min-w-0 ${className}`}>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={`${CONTROL} resize-y py-2.5`} />
      ) : select ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${CONTROL} max-md:px-2.5 md:px-3`}>
          {placeholder && <option value="">{placeholder}</option>}
          {select.map((o) =>
            typeof o === "string"
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.value} value={o.value}>{o.label}</option>
          )}
        </select>
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${CONTROL} ${type === "date" ? "max-md:px-2.5" : ""}`}
        />
      )}
    </Field>
  );
}

// A label with an on/off switch. The track is 28px tall; the button around it
// is 44px tall so it is easy to hit.
function ToggleRow({ label, checked, onToggle, strong = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "min-h-11" : "min-h-12 md:min-h-11"}`}>
      <span className={strong ? "font-semibold text-ink" : "font-medium text-ink"}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className="inline-flex h-11 w-13 shrink-0 items-center px-[3px] md:w-12 md:px-0"
      >
        <span
          aria-hidden="true"
          className={`flex h-7 w-full items-center rounded-full p-[3px] transition-colors ${
            checked ? "justify-end bg-brand" : "justify-start bg-muted"
          }`}
        >
          <span className="h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgb(20_30_60/0.25)]" />
        </span>
      </button>
    </div>
  );
}

function MeetingState({ dot, className = "", children }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-ink ${className}`}>
      <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${dot}`} />
      {children}
    </span>
  );
}
