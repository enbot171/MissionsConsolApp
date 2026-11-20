"use client";

import { FiArchive, FiCheck, FiEdit3 } from "react-icons/fi";
import ContactLine from "@/components/ContactActions";
import { Avatar, Button, Field, RoleTag, inputClass } from "@/components/ui";

const spinnerClass = "h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent";

// The form controls in the log panel are 44px tall on the board; the shared
// input class is 48px, so the height is forced here.
const panelInputClass = `${inputClass} min-h-11! font-normal`;

export default function FollowUpCard({
  person,
  badge,
  badgeColor,
  // Optional: class for the dot before the due line. Defaults to the warning
  // dot for a warning-coloured badge and the green dot otherwise.
  dotColor,
  onNavigate,
  onCheck,
  onArchive,
  acting,
  checkLabel,
  showRoles = false,
  expanded = false,
  onToggle,
  draft,
  onDraftChange,
  onSaveLog,
}) {
  const isChecking = acting === "checking";
  const isArchiving = acting === "archiving";
  const isLogging = acting === "logging";
  const busy = !!acting;

  const setDraft = (k, v) => onDraftChange?.({ ...draft, [k]: v });

  const logOpen = expanded && draft;
  const checkText = checkLabel || "Mark as followed up";
  const dot = dotColor || (badgeColor?.includes("warn") ? "bg-warn" : "bg-ok-ink");
  const hasContact = !!(person.contactType || person.contact);
  const showNote = person.followUpRemarks && !expanded;

  const dueLine = (
    <>
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0">
        {badge}
        {person.followUpDays && ` · every ${person.followUpDays} ${Number(person.followUpDays) === 1 ? "day" : "days"}`}
      </span>
    </>
  );

  // Laid out by the card's own width, not the screen's: the same card sits in a
  // narrow column on Home and a wide one on Follow-ups. Narrow is the phone
  // board (two stacked rows), wide is the laptop board (one row).
  return (
    <div className="@container">
      <div
        className={
          logOpen
            ? "overflow-hidden rounded-[20px] bg-white shadow-card @3xl:rounded-3xl"
            : "rounded-[20px] bg-tint @3xl:rounded-[18px]"
        }
      >
        <div
          className={`flex flex-col gap-2 py-3 pl-3.5 pr-3 @3xl:flex-row @3xl:flex-wrap @3xl:items-center @3xl:gap-3.5 @3xl:px-4 ${
            logOpen ? "@3xl:py-3.5" : ""
          }`}
        >
          <div className="flex items-center gap-3 @3xl:contents">
            <Avatar name={person.name} />

            <div
              className={`min-w-0 flex-1 cursor-pointer ${logOpen ? "@3xl:flex-[1_1_220px]" : "@3xl:flex-[1_1_200px]"}`}
              onClick={onNavigate}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* The click is handled by the wrapper; the button makes it reachable by keyboard. */}
                <button
                  type="button"
                  className="min-w-0 max-w-full truncate text-left text-base font-semibold tracking-[-0.01em] text-ink @3xl:text-[15px] @3xl:tracking-normal"
                >
                  {person.name}
                </button>
                {showRoles && (person.roles || []).map((r) => (
                  <RoleTag key={r} role={r} className="shrink-0 h-[22px]! px-[9px]! text-xs!" />
                ))}
              </div>

              {/* Phone: the due line sits under the name. Laptop shows it in its own column. */}
              <p
                className={`flex items-center gap-1.5 text-[13px] font-semibold ${badgeColor} ${
                  expanded && !hasContact ? "" : "@3xl:hidden"
                }`}
              >
                {dueLine}
              </p>

              {hasContact && (
                <ContactLine contactType={person.contactType} contact={person.contact} className="mt-0.5">
                  {/* Laptop, log open: the due line folds into this one, as on the board. */}
                  {expanded && <span className="hidden shrink-0 @3xl:inline">· {badge}</span>}
                </ContactLine>
              )}
            </div>

            <button
              type="button"
              onClick={() => onCheck(person)}
              disabled={busy}
              title={checkText}
              aria-label={`${checkText}: ${person.name}`}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50 @3xl:order-4 ${
                logOpen ? "@3xl:hidden" : ""
              }`}
            >
              {isChecking ? <span className={spinnerClass} /> : <FiCheck size={18} strokeWidth={2.4} aria-hidden="true" />}
            </button>
          </div>

          {/* Always rendered: on laptop it holds the due line even when there is nothing else in it. */}
          {(
            <div className={`${showNote || onToggle || onArchive ? "flex" : "hidden"} items-center gap-2.5 @3xl:contents`}>
              <div className={`min-w-0 flex-1 @3xl:order-1 @3xl:flex-[1.4_1_220px] ${logOpen ? "@3xl:hidden" : ""}`}>
                <p className={`hidden items-center gap-1.5 text-[13px] font-semibold @3xl:flex ${badgeColor}`}>
                  {dueLine}
                </p>
                {showNote && (
                  <p className="truncate text-[13px] text-ink-2 @3xl:whitespace-pre-wrap @3xl:break-words">
                    {person.followUpRemarks}
                  </p>
                )}
              </div>

              {onArchive && (
                <Button
                  variant="outline"
                  onClick={() => onArchive(person)}
                  disabled={busy}
                  title="Archive"
                  aria-label={`Archive ${person.name}`}
                  className="w-11 shrink-0 px-0! @3xl:order-3"
                >
                  {isArchiving
                    ? <span className={spinnerClass} />
                    : <FiArchive size={18} aria-hidden="true" />}
                </Button>
              )}

              {onToggle && (
                <Button
                  variant={expanded ? "soft" : "outline"}
                  onClick={onToggle}
                  disabled={busy}
                  title="Log follow-up"
                  aria-label={`Log follow-up for ${person.name}`}
                  aria-expanded={expanded}
                  className="w-11 shrink-0 px-0! @3xl:order-2"
                >
                  <FiEdit3 size={18} aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>

        {logOpen && (
          <div className="flex flex-col gap-3.5 bg-tint px-4 pb-[18px] pt-4">
            <Field label="What to talk about next time">
              <textarea
                value={draft.followUpRemarks}
                onChange={(e) => setDraft("followUpRemarks", e.target.value)}
                rows={2}
                className={`${panelInputClass} resize-y py-2.5`}
              />
            </Field>

            <div className="flex flex-wrap items-end gap-x-2.5 gap-y-3.5 @3xl:gap-3.5">
              <Field label="Next follow-up" className="min-w-0 flex-1 @3xl:flex-[1_1_180px]">
                <input
                  type="date"
                  value={draft.scheduledFollowUpAt}
                  onChange={(e) => setDraft("scheduledFollowUpAt", e.target.value)}
                  className={`${panelInputClass} h-11 min-w-0`}
                />
              </Field>
              <Field label="Then every (days)" className="w-32 shrink-0 @3xl:w-auto @3xl:flex-[0_1_140px]">
                <input
                  type="number"
                  min="1"
                  value={draft.followUpDays}
                  onChange={(e) => setDraft("followUpDays", e.target.value)}
                  placeholder="None"
                  className={`${panelInputClass} h-11`}
                />
              </Field>
              {/* Narrow: forces the buttons onto their own line. Wide: pushes them to the right. */}
              <span aria-hidden="true" className="basis-full @3xl:flex-1 @3xl:basis-0" />
              <button
                type="button"
                onClick={onNavigate}
                className="order-last inline-flex min-h-11 w-full items-center justify-center font-semibold text-brand hover:text-navy @3xl:order-none @3xl:w-auto"
              >
                Open full profile
              </button>
              <Button
                variant="outline"
                onClick={() => onSaveLog(person, draft, false)}
                disabled={busy}
                className="flex-1 @3xl:flex-none"
              >
                Save only
              </Button>
              <Button
                onClick={() => onSaveLog(person, draft, true)}
                disabled={busy}
                className="flex-2 @3xl:flex-none @3xl:px-[18px]!"
              >
                {isLogging ? <span className={spinnerClass} /> : <FiCheck size={17} strokeWidth={2.4} aria-hidden="true" />}
                Save and mark followed up
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
