# ConsApp — Full App Breakdown

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `src/app/`) |
| Styling | Tailwind CSS v4 (`bg-linear-to-br` syntax, not `bg-gradient-to-br`) |
| Auth | Firebase Authentication (email/password) |
| Database | Firestore (NoSQL, client-side SDK — no Cloud Functions) |
| Icons | react-icons (`fi`, `fa`, `hi` sets) |

---

## Two Separate Apps

The codebase serves two distinct user experiences that share the same Firebase project but have entirely separate navigation and pages:

**User App** — for Leaders and Members
- Bottom nav: Home · People · + (FAB) · Groups · Settings
- Manages contacts, disciples, connect groups, core teams

**Admin App** — for Admins only, entered via login redirect
- Bottom nav: Home · Users · Teams
- Manages user accounts and organizational teams only
- Every page under `/admin/*` uses `AdminBottomNav` and `AdminPageShell`

---

## Auth Flow

```
User visits app
    │
    ├── Not logged in → /login
    │       └── Sign in → getUserProfile()
    │               ├── profile.role === "Admin" → /admin
    │               ├── no profile found → error shown, stays on /login
    │               └── Member/Leader → /  (home)
    │
    └── Logged in (AuthContext loads on mount)
            ├── loading = true → spinner
            ├── getUserProfile() throws → needsSetup = true → redirect /login
            └── profile loaded → needsSetup = false → allow page to render
```

`useRequireAuth()` — used on every protected page. Redirects to `/login` if not authenticated or `needsSetup` is true. Returns `{ user, profile, loading, needsSetup }`.

---

## Firestore Collections & Schema

### `users/{uid}`
Document ID = Firebase Auth UID.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name |
| `email` | string | From Firebase Auth |
| `role` | string | `"Member"` \| `"Leader"` \| `"Admin"` |
| `teamId` | string \| null | Reference to `teams/{id}` |
| `createdAt` | timestamp | Set on creation |

---

### `teams/{id}`
Organizational teams created by Admin. Users belong to a team via `users.teamId`.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Team display name |
| `createdAt` | timestamp | |

Teams don't store a member list — queried via `getUsersByTeam(teamId)`.

---

### `people/{id}`
The main data entity. Represents a contact, disciple, or core team member.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required |
| `contactType` | string | `"LineID"` \| `"InstagramID"` \| `"HellotalkID"` \| `"Others"` |
| `contact` | string | The handle / number |
| `source` | string | `"Street Evangelism"` \| `"English Exchange"` \| `"Online Platforms"` \| `"Others"` |
| `age` | number \| null | |
| `address` | string | |
| `metAt` | string | Where they were met |
| `description` | string | General remarks |
| `gospelShared` | boolean | |
| `prayed` | boolean | |
| `saved` | boolean | |
| `roles` | string[] | `["Contact"]`, `["Disciple"]`, `["CGL"]`, `["Core Team"]`, or combinations. Contact and Disciple are mutually exclusive. |
| `ministries` | string[] | Names matching `coreTeams.name` documents (e.g. `["Worship", "Tech"]`). Only populated when `roles` includes `"Core Team"`. |
| `milestones` | object | `{ "NS1": true, "Water Baptism": false, ... }` |
| `progressRemarks` | string | Notes on spiritual progress |
| `cgId` | string | Reference to `cgs/{id}` |
| `assignedTo` | string | UID of the user responsible (POC) |
| `assignedToName` | string | Denormalised name for display |
| `teamId` | string | Reference to `teams/{id}` — written on creation and when added to a CG or Core Team group. Required for ministry/CG member queries to work correctly. |
| `archived` | boolean | Soft delete — filtered out of all active queries. No-contact records are archived immediately on creation. |
| `noContact` | boolean | `true` for people met but with no contact info obtained. Archived immediately. Still counted in Talked To, Gospel Shared, Prayed For, Salvations stats. |
| `createdAt` | timestamp | The date the person was *met* (not necessarily when entered). User-settable on Add Contact and Person Edit. Defaults to today. Used for Daily/Weekly/All Time stats. |

---

### `cgs/{id}`
Connect Groups.

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `leaders` | string[] | Array of user UIDs |
| `members` | string[] | Array of person IDs |
| `teamId` | string | Reference to `teams/{id}` — scopes which team this CG belongs to |
| `createdAt` | timestamp | |

---

### `coreTeams/{id}`
Ministry teams under Core Team (e.g. Worship, Tech, Welcome). Dynamic — created from the app.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Team name — matches values stored in `people.ministries[]` |
| `teamId` | string | Reference to `teams/{id}` — scopes which org team this belongs to |
| `createdAt` | timestamp | |

People are linked to a core team by having the team's `name` in their `ministries` array. `getPeopleByMinistry(name, teamId)` queries by `ministries array-contains ministry`, then filters `teamId` client-side. Only people with a matching `teamId` are shown — no fallback for records without one.

**Seeding:** Teams (Worship, Tech, Welcome, etc.) must be created as documents in this collection via Groups → Core Team → + button, or manually in Firebase Console.

---

### `attendance/{id}`
Attendance records per CG per date.

| Field | Type | Notes |
|---|---|---|
| `cgId` | string | Reference to `cgs/{id}` |
| `dateStr` | string | ISO date `"YYYY-MM-DD"` (used for dedup lookup) |
| `date` | timestamp | Firestore timestamp for ordering |
| `present` | string[] | Array of member IDs present |
| `absent` | string[] | Array of member IDs absent |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | Set on edit |

---

## Firestore Security Rules (Summary)

```
users      — read: any auth user | create: leader or admin | update: self or admin | delete: admin
teams      — read: any auth user | write: admin only
people     — read/write: any auth user
cgs        — read/write: any auth user
coreTeams  — read: any auth user | write: leader or admin
attendance — read/write: any auth user
```

Role checks use `exists()` + `get()` to read the requesting user's document within the rule.

---

## Firestore Functions (`src/lib/firestore.js`)

### Users
| Function | Description |
|---|---|
| `addUserProfile(uid, data)` | Creates `users/{uid}` with `setDoc` |
| `getUserProfile(uid)` | Fetches single user profile |
| `getAllUsers()` | Fetches all users — admin pages only |
| `getUsersByTeam(teamId)` | Fetches users filtered by teamId — used in CG leader selection, person POC dropdown, team stats |
| `updateUserProfile(uid, data)` | Partial update |
| `deleteUserProfile(uid)` | Deletes profile doc (Auth account stays) |

### Teams (Org)
| Function | Description |
|---|---|
| `addTeam(data)` | Creates team, returns new ID |
| `getTeam(id)` | Fetches single team |
| `getAllTeams()` | Fetches all teams |
| `updateTeam(id, data)` | Partial update |
| `deleteTeam(id)` | Deletes team |

### People
| Function | Description |
|---|---|
| `addPerson(data)` | Creates person with `teamId`, returns new ID. If `data.createdAt` is provided (string or Date), converts to `Timestamp.fromDate()`; otherwise uses `serverTimestamp()`. |
| `getPerson(id)` | Fetches single person |
| `updatePerson(id, data)` | Partial update |
| `deletePerson(id)` | Hard delete |
| `getPeopleByAssignee(uid)` | All non-archived people where `assignedTo = uid`, ordered by `createdAt desc` |
| `getArchivedByAssignee(uid)` | All archived people where `assignedTo = uid` |
| `getNoContactByAssignee(uid)` | All people where `assignedTo = uid` and `noContact === true`. Single-field query + client-side filter (no composite index needed). |
| `getNoContactByTeam(teamId)` | All people where `teamId` matches and `noContact === true`. Single-field query + client-side filter. |
| `getPeopleByRole(role, teamId)` | All non-archived people with `role` in `roles[]`, scoped by `teamId`. Requires composite index. |
| `getPeopleByMinistry(ministry, teamId)` | All non-archived people with `ministry` in `ministries[]`. Queries Firestore by ministry only (single-field index), filters `teamId` client-side. Only returns people where `p.teamId === teamId`. |
| `getPeopleByCG(cgId)` | All non-archived people in a CG, ordered by name |

### Core Teams (Ministry)
| Function | Description |
|---|---|
| `addCoreTeam(data)` | Creates core team with `teamId`, returns new ID |
| `getCoreTeamsByTeam(teamId)` | Fetches core teams scoped to org team |

### Connect Groups
| Function | Description |
|---|---|
| `addCG(data)` | Creates CG with `teamId`, returns new ID |
| `getCG(id)` | Fetches single CG |
| `getAllCGs()` | Fetches all CGs (admin use only) |
| `getCGsByTeam(teamId)` | Fetches CGs scoped to org team |
| `updateCG(id, data)` | Partial update |
| `deleteCG(id)` | Deletes CG |

### Attendance
| Function | Description |
|---|---|
| `markAttendance(cgId, date, present, absent)` | Upserts attendance record for a CG+date |
| `getAttendanceByCG(cgId)` | All attendance records for a CG, ordered by date desc |

---

## Firestore Composite Indexes

| Collection | Fields | Used By |
|---|---|---|
| `people` | `assignedTo ASC + createdAt DESC` | `getPeopleByAssignee` |
| `people` | `teamId ASC + roles CONTAINS + createdAt DESC` | `getPeopleByRole` |
| `people` | `cgId ASC + name ASC` | `getPeopleByCG` |
| `attendance` | `cgId ASC + date DESC` | `getAttendanceByCG` |
| `attendance` | `cgId ASC + dateStr ASC` | `markAttendance` dedup lookup |

`getPeopleByMinistry` no longer needs a composite index — it queries by a single `array-contains` field and filters `teamId` client-side.

---

## Pages

### User App

| Route | File | Description |
|---|---|---|
| `/login` | `app/login/page.js` | Email/password sign in. Redirects Admin → `/admin`, others → `/` |
| `/` | `app/page.js` | Home dashboard. Period selector (Daily/Weekly/All Time). My Stats: talked to, contacts made, gospel shared, prayed for, salvations, active disciples. Team Stats: same + active core team. Gospel Shared/Prayed For/Salvations include no-contact people. |
| `/people` | `app/people/page.js` | Search bar + filter chips (Contact, Disciple, CGL, Core Team, Archived — Contact/Disciple mutually exclusive) + dropdown filter panel (Contact Type, Source, Gospel Shared, Prayed, Saved). |
| `/add-contact` | `app/add-contact/page.js` | Three tabs: Quick · Full · No Contact. Quick and Full include Date Met (defaults today), Met At, Status toggles. No Contact tab saves name, date met, remarks, gospel shared, prayed, saved — no contact info required; person saved with `noContact: true, archived: true`. Accepts URL params `?cgId=` and `?ministry=` to pre-fill CG or Core Team and switch to Full tab. |
| `/bulk-edit` | `app/bulk-edit/page.js` | Full-screen spreadsheet for batch-entering people. Add N rows control in toolbar. 30 columns across grouped headers (Basic Info, Notes, Roles, Status, Milestones). Supports paste from Google Sheets (tab-separated). On save: new rows → `addPerson`, dirty existing rows → `updatePerson`. Validation: name + contact required for any row with content. |
| `/person/[id]` | `app/person/[id]/page.js` | 3-tab detail: Info · Progress · Network. Single Save Changes button; "Changes saved." appears below it on success. Archive/Unarchive in header. |
| `/groups` | `app/groups/page.js` | 2 tabs: Connect Groups · Core Team. CG tap → `/cg/[id]`. Core Team list shows ministry team cards; tapping drills into that team's people list. In the drill-down: inline "Add Member" button (centered modal, picks from your people), red × on each person card to remove them from the team, and a red trash icon in the top-right to delete the entire team (cleans up all members' `ministries`/`roles` first). + buttons on the list view open centered modals to create new CGs or ministry teams. |
| `/cg/[id]` | `app/cg/[id]/page.js` | CG detail: read-only info, attendance marking, attendance history, member list with "Add Members" button (centered modal picks from your people) and red × on each card to remove them. Edit CG button at bottom → inline form (name + leaders from team only); "Changes saved." below after save. Delete CG → top-right red trash icon (clears `cgId` on all members first). |
| `/settings` | `app/settings/page.js` | User profile: name, email, role badge, team. Admin Dashboard link if Admin. Sign out. |

### Person Detail Tabs (`/person/[id]`)

**Info tab**
- Basic fields: name, contact type & info, source, age, address, met at, remarks
- Roles card: Contact / Disciple / CGL chips (Contact and Disciple are mutually exclusive)
- Core Team card: toggle row; when on, shows ministry team chips fetched from `coreTeams` collection

**Progress tab**
- Status toggles: Gospel Shared / Prayed / Saved
- Milestones grid (NS1–NS4, NS Encounter, Water Baptism, GT1, GT2, CGLT)
- Progress Remarks textarea

**Network tab**
- Assign Connect Group (dropdown from team's CGs)
- Assign POC / Assigned To (dropdown from team's users via `getUsersByTeam`)
- Remove from CG button (shown when CG is assigned)

### Admin App

| Route | File | Description |
|---|---|---|
| `/admin` | `app/admin/page.js` | Home with Users and Teams shortcut cards |
| `/admin/users` | `app/admin/users/page.js` | All users list. Tap to expand: name, email, role. Add User button. |
| `/admin/users/new` | `app/admin/users/new/page.js` | Create user: name, email, password, role, team. Uses secondary Firebase app so admin stays signed in. |
| `/admin/teams` | `app/admin/teams/page.js` | All org teams. Tap to expand members (name, email, role). Add Team button. |
| `/admin/teams/new` | `app/admin/teams/new/page.js` | Create org team: name only. |

---

## Components

| Component | Description |
|---|---|
| `BottomNav` | Mobile-only (`md:hidden`) user app nav: Home · People · FAB(+) · Groups · Settings. FAB is centered. Active tab shows blue icon + dot. |
| `SideNav` | Desktop-only (`hidden md:flex`) fixed left sidebar. Collapses to icon-only strip (w-16) via toggle button. Top: branding + collapse toggle → Add Contact CTA → nav items (Home, People, Groups, Settings). State shared via `SidebarContext`. |
| `AdminBottomNav` | Admin app nav: Home · Users · Teams. Same visual style. |
| `PageShell` | User app page wrapper: fixed header with optional back button + right action slot + `BottomNav` + `SideNav`. Uses `useSidebar()` to offset content by sidebar width (`md:ml-60` or `md:ml-16`). |
| `AdminPageShell` | Admin page wrapper: fixed header with optional back button + `AdminBottomNav` |
| `PersonCard` | Card with gradient avatar (falls back to "?" if name missing), role chips, chevron. Navigates to `/person/[id]`. Accepts optional `onRemove` prop — when provided, replaces the chevron with a red × button that calls `onRemove(person)` without triggering navigation. |
| `SearchBar` | Controlled text input with search icon for filtering lists |
| `Spinner` | Shared loading spinner. `<Spinner />` for inline use, `<Spinner fullScreen />` for full-page loading states. Used across all pages. |

---

## Context & Hooks

### `SidebarContext` (`src/context/SidebarContext.js`)
Wraps the whole app (inside `AuthProvider`). Provides:
- `collapsed` — boolean; true when sidebar is icon-only
- `toggle` — function to toggle collapsed state

Used by `SideNav`, `PageShell`, and any standalone page that renders its own layout (e.g. dashboard, settings).

### `AuthContext` (`src/context/AuthContext.js`)
Wraps the whole app. Provides:
- `user` — Firebase Auth user object
- `profile` — Firestore user document (includes `teamId`, `role`, `name`, `email`)
- `loading` — true while auth state resolves
- `needsSetup` — true if Auth user exists but no Firestore doc
- `setProfile`, `setNeedsSetup`

### `useRequireAuth` (`src/hooks/useRequireAuth.js`)
Used at the top of every protected page. Redirects to `/login` if not authenticated or `needsSetup` is true. Returns `{ user, profile, loading, needsSetup }`.

---

## Hardcoded Values (`src/config/app.js`)

| Export | Values | Notes |
|---|---|---|
| `CONTACT_ROLES` | `["Contact", "Disciple", "CGL"]` | Shown as chips in person/add-contact. Contact and Disciple are mutually exclusive. |
| `MILESTONES` | NS1–NS4, NS Encounter, Water Baptism, GT1, GT2, CGLT | Shown as grid in Progress tab |
| `CONTACT_TYPES` | LineID, InstagramID, HellotalkID, Others | Dropdown in forms |
| `SOURCES` | Street Evangelism, English Exchange, Online Platforms, Others | Dropdown in forms |
| `USER_ROLES` | Member, Leader, Admin | Used in admin Add User form |

Ministry teams (Worship, Tech, Welcome, etc.) are **not** hardcoded — they are dynamic documents in the `coreTeams` Firestore collection, scoped by `teamId`.

---

## Team Scoping

Every user belongs to an org team (`users.teamId`). All data is scoped to that team:

| Data | How scoped |
|---|---|
| People (My People / stats) | `getPeopleByAssignee(user.uid)` — already per-user |
| People (by role) | `getPeopleByRole(role, teamId)` — Firestore query |
| People (by ministry) | `getPeopleByMinistry(name, teamId)` — Firestore query + client filter |
| People in CG | `getPeopleByCG(cgId)` — CG itself is already team-scoped |
| Connect Groups | `getCGsByTeam(teamId)` |
| Core Teams (ministry) | `getCoreTeamsByTeam(teamId)` |
| New people | `teamId` written on creation via `addPerson` |
| New CGs | `teamId` written on creation via `addCG` |
| New core teams | `teamId` written on creation via `addCoreTeam` |
| Adding to CG via modal | `updatePerson` called with `cgId` (teamId not changed — already set) |
| Adding to Core Team via modal | `updatePerson` called with updated `roles`, `ministries`, and `teamId` |

`profile.teamId` is read from `useRequireAuth()` and passed to all team-scoped queries.

---

## Stats Logic (Home Page)

Stats are computed client-side. Period selector (Daily/Weekly/All Time) controls both sections simultaneously.

**My Stats** — from `getPeopleByAssignee(user.uid)` + `getNoContactByAssignee(user.uid)`:
```
├── Talked To      — period-filtered count of (contacts + no-contact people)
├── Contacts Made  — period-filtered count of contacts only (not no-contact)
├── Gospel Shared  — period-filtered, includes no-contact people
├── Prayed For     — period-filtered, includes no-contact people
├── Salvations     — period-filtered, includes no-contact people
└── Active Disciples — all-time count of people with "Disciple" in roles[]
```

**Team Stats** — aggregated from all users in the team:
```
fetch getUsersByTeam(teamId) + getNoContactByTeam(teamId)
    └── for each user: getPeopleByAssignee(user.uid)
            └── flatten + deduplicate by person ID
                    ├── Talked To, Contacts Made, Gospel Shared, Prayed For, Salvations (period-filtered)
                    ├── Active Disciples (all-time)
                    └── Active Core Team (all-time)
```

**`createdAt` as the "when met" date** — `addPerson` accepts a user-provided date for `createdAt` so that daily/weekly buckets reflect when the person was actually met, not when the form was submitted. The date is set on the Add Contact form (defaults to today) and editable in Person Detail → Info tab.

**Limitation:** Period stats count contacts whose `createdAt` falls in the period with flags already set. Toggling a flag later on an older contact won't appear in period stats. Fix would require `gospelSharedAt`, `prayedAt`, `savedAt` timestamps.

---

## CG Member Flows

**Add Members** — tap "Add Members" next to the Members heading:
1. `getPeopleByAssignee(user.uid)` fetches your people; filters out anyone already in this CG
2. Centered modal shows a searchable list of remaining people
3. Tap a name → `updatePerson(person.id, { cgId: id })` writes the CG ID to the person doc
4. `getPeopleByCG(id)` re-fetches the member list; person appears immediately

**Remove Member** — tap × on a member card:
1. `updatePerson(person.id, { cgId: "" })` clears `cgId` on the person doc
2. Person removed from `members` state immediately (no re-fetch)

**Delete CG** — tap red trash in top-right:
1. `Promise.all(members.map(m => updatePerson(m.id, { cgId: "" })))` clears `cgId` on every member in parallel
2. `deleteCG(id)` removes the CG document
3. Redirects to `/groups`

---

## Core Team Member Flows

**Add Member** — tap "Add Member" next to the team name in the drill-down:
1. `getPeopleByAssignee(user.uid)` fetches your people; filters out those already in this ministry
2. Centered modal shows a searchable list
3. Tap a name → `updatePerson(person.id, { roles: [..., "Core Team"], ministries: [..., teamName], teamId })` — merges without duplicates, stamps `teamId`
4. `getPeopleByMinistry(teamName, teamId)` re-fetches; person appears immediately

**Remove Member** — tap × on a member card:
1. Removes the ministry name from `person.ministries[]`
2. If `ministries` is now empty, also removes `"Core Team"` from `person.roles[]`
3. `updatePerson` writes both fields; person removed from state immediately

**Delete Team** — tap red trash in top-right of drill-down:
1. `getPeopleByMinistry(team.name, teamId)` fetches all members
2. For each: removes team name from `ministries[]`, strips `"Core Team"` from `roles[]` if no ministries remain
3. `deleteCoreTeam(team.id)` removes the coreTeams document
4. Returns to team list (`selectedTeam` → null)

---

## Data Relationships

```
teams ◄──── teamId ────┬──── users (assignedTo on people)
                       ├──── people
                       ├──── cgs
                       └──── coreTeams

people ──── cgId ──────► cgs ◄──── cgId ──── attendance
       ──── assignedTo ─► users
       ──── ministries[] matches coreTeams.name
```

---

## Key Design Decisions

**No Cloud Functions** — All Firestore reads/writes happen client-side via the Firebase JS SDK. Security is enforced by Firestore Rules.

**Auth UID = Firestore document ID** — `users/{uid}` uses the Firebase Auth UID as its document ID. This is the bridge between Auth and profile data.

**Team scoping at query level** — Data isolation between org teams is enforced by passing `teamId` as a query filter, not by Firestore Rules. Rules currently allow any authenticated user to read/write people/CGs. If stricter isolation is needed, rules can be updated to check `teamId`.

**Soft delete (archive)** — People are never hard deleted. `archived: true` is set and all active queries filter it out client-side. Archived people are visible via the Archived chip on the People page.

**Ministry teams via Firestore (not hardcoded)** — `coreTeams` is a Firestore collection so teams can be added from the app without code changes. `people.ministries[]` stores team names as strings matching `coreTeams.name`. If a team is renamed, existing people documents retain the old name and fall out of that team's view.

**Secondary Firebase app for user creation** — `createUserWithEmailAndPassword` normally signs in as the new user. Admin user creation uses `initializeApp(firebaseConfig, uniqueName)` to create a temporary secondary app instance, create the user there, then `deleteApp()` — leaving the admin's session untouched.

**Role-based routing** — Login checks `profile.role` after sign-in and routes Admin to `/admin`, others to `/`. Admin pages re-check role on mount and redirect away if insufficient.

**No-contact people** — People met with no contact info are saved with `noContact: true, archived: true`. They are excluded from the active People list and regular people queries, but `getNoContactByAssignee` / `getNoContactByTeam` fetch them separately for dashboard stats. They count toward Talked To, Gospel Shared, Prayed For, and Salvations but not Contacts Made.

**Retractable sidebar** — `SidebarContext` holds `collapsed` state (boolean). `SideNav` renders the collapsed/expanded layout; `PageShell` and standalone pages (dashboard, settings) use `useSidebar()` to apply the correct left-margin offset (`md:ml-60` expanded, `md:ml-16` collapsed). Sidebar is desktop-only; bottom nav is mobile-only.

**Responsive layout** — `SideNav` is `hidden md:flex`; `BottomNav` is `md:hidden`. Pages apply `md:ml-60` / `md:ml-16` margin to offset the sidebar on desktop. Mobile shows no sidebar and uses the bottom nav instead.

**Saved notifications** — All "Changes saved." messages appear as a green text line directly below the Save Changes button, not as a floating toast. They auto-dismiss after 3 seconds.
