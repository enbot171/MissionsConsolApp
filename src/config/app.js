// ── People classification ─────────────────────────────────────────────────────
// Contact/Disciple are mutually exclusive; CGL stacks on top
export const CONTACT_ROLES = ["Contact", "Disciple", "CGL"];
// Core Team is a separate toggle with ministry sub-selection (ministries are dynamic from Firestore coreTeams collection)
export const MILESTONES = [
  "NS1", "NS2", "NS3", "NS4", "NS Encounter",
  "Water Baptism", "GT1", "GT2", "CGLT",
];

// ── Contact info options ──────────────────────────────────────────────────────
export const CONTACT_TYPES = ["LineID", "InstagramID", "HellotalkID", "Others"];
export const SOURCES = ["Street Evangelism", "English Exchange", "Online Platforms", "Others"];

// ── User account roles ────────────────────────────────────────────────────────
export const USER_ROLES = ["Member", "Leader", "Admin"];
