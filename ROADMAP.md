# ConsolApp Roadmap

A church/missions CG (Connect Group) management system. Real-time contact tracking, discipleship milestones, and team/organizational oversight.

**Status:** MVP live with core features. Phase 2 in progress.

---

## Recent Work (2026-07-30)

**Follow-ups: log without leaving the list.** Previously, updating a person's follow-up notes meant navigating to their profile, saving 22 fields, then returning to the follow-ups list to tick them off — one action split across two pages. Cards now expand in place to edit remarks, next date, and interval, with a single save that also stamps `lastFollowedUpAt`. Writes are narrow (3–4 fields), so a stale panel can't clobber edits made on the person page. Available on both `/follow-ups` and the dashboard.

**Meetings: confirming one records what happened.** "Did this meetup happen?" now captures outcome notes and marks the person as followed up in the same action, instead of writing a bare boolean. "Didn't happen" deletes the meetup and optionally books a new one. Past meetups became editable, the person's Meetings tab became clickable, and tapping a day with meetups shows them rather than opening the Schedule form.

**New `/meetings` page** — upcoming only, grouped Today / This week / Later.

**Mobile nav reworked** — five slots couldn't hold nine destinations. Tabs are now Home, People, +, Meetings, More; More opens a sheet with the rest. Overdue follow-up count badges the More tab.

**Query bounds.** `getMeetupsByAssignee` took no date bounds and scanned every meetup ever created. Now takes `{since, until}`; the calendar grid reads one month, its lists read 120 days, the dashboard reads today onward. The all-time Meetups stat became a server-side `getCountFromServer` instead of downloading every document.

**Shared, not duplicated.** `classifyPeople` moved to `src/lib/followUps.js`; the inline-log state lives in `src/hooks/useFollowUpLog.js`; the nav badge count comes from `src/context/FollowUpCountContext.js` (one read per session).

### Carried forward from this work

- [ ] Backdated meetups never ask for confirmation — `addMeetup` auto-sets `completed: true` when the date is in the past, so logging a meeting after the fact skips outcome notes entirely
- [ ] Unconfirmed meetups older than 120 days silently drop off the confirmation list
- [ ] Needs Confirmation only appears on `/calendar` — nothing badges or notifies you
- [ ] `/meetings` is unreachable on mobile when the list is empty (both "See all" links are conditional)
- [ ] Dashboard's `getOverduePeople` and `classifyPeople` use different rules and can disagree on who's overdue

### Google Calendar two-way sync — DEPLOYED

Built 2026-07-30 across 13 commits (`ade70a8`..`4064786`). Meetups mirror to each user's own Google Calendar; Google-side changes flow back through a webhook. Refresh tokens live in `googleTokens/{uid}`, denied to every client by rules and reachable only by the Admin SDK. A daily Vercel cron renews Google's watch channels, which expire and cannot be renewed in place.

Live at https://missions-consol-app.vercel.app (2026-07-31).

- [x] OAuth round trip works; refresh token stored in `googleTokens`, unreadable by any client
- [x] Deployed to Vercel with all 8 env vars set
- [x] A watch channel opens successfully — this also proved `calendar.app.created` permits `events.watch`, which had been an open risk
- [x] `/api/google/renew` returns 403 unauthenticated and `{"renewed":1,"failed":0}` with the cron secret
- [x] `/api/google/webhook` returns 403 unauthenticated
- [ ] **Outbound not yet confirmed end to end** — no meetup has been observed reaching the calendar
- [ ] **Inbound not yet confirmed** — moving an event in Google and seeing the app follow has never been run

**Creating an event directly in Google is ignored, by decision.** The webhook only acts on events carrying `extendedProperties.private.consolAppMeetupId`. A meetup needs a `personId` to be meaningful — the Meetings tab, the follow-up stamp and the confirmation flow all key off it — and an event typed into Google has no contact attached. Reviewed 2026-07-31 and deliberately left as-is.

**Known limits that remain** (full detail in the plan): a Firestore write failing after a successful `events.insert` can leave a duplicate calendar event nothing will clean up; deletes block the UI on Google despite outbound being documented as best-effort; a webhook pull truncated at 20 pages restarts rather than resumes; disconnecting leaves mirrored events on the user's calendar with no in-app way to remove them; event duration and title are app-owned and silently revert Google-side changes.

**Events live on a dedicated calendar.** The app requests `calendar.app.created`, which can create secondary calendars and manage events on those alone — it cannot see or touch the user's existing calendars. On first connect it creates a calendar named **Missions Consol App**; meetings sync there, not to the primary calendar. Consequences: a bug in this app can never delete a real appointment, inbound sync never reads anyone's personal schedule, and deleting that one calendar in Google removes every event the app made. If a user deletes the app's calendar manually, they must disconnect and reconnect to have it recreated.

The weekly grant expiry (Testing mode) is now detected — the settings card shows an amber Reconnect state, and reconnecting re-pushes up to 50 future meetups to repair whatever drifted while disconnected.

### Original design notes

Decided to build this, deferred until the meeting changes have been used for real. **Scope: meetups only.** Follow-ups stay in-app; contacts are never invited as attendees (there is no email field on a person — `CONTACT_TYPES` is LineID / InstagramID / HellotalkID / Others).

Decisions already made:

- **Two-way, not link-out.** Requires a server, so this adds the app's first API routes (Vercel), plus `googleapis` and `firebase-admin`.
- **Team is on regular Gmail, not Workspace** → the OAuth consent screen must run in **Testing** mode: each user's Gmail added by hand (max 100), and **refresh tokens expire every 7 days**, so everyone re-connects weekly until the app goes through Google verification.
- Refresh tokens live in a Firestore path locked to `allow read, write: if false` — Admin SDK only, never the browser.
- Inbound sync needs `events.watch` + a stored `syncToken`; webhooks carry no body, and a `410 GONE` forces a full re-sync.
- **Watch channels expire and cannot be renewed** — a daily Vercel Cron job re-opening them is mandatory. Without it inbound sync dies silently while outbound keeps working.
- Conflicts: last-write-wins on Google's `updated` vs a new `updatedAt` on meetups, plus an echo guard so the app's own writes don't bounce back.

Build order: consent screen decision → connect/callback → outbound → watch/webhook → renewal cron → conflict guard.

Per `AGENTS.md`, read `node_modules/next/dist/docs/` before writing route handlers — the API differs from older Next versions.

---

## Phase 1: Core MVP ✅ (Complete)

**Foundation** — Auth, Firestore schema, team scoping, basic CRUD.

- [x] Firebase Auth + Firestore setup; user profiles with roles (Member/Leader/Admin)
- [x] Org teams with team-scoped data isolation
- [x] People CRUD: add, edit, archive, soft delete
- [x] Basic fields: name, contact info, source, spiritual status (gospel/prayed/saved)
- [x] Roles system: Contact, Disciple, CGL, Core Team
- [x] Milestones tracking: NS1–4, Water Baptism, GT1–2, CGLT
- [x] Connect Groups (CGs) with attendance marking and member management
- [x] Core Teams (ministry teams: Worship, Tech, Welcome, etc.)
- [x] Dashboard: My Stats & Team Stats with period selector (Daily/Weekly/All Time)
- [x] Person detail: 3-tab view (Info, Progress, Network)
- [x] Two separate UIs: User App (Members/Leaders) + Admin App
- [x] Mobile-first responsive: bottom nav on mobile, sidebar on desktop
- [x] Firestore composite indexes for performance

---

## Phase 2: Enhanced UX & Reporting (In Progress)

**Goals:** Better UX, real reporting, richer data insights.

### A. Bulk & Speed Features (Priority 1)
- [x] Bulk Edit: spreadsheet view with paste-from-Google-Sheets support
- [ ] Quick Add: one-tap "Add Contact" → minimal form (name + contact) → saves immediately
- [ ] Contact import: CSV/Excel upload with validation
- [ ] Search + filters: multi-select filters (Contact Type, Source, Spiritual Status, Roles)
- [ ] Saved filters: save & reload filter combinations

**Why:** Leaders need fast entry for street evangelism & events. Bulk import handles new lists.

### B. Analytics Dashboard (Priority 1)
- [ ] Weekly dashboard: My Progress (# new contacts, # gospels, # salvations) vs. prev week
- [ ] Team funnel: Contacts → Gospels → Salvations (% conversion at each step)
- [ ] Attendance trends: CG member count over time, attendance rate %
- [ ] Ministry coverage: Who covers which teams, any gaps
- [x] Follow-up queue: People due for follow-up (last contact > 2 weeks, no progress)

**Why:** Data-driven oversight. Leaders need to see team health at a glance.

### C. Follow-ups & Progress (Priority 2)
- [x] Follow-up reminders: flag person as "follow up needed", track when done
- [ ] Progress timeline: show who moved from Contact → Gospel → Discipleship, with dates
- [x] Last contact date: track & display when each person was last seen (`lastFollowedUpAt`)
- [ ] "Stuck" people: show contacts with no progress for > 1 month

**Why:** Prevents people falling through the cracks. Surfaces where attention is needed.

### D. CG & Discipleship Flow (Priority 2)
- [ ] Meeting schedules: CGs can set recurring meeting times (e.g. "Thu 7pm")
- [ ] Auto-attendance: check-in / QR code / manual toggle on meeting day
- [ ] Discipleship path: track progression (Contact → Bible Study → Water Baptism → Core Team → Leader)
- [ ] "Next step" suggestions: prompt user based on person's current milestone

**Why:** Systemizes the discipleship process. Clear path from outreach → mature leader.

### E. Notifications & Comms (Priority 3)
- [ ] In-app notifications: new person added to your CG, attendance reminder, follow-up due
- [ ] Email summaries: weekly digest of your stats, team stats, follow-ups due
- [ ] Role-based alerts: Admins alerted to new org teams, Leaders alerted to new members in their CGs

**Why:** Keeps leaders engaged without needing to log in daily.

---

## Phase 3: Team & Org Tools (Post-Phase 2)

### A. Admin Dashboard (Priority 1)
- [ ] User management: invite users, edit roles, deactivate accounts
- [ ] Team setup: org structure, team hierarchy, team membership/leadership
- [ ] Team reports: active users, data entries, health checks
- [ ] Firestore management: export data, manual purge, recovery

**Why:** Admins need full org visibility & control. Easier scaling.

### B. Advanced Filtering & Export (Priority 2)
- [ ] Advanced people search: name + contact + assigned + role + CG + ministry, date range
- [ ] Group actions: move people to CG, change role, bulk assign, archive
- [ ] Export: CSV/JSON with full person records, attendance history, progress timeline

**Why:** Leaders need to segment people (e.g. "all new contacts from last month"). Data export for external analysis.

### C. Messaging & Engagement (Priority 3)
- [ ] Send messages: SMS/WhatsApp/Email to individuals or groups (via SMS gateway)
- [ ] Broadcast: team-wide announcements about CG meetings, events, updates
- [ ] Response tracking: responses to broadcasts, reply counters

**Why:** Scale outreach. Know who's engaged and who isn't.

### D. Calendar & Events (Priority 3)
- [ ] Event creation: CG meetings, outreach events, baptisms, leadership trainings
- [ ] Calendar view: see all org events + your CG meetings + assigned people milestones
- [ ] RSVP tracking: who's coming, who's not, auto-reminder

**Why:** Coord team events, plan baptisms, see full calendar view.

---

## Phase 4: Intelligence & Growth (Later)

### A. Analytics Engine
- Predictive: "Person X is at high risk of churn based on inactivity"
- Cohort analysis: compare new contacts who became disciples vs. those who didn't; surface trends
- Seasonal: track growth by month/quarter, forecast next quarter

### B. Mobile App
- Offline mode: sync when reconnected
- Push notifications: follow-up reminders, attendance alerts
- QR code: quick add contacts at events

### C. Integration
- Google Calendar sync: pull CG meetings, post events
- Slack/Discord: send summaries, get alerts, reply from chat
- Zapier: trigger workflows (new contact → email, milestone hit → notification)

### D. AI Features
- Auto-classify contacts: "This person is ready for discipleship" based on their record
- Auto-suggest next steps: "Time to follow up" / "Consider water baptism"
- Conversation summaries: record meeting notes, AI extracts action items

---

## Known Limitations & TODOs

### Data Model
- [ ] `gospelSharedAt`, `prayedAt`, `savedAt` timestamps — currently flags only; can't split stats by which month a person was baptized
- [x] `lastContactedAt` field — shipped as `lastFollowedUpAt`; set by the follow-up tick, the inline log, and meetup confirmation
- [ ] `nextStepSuggestion` — e.g. "Schedule follow-up meeting" (for progress timeline)

### Security & Scaling
- [ ] Stricter Firestore Rules: currently allow any auth user to read/write people/CGs; should scope by team
- [ ] Rate limiting on Cloud Functions once we add them (messaging, webhooks, etc.)
- [ ] Audit logs: track who changed what, when

### Performance
- [ ] Pagination on lists (currently all-at-once fetch; works for 500 people, breaks at 10k+)
- [ ] Indexed search: current search is client-side text filter; add Firestore full-text search or Algolia
- [ ] Caching layer: reduce repeated fetches of the same team, CG, or user

### Testing
- [ ] Add unit tests for Firestore functions
- [ ] E2E tests for core flows: add contact, assign to CG, mark attendance, edit person

---

## Success Metrics

Track these to know when each phase is done:

- **Phase 2A (Speed):** Leaders can add 20 people in < 5 min
- **Phase 2B (Analytics):** Leaders check dashboard weekly; see 1–2 actionable insights
- **Phase 2C (Follow-ups):** 80% of contacts receive follow-up within 2 weeks
- **Phase 2D (Discipleship):** Avg time Contact → Baptism tracked and < 6 months
- **Phase 3A (Admin):** Admins can manage org structure without touching code/Firebase Console
- **Phase 4 (Mobile):** 50% of users log in via mobile app

---

## Open Questions

1. **Single or Multi-Church?** Currently built for a single church (one Firestore instance). Multi-tenant support (many churches on same app) is out of scope for Phase 2, but might make sense later.
2. **SMS/Email Gateway:** Which provider? Twilio, AWS SNS, SendGrid? Not yet chosen.
3. **Offline Sync:** How many offline operations before sync required? (Affects mobile roadmap.)
4. **Data Retention:** How long do we keep archived people? Grace period before hard delete?

---

## Tech Debt

- [ ] Refactor Firestore functions into a service layer (currently scattered in pages)
- [ ] Extract form components: Add Person, Edit Person, Add CG, etc. (currently inline)
- [ ] Add error boundaries on all pages
- [ ] Add loading skeleton screens instead of spinners
- [ ] Tailwind config: consolidate color vars, spacing scales
- [ ] Accessibility: test with screen reader, ensure WCAG 2.1 AA

---

## Dependencies & Integrations (Future)

| System | Reason | Status |
|---|---|---|
| Firebase Functions | Triggered bulk operations, scheduled tasks | Not yet |
| Cloud Tasks | Scheduled follow-up reminders, email digests | Not yet |
| Firestore Bulk Loader | CSV import without hitting Cloud Functions | Not yet |
| Algolia / Meilisearch | Full-text search on large people lists | Not yet |
| Stripe | Premium tiers / billing (if SaaS) | Out of scope |
| Twilio / AWS SNS | SMS messaging | Phase 3C candidate |
| Google Calendar API | Two-way sync of meetups | Designed, not built — see below |

---

## Deployment & Release Cycles

- **Staging:** `main` branch auto-deploys to Vercel Preview
- **Production:** Tagged releases (`v0.1.0`, etc.) deploy to Vercel Production
- **Firebase:** Single Firestore instance + rules versioning
- **Hotfixes:** Emergency patches bypass review if critical (e.g. auth broken)

---

**Last Updated:** 2026-06-19  
**Maintainer:** ChenHuaEn
