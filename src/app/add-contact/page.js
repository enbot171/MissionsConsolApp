"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { addPerson, getCGsByTeam, getCoreTeamsByTeam } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { Button, Chip, Field } from "@/components/ui";
import { CONTACT_TYPES, SOURCES, CONTACT_ROLES } from "@/config/app";
import { FiAlertCircle, FiCheck } from "react-icons/fi";

const EXCLUSIVE_ROLES = ["Contact", "Disciple"];

const FORM_ID = "add-contact-form";

const TABS = [["quick", "Quick"], ["full", "Full"], ["no-contact", "No contact"]];

const STATUS_FIELDS = [
  { key: "gospelShared", label: "Gospel shared" },
  { key: "prayed", label: "Prayed" },
  { key: "saved", label: "Saved" },
];

export default function AddContact() {
  return (
    <Suspense>
      <AddContactInner />
    </Suspense>
  );
}

function AddContactInner() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCgId = searchParams.get("cgId") || "";
  const prefilledMinistry = searchParams.get("ministry") || "";

  const [cgs, setCgs] = useState([]);
  const [coreTeams, setCoreTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(prefilledCgId || prefilledMinistry ? "full" : "quick");


  const [form, setForm] = useState({
    name: "", contactType: "", contact: "", source: "",
    age: "", address: "", gospelShared: false, prayed: false, saved: false,
    cgId: prefilledCgId, metAt: "", description: "", progressRemarks: "", followUpRemarks: "",
    roles: prefilledMinistry ? ["Core Team"] : ["Contact"],
    ministries: prefilledMinistry ? [prefilledMinistry] : [],
    milestones: {},
    metOn: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!profile?.teamId) return;
    Promise.all([getCGsByTeam(profile.teamId), getCoreTeamsByTeam(profile.teamId)]).then(([c, ct]) => {
      setCgs(c);
      setCoreTeams(ct);
    });
  }, [profile?.teamId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRole = (r) => {
    const cur = form.roles;
    if (cur.includes(r)) {
      set("roles", cur.filter((x) => x !== r));
    } else {
      const next = EXCLUSIVE_ROLES.includes(r)
        ? [...cur.filter((x) => !EXCLUSIVE_ROLES.includes(x)), r]
        : [...cur, r];
      set("roles", next);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      if (tab === "no-contact") {
        if (!form.name.trim()) { setError("Name is required."); setSaving(false); return; }
        await addPerson({
          name: form.name.trim(),
          description: form.description,
          createdAt: form.metOn || null,
          gospelShared: form.gospelShared,
          prayed: form.prayed,
          saved: form.saved,
          noContact: true,
          archived: true,
          roles: [],
          ministries: [],
          milestones: {},
          assignedTo: user.uid,
          assignedToName: profile?.name || "",
          teamId: profile?.teamId || "",
        });
        router.push("/people");
        return;
      }
      if (!form.name.trim()) { setError("Name is required."); setSaving(false); return; }
      if (!form.contact.trim()) { setError("Contact info is required."); setSaving(false); return; }
      const id = await addPerson({
        ...form,
        age: form.age ? parseInt(form.age) : null,
        assignedTo: user.uid,
        assignedToName: profile?.name || "",
        teamId: profile?.teamId || "",
        createdAt: form.metOn || null,
      });
      router.push(`/person/${id}`);
    } catch { setError("Failed to save. Try again."); }
    setSaving(false);
  };

  if (loading) return null;

  const submitLabel = saving ? "Saving…" : tab === "no-contact" ? "Save (no contact)" : "Add contact";
  // The two "required" messages also show under their own field.
  const nameError = error === "Name is required." ? error : "";
  const contactError = error === "Contact info is required." ? error : "";
  const isCoreTeam = form.roles.includes("Core Team");

  // Phones give the name a full row above the grid; laptops keep it in the grid.
  const nameField = <TextField label="Name (required)" className="col-span-2 md:col-span-1" value={form.name} onChange={(v) => set("name", v)} placeholder="Full name" error={nameError} />;
  const contactTypeField = <TextField label="Contact type" value={form.contactType} onChange={(v) => set("contactType", v)} select={CONTACT_TYPES} placeholder="Select type" />;
  const contactField = <TextField label="Contact info (required)" value={form.contact} onChange={(v) => set("contact", v)} placeholder="Handle / number" error={contactError} />;
  const dateField = <TextField label="Date met" type="date" value={form.metOn} onChange={(v) => set("metOn", v)} />;
  const metAtField = <TextField label="Met at" value={form.metAt} onChange={(v) => set("metAt", v)} placeholder="Where you met" />;
  const remarksFields = (
    <>
      <TextField label="Remarks" value={form.description} onChange={(v) => set("description", v)} textarea placeholder="Notes" />
      <TextField label="Follow-up remarks" value={form.followUpRemarks} onChange={(v) => set("followUpRemarks", v)} textarea placeholder="What to follow up on" />
    </>
  );
  const statusPanel = (
    <Panel title="Status" tight>
      {STATUS_FIELDS.map(({ key, label }) => (
        <SwitchRow key={key} label={label} checked={form[key]} onToggle={() => set(key, !form[key])} />
      ))}
    </Panel>
  );

  return (
    <PageShell
      title="Add contact"
      backHref="/"
      backLabel="Home"
      rightAction={
        <span className="hidden md:flex">
          <Button type="submit" form={FORM_ID} disabled={saving} aria-busy={saving || undefined} className="px-5">{submitLabel}</Button>
        </span>
      }
      bottomBar={
        <Button type="submit" form={FORM_ID} size="lg" className="flex-1" disabled={saving} aria-busy={saving || undefined}>{submitLabel}</Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-3 md:gap-[18px]">

        {error && (
          <div role="alert" className="flex items-center gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger-ink">
            <FiAlertCircle size={18} className="shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab toggle */}
        <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-center">
          <div role="tablist" aria-label="Form type" className="flex gap-1 rounded-[14px] bg-fill p-1">
            {TABS.map(([val, label]) => (
              <button
                key={val}
                type="button"
                role="tab"
                aria-selected={tab === val}
                onClick={() => { setTab(val); setError(""); }}
                className={`h-10 flex-1 rounded-[10px] px-2 text-sm font-semibold transition-colors md:h-9 md:flex-none md:px-[18px] ${
                  tab === val ? "bg-white text-ink shadow-[0_1px_3px_rgb(20_30_60/0.12)]" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="hidden text-[13px] text-muted md:inline">
            Quick keeps to the essentials. No contact is for people you spoke to but did not get contact info from.
          </span>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:gap-4">

          {/* ── QUICK TAB ── */}
          {tab === "quick" && (
            <>
              <Details>
                <FieldGrid>
                  {nameField}
                  {contactTypeField}
                  {contactField}
                  {dateField}
                  {metAtField}
                </FieldGrid>
                {remarksFields}
              </Details>

              <Side>{statusPanel}</Side>
            </>
          )}

          {/* ── FULL TAB ── */}
          {tab === "full" && (
            <>
              <Details>
                <FieldGrid>
                  {nameField}
                  {contactTypeField}
                  {contactField}
                  <TextField label="Source" value={form.source} onChange={(v) => set("source", v)} select={SOURCES} placeholder="Select source" />
                  <TextField label="Age" type="number" value={form.age} onChange={(v) => set("age", v)} placeholder="Age" />
                  <TextField label="Address" value={form.address} onChange={(v) => set("address", v)} placeholder="Address" />
                  {dateField}
                  {metAtField}
                  <TextField label="CG" value={form.cgId} onChange={(v) => set("cgId", v)}
                    select={cgs.map((c) => ({ value: c.id, label: c.name }))} placeholder="No CG" />
                </FieldGrid>
                {remarksFields}
              </Details>

              <Side>
                {statusPanel}

                <Panel title="Role">
                  <div role="group" aria-label="Role" className="flex flex-wrap gap-2">
                    {CONTACT_ROLES.map((r) => (
                      <CheckChip key={r} label={r} active={form.roles.includes(r)} onToggle={() => toggleRole(r)} />
                    ))}
                  </div>
                </Panel>

                <Panel title="Core Team">
                  <SwitchRow
                    label="Core Team member"
                    strong
                    checked={isCoreTeam}
                    onToggle={() => {
                      const isCT = form.roles.includes("Core Team");
                      const newRoles = isCT
                        ? form.roles.filter((r) => r !== "Core Team")
                        : [...form.roles, "Core Team"];
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
                        {coreTeams.map((t) => (
                          <MinistryChip
                            key={t.id}
                            label={t.name}
                            active={form.ministries.includes(t.name)}
                            onToggle={() => {
                              const cur = form.ministries;
                              set("ministries", cur.includes(t.name) ? cur.filter((x) => x !== t.name) : [...cur, t.name]);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </Panel>
              </Side>
            </>
          )}

          {/* ── NO CONTACT TAB ── */}
          {tab === "no-contact" && (
            <>
              <Details hint="For people you spoke to but didn't get contact info from.">
                <FieldGrid>
                  {nameField}
                  {dateField}
                </FieldGrid>
                {remarksFields}
              </Details>

              <Side>{statusPanel}</Side>
            </>
          )}
        </div>
      </form>
    </PageShell>
  );
}

// The main fields: flat on phones, a card on laptops.
function Details({ hint, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 md:flex-[1.5_1_400px] md:gap-3.5 md:rounded-3xl md:bg-white md:px-[22px] md:pb-[22px] md:pt-5 md:shadow-card">
      <h2 className="hidden text-[17px] font-bold tracking-[-0.015em] md:block">Details</h2>
      {hint && <p className="text-[13px] text-muted md:-mt-2">{hint}</p>}
      {children}
    </section>
  );
}

function FieldGrid({ children }) {
  return <div className="grid grid-cols-2 items-start gap-3 md:gap-3.5">{children}</div>;
}

function Side({ children }) {
  return <div className="flex min-w-0 flex-col gap-3 md:flex-[1_1_300px] md:gap-4">{children}</div>;
}

// Tinted block on phones, white card on laptops. `tight` is the Status card,
// whose rows sit closer together than the other cards' contents.
function Panel({ title, tight = false, children }) {
  return (
    <section
      className={`flex flex-col rounded-[20px] bg-tint px-4 py-3 md:rounded-3xl md:bg-white md:px-[22px] md:py-5 md:shadow-card ${
        tight ? "md:gap-1" : "gap-3 md:gap-3.5"
      }`}
    >
      <h2 className={`text-[17px] font-bold tracking-[-0.015em] ${tight ? "mb-0.5 md:mb-1.5" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}

// Sized per board: 48px tall with 16px text on phones, 44px with 15px on laptops.
const CONTROL =
  "w-full min-w-0 rounded-[14px] bg-white text-base font-normal text-ink ring-1 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand md:text-[15px]";

function TextField({ label, value, onChange, type = "text", select, placeholder, textarea, error, className = "" }) {
  const control = `${CONTROL} ${error ? "ring-danger-ink" : "ring-line"}`;
  return (
    <Field label={label} error={error} className={`min-w-0 ${className}`}>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} className={`${control} resize-y px-3.5 py-2.5 md:min-h-[88px]`} />
      ) : select ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${control} h-12 pl-2.5 pr-10 md:h-11 md:pl-3`}>
          {placeholder && <option value="">{placeholder}</option>}
          {select.map((o) => typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={error ? true : undefined}
          className={`${control} h-12 md:h-11 ${type === "date" ? "px-3 md:px-3.5" : "px-3.5"}`} />
      )}
    </Field>
  );
}

// The whole row is the switch, so the label is as easy to hit as the track.
function SwitchRow({ label, checked, onToggle, strong = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left md:min-h-11"
    >
      <span className={strong ? "font-semibold" : "font-medium"}>{label}</span>
      <span
        aria-hidden="true"
        className={`flex h-7 w-[46px] shrink-0 rounded-full p-[3px] transition-colors md:w-12 ${checked ? "justify-end bg-brand" : "justify-start bg-muted/70"}`}
      >
        <span className="h-5.5 w-5.5 rounded-full bg-white shadow-[0_1px_3px_rgb(20_30_60/0.25)]" />
      </span>
    </button>
  );
}

function CheckChip({ label, active, onToggle }) {
  return (
    <Chip active={active} onClick={onToggle} className="inline-flex items-center gap-1.5">
      {active && <FiCheck size={15} strokeWidth={2.6} aria-hidden="true" />}
      {label}
    </Chip>
  );
}

// Ministry teams are the smaller, warm-tinted chips on the board.
function MinistryChip({ label, active, onToggle }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`h-[38px] rounded-full px-3.5 text-sm font-semibold transition-colors ${
        active ? "bg-warn-soft text-warn-ink" : "bg-fill text-ink hover:bg-line-soft"
      }`}
    >
      {label}
    </button>
  );
}
