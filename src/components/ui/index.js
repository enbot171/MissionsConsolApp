// Small presentational building blocks shared by every page. No data access
// and no app state in here: pages own behaviour, these own the look.

import { ROLE_STYLES } from "@/config/app";

const cx = (...parts) => parts.filter(Boolean).join(" ");

// ── Button ────────────────────────────────────────────────────────────────────

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const BUTTON_SIZES = {
  md: "h-11 px-4 rounded-[14px] text-[15px]",
  lg: "h-13 px-5 rounded-2xl text-base",
  icon: "h-11 w-11 rounded-[14px]",
};

const BUTTON_VARIANTS = {
  primary: "bg-brand text-white shadow-brand hover:bg-navy",
  outline: "bg-white text-ink ring-1 ring-line hover:bg-tint",
  quiet: "bg-fill text-ink hover:bg-line-soft",
  soft: "bg-brand-soft text-brand hover:bg-role-contact",
  danger: "bg-white text-danger-ink ring-1 ring-line hover:bg-danger-soft",
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className)}
      {...props}
    />
  );
}

// ── Chips ─────────────────────────────────────────────────────────────────────

export function Chip({ active = false, className = "", ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "shrink-0 h-11 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
        active ? "bg-brand text-white" : "bg-fill text-ink hover:bg-line-soft",
        className
      )}
      {...props}
    />
  );
}

// One row of chips that scrolls sideways instead of wrapping or clipping. The
// negative margin lets it run to the screen edge on phones.
export function ChipRow({ label, className = "", children }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx("flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0", className)}
    >
      {children}
    </div>
  );
}

// ── Surfaces ──────────────────────────────────────────────────────────────────

export function Card({ tone = "white", className = "", children, ...props }) {
  const tones = {
    white: "bg-white shadow-card",
    tint: "bg-tint",
    soft: "bg-brand-soft",
  };
  return (
    <div className={cx("rounded-3xl p-4 md:p-5", tones[tone], className)} {...props}>
      {children}
    </div>
  );
}

// ── Form field ────────────────────────────────────────────────────────────────

// Class for inputs, selects and textareas so they share one look.
export const inputClass =
  "w-full min-h-12 px-3.5 rounded-[14px] bg-white text-ink text-base ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-none";

export function Field({ label, error, className = "", children }) {
  return (
    <label className={cx("flex flex-col gap-1.5 text-sm font-semibold text-ink", className)}>
      {label}
      {children}
      {error && <span className="text-[13px] font-medium text-danger-ink">{error}</span>}
    </label>
  );
}

// ── People ────────────────────────────────────────────────────────────────────

export function RoleTag({ role, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center h-6 px-2.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap",
        ROLE_STYLES[role] || "bg-fill text-ink-2",
        className
      )}
    >
      {role}
    </span>
  );
}

const AVATAR_TINTS = [
  "bg-role-disciple text-role-disciple-ink",
  "bg-role-core text-role-core-ink",
  "bg-role-contact text-role-contact-ink",
  "bg-tint-rose text-tint-rose-ink",
  "bg-role-cgl text-role-cgl-ink",
  "bg-tint-teal text-tint-teal-ink",
];

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

// The tint is picked from the name, so one person keeps one colour everywhere.
const tintFor = (name = "") => {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
};

export function Avatar({ name, size = "md", className = "" }) {
  const sizes = {
    sm: "w-9 h-9 rounded-xl text-sm",
    md: "w-11 h-11 rounded-[14px] text-base",
    lg: "w-14 h-14 rounded-[18px] text-xl",
  };
  return (
    <span
      aria-hidden="true"
      className={cx("shrink-0 inline-flex items-center justify-center font-semibold", sizes[size], tintFor(name), className)}
    >
      {initials(name)}
    </span>
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────

const BANNER_TONES = {
  error: "bg-danger-soft text-danger-ink",
  success: "bg-ok-soft text-ok-ink",
  info: "bg-brand-soft text-brand-ink",
  warning: "bg-warn-soft text-warn-ink",
};

export function Banner({ tone = "info", className = "", children }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("px-4 py-3 rounded-2xl text-sm font-medium", BANNER_TONES[tone], className)}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, hint, action, className = "" }) {
  return (
    <div className={cx("rounded-3xl bg-tint px-6 py-10 text-center", className)}>
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// ── Page furniture ────────────────────────────────────────────────────────────

// Fixed action bar for form pages on phones. PageShell renders it in place of
// the tab bar, so the main button is always under the thumb.
export function BottomBar({ children }) {
  return (
    <div
      role="group"
      aria-label="Page actions"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex gap-2.5 bg-white px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--color-line),0_-10px_30px_rgb(20_30_60/0.08)]"
    >
      {children}
    </div>
  );
}
