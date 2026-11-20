// ── People classification ─────────────────────────────────────────────────────
// Contact/Disciple are mutually exclusive; CGL stacks on top
export const CONTACT_ROLES = ["Contact", "Disciple", "CGL"];
// Core Team is a separate toggle with ministry sub-selection (ministries are dynamic from Firestore coreTeams collection)

export const ROLE_STYLES = {
  Contact: "bg-role-contact text-role-contact-ink",
  Disciple: "bg-role-disciple text-role-disciple-ink",
  CGL: "bg-role-cgl text-role-cgl-ink",
  "Core Team": "bg-role-core text-role-core-ink",
};

export const MILESTONES = [
  "NS1", "NS2", "NS3", "NS4", "NS Encounter",
  "Water Baptism", "GT1", "GT2", "CGLT",
];

// ── Contact info options ──────────────────────────────────────────────────────
export const CONTACT_TYPES = ["LineID", "InstagramID", "HellotalkID", "Others"];
export const SOURCES = ["Street Evangelism", "English Exchange", "Online Platforms", "Others"];

// ── User account roles ────────────────────────────────────────────────────────
export const USER_ROLES = ["Member", "Leader", "Admin"];

// ── Follow-up defaults ────────────────────────────────────────────────────────
export const DEFAULT_FOLLOW_UP_DAYS = 3;
export const DEFAULT_INACTIVITY_DAYS = 30;
