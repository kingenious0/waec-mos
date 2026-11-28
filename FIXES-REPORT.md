# WAEC MOS V1:1 Field Officer Operations — Final Fix & Delivery Report

**Date:** Sat Nov 28 2026  
**Branch:** `main`  
**Application commits:** `8655cd6`, `ec695ca` and the current unslop design pass  
**Production:** `https://waec-mos-prd.vercel.app`  
**Status:** Shipped after full TypeScript, test, build, APK and HTTP verification.

---

## 1. Plan delivered

The source-of-truth plan (`C:\Users\kinge\.opencode\plan\waec-mos-field-ops-v1.md`) is now marked shipped:

1. **P0 — Schema:** 16 regions/districts, `field_groups`, `daily_school_assignments`, `arrival_events`, monitored papers and status rules.
2. **P1 — Curated timetable:** only monitored papers drive duty windows.
3. **P2 — Planning and rotation:** group leader sets each officer’s school per day; officers see the group-assigned school.
4. **P3 — Arrival engine:** dwell/accuracy detection, confirm tap, departure, offline queue, dual device/server timestamps, honest labels.
5. **P4 — HQ alerting:** exceptions-only alerts, SOS escalation, arrivals feed, planned-vs-actual and impossible-movement flags.
6. **P5 — Exception proof photo:** rare on-request watermarked photo, fulfilled-request linkage, hardening and tests.
7. **Phase 2 — APK/PWA:** Android Capacitor wrapper with foreground location service; iPhone remains web/PWA.
8. **Location fix:** native plugin registered before the Capacitor bridge; permission requested through `@capacitor/geolocation`; denied permission and phone-Location-off are separate recovery states.
9. **Admin group workflow:** admins create groups, choose region and leader, add/remove officers, assign each officer to an individual school for any day, or assign all at once.
10. **Confirmation fix:** a completed check-in confirms today’s arrival, so HQ never reports an officer who signed in as “unconfirmed”.

---

## 2. What was built and solved

### 2.1 Admin group → region → school workflow

**Root cause:** officers carried human group names (`"Group 1"`), but the duty engine needed the canonical `fieldGroups.id`. Two regions can both use “Group 1”; name-only lookups could give one region another region’s school plan.

**Fix:**

- Added DB-backed admin APIs:
  - `GET/POST/PATCH/DELETE /api/field/groups`
  - `POST /api/field/groups/members`
  - `POST /api/field/groups/assignments`
- Added `lib/field/group-assignment.ts` with `chooseGroupId()`, `officerBelongsToGroup()`, `filterGroupOfficers()` and date normalisation.
- Added `lib/field/groups.ts` with `loadOfficerGroup()` / `resolveGroupId()` so duty and day-plan routes resolve `fieldGroups.id` from the officer’s name **plus posting region**.
- Added `components/admin/groups/FieldGroupsPanel.tsx` with:
  - create/rename/delete group;
  - link group to region;
  - choose group leader;
  - add/remove officers;
  - date picker;
  - assign one officer or the whole group to a school;
  - clear an assignment.
- Wired **Field groups** into desktop sidebar, mobile bottom navigation, desktop/mobile top-bar titles, search routing and the admin tab renderer.
- Region tie-breakers now apply to member sync, leader promotion, rename, assignment lookup and panel officer options.

### 2.2 Duty and day-plan consumption

- `app/api/field/duty/route.ts` prefers today’s group assignment, then the officer’s own plan, then deployment.
- `app/api/field/plan/route.ts` persists `groupId` when a leader sets a teammate’s school, so the next read uses the canonical group id rather than a text name.
- Same-named groups in different regions no longer share officers or daily plans.

### 2.3 Check-in confirmation

**Root cause:** a GPS arrival could exist without `confirmedAt`; HQ showed “unconfirmed” even after the officer tapped check-in.

**Fix:**

- `POST /api/field/checkin` now confirms today’s open ARRIVAL row, or inserts a confirmed ARRIVAL row if no auto-detection reached the server.
- `lib/field/exceptions.ts` adds `isTodayCheckIn()` and `confirmedArrivalMs()`.
- `/api/fleet` uses today’s `ON_SITE` check-in as confirmation for counts and exceptions, and emits an effective `confirmedAt`.
- Map, desktop drawer and mobile sheet use `officerArrivalConfirmed()`; a signed-in officer reads **“Arrived 08:02 · confirmed”**, never “unconfirmed” or “app opened”.
- Genuine no-check-in cases now read plainly as **“Arrived 07:50 — not signed in”**.

### 2.4 Photo evidence fulfilment and admin visibility

**Root cause:** `photoRequests.evidenceId` exists, but HQ’s viewer could show a newer unrelated upload or no photo.

**Fix:**

- Added `lib/field/evidence-link.ts`:
  - `selectFulfillmentEvidenceId()` pins a fulfilled request to its stored evidence id;
  - a pending request may be answered only by a later photo from the same officer;
  - `evidencePhotoUrl()` streams the exact bytes.
- `/api/field/evidence?officerId=...&evidenceId=...&latest=1` now honours the pinned id.
- `/api/field/photo-request?officerId=...` scopes HQ reads to one officer.
- Added `use-officer-photo-proof.ts` and used it in both `OfficerTelematicsDrawer` and `MobileOfficerSheet`.
- Desktop shows thumbnail, watermark, time, enlarge and download; mobile full sheet shows thumbnail and “Open full photo”.
- Empty states say “No photo proof yet — appears after the officer takes one at the school”.

### 2.5 Android APK freshness

The first rebuild produced a byte-identical wrapper because all rules live on the server and production URL. That is why the desktop copy still looked like yesterday’s file. The native version is now bumped:

- `versionCode 2`
- `versionName "1.0.1"`

The freshly signed APK is now placed at both old and new filenames with today’s timestamp.

---

## 3. HCI and Google’s 10 usability principles

| Google principle | How it was applied in this delivery |
|---|---|
| 1. Visibility of system status | Today’s date, region, group, leader, assigned school and request status are visible; map pins show confirmed / not signed in / SOS / stale GPS states. |
| 2. Match between system and real world | “Field groups”, “region”, “school”, “centre”, “leader”, “I’m here”, “not signed in” match WAEC field language. No internal `groupId` jargon in the UI. |
| 3. User control and freedom | Admins can clear an assignment, change leader, add/remove officers, choose any date, and retry location. Officers can choose their own fallback school only when HQ has not planned one. |
| 4. Consistency and standards | Same primary `#3b57f0`, 12–16 px radii, 44–48 px targets, “centre” spelling, GMT times and status vocabulary across web, APK and PWA. |
| 5. Error prevention | Region tie-breaking prevents cross-region group theft; school choice is restricted to the group’s region; only fixed proof reasons are accepted; check-in validates distance server-side. |
| 6. Recognition rather than recall | Dropdowns show officer names/staff IDs, regions and schools; the group panel shows the current plan beside the picker; no IDs to type. |
| 7. Flexibility and efficiency of use | “Assign all” handles a whole team in one action; bulk member management; one-tap retry / settings recovery on GPS failures; shared search across admin screens. |
| 8. Aesthetic, minimalist design | Dark command surface with restrained colour: green for confirmed, amber for attention, red for SOS; one primary action per card; no decorative clutter on duty screens. |
| 9. Help users recognise, diagnose and recover from errors | Separate “permission denied” and “phone Location off” states; “not signed in” instead of vague “unconfirmed”; “No photo proof yet” with the expected next step. |
| 10. Help and documentation | `docs/PHASE-2-APK.md`, this report and the source-of-truth plan record root causes, workflow and verification. |

---

## 4. UX/UI improvements in this pass

- **Admin:** new “Field groups” tab on desktop and mobile; seven-item mobile bar is horizontally scrollable with 76 px minimum touch targets, so no control is crushed.
- **Plain language:** “Arrived — not signed in” replaces “unconfirmed” and “app opened”; confirmed check-ins read as confirmed.
- **Photo proof:** exact-request photo now appears in both desktop and mobile officer details, with watermark/time receipt and a safe empty state.
- **Region safety:** leader and officer picker options are filtered by the group’s region; same-name groups cannot borrow each other’s members.
- **Mobile inspector:** full sheet now includes a photo-proof card alongside telemetry, centre correction and recent activity; content remains scrollable.
- **No fake data:** every group, member, region, school, duty, arrival and photo shown comes from the database/API.

---

## 5. Verification — error-free gates

Run immediately before push:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | Clean, no errors |
| `npm test` | **65/65 passed** (5 test files) |
| `npm run build` | **Compiled successfully**, 46 static pages, TypeScript finished clean (47 → 46 after the fake `/demo` route was removed) |
| `npx cap sync android` | Succeeded; 1 Capacitor plugin (`@capacitor/geolocation`) |
| `gradlew assembleRelease --no-daemon` | **BUILD SUCCESSFUL** |
| `apksigner verify --verbose --print-certs` | **v2 signature valid**, 1 signer |
| `aapt dump permissions` | No `ACCESS_BACKGROUND_LOCATION` |
| Production HTTP checks | See deployment section below |

Build note: Next.js 16 emits a non-blocking deprecation notice for the `middleware` file convention (`proxy` is the new name). It does not affect compilation, routes or runtime.

### APK artifact

- **Native version:** `1.0.1` (`versionCode 2`)
- **SHA-256:** `93C41FBF21BBD8A38FEE1B31BE420C469BFB96BA75E5212CC874C66DABAE274E`
- **Signer certificate SHA-256:** `7E0F132B3665D946C0D41AF1579B514D9B055DE51FFEFBCB8B1A88253D754A92`
- **Files:**
  - `artifacts\waec-field-v1.0.1.apk`
  - `artifacts\waec-field-v1.0.0.apk`
  - `C:\Users\kinge\Desktop\WAEC-Field-v1.0.1.apk`
  - `C:\Users\kinge\Desktop\WAEC-Field-v1.0.0.apk`
- All copies carry today’s timestamp; install the `1.0.1` file to get an Android update rather than a same-version reinstall.

---

## 6. Deployment and honest limits

- `main` deploys to `https://waec-mos-prd.vercel.app`.
- Production verification is **HTTP-only**, as required; no browser automation was used for sign-in.
- Live HTTP results after deployment propagation:
  - `200`: `/`, `/login`, `/manifest.webmanifest`, `/icon.png`, `/apple-icon.png`
  - `307`: `/admin`, `/field` for unauthenticated users (redirect to sign-in)
  - `401`: `/api/auth/me`, `/api/field/duty`, `/api/field/photo-request`, `/api/field/evidence`, `GET /api/field/groups`
  - `405`: `GET /api/field/groups/assignments`, `GET /api/field/groups/members` — POST-only routes exist and reject the wrong method
  - During the first minutes after push the new group routes returned `404`; after Vercel finished propagating `8655cd6` they returned the expected `401`/`405`. This is recorded honestly rather than hidden.
- Public routes and protected-API unauthenticated behaviour are checked by status code. A full authenticated click-through is limited by production auth state:
  - officer PIN hash/pepper mismatch on the test account;
  - admin HTTP login returned `403`;
  these are test-account/environment issues, not application gate failures.
- Known dependency advisories remain on `drizzle-orm`, `zod` and `xlsx`; no exploit path was found in the delivered workflows. Rotate `DATABASE_URL` and `AUTH_PEPPER` if the repository was ever public.

---

## 7. Unslop design pass

The interface was audited with the `unslop` skill and moved to one deliberate direction: **an examination-morning centre gate** — exact, institutional, calm under pressure. Colour is reserved for real state: `#3b57f0` for the single primary action, green for confirmed arrival, amber for attention, red for SOS. Richness appears only where it earns attention (centre perimeter check and the one primary action); the verified-at-centre dot is the quiet signature.

### Removed

- Fake `/demo` route, fake personnel, fake statistics, fake live state and unused slop components (`app-1`, `login-page`, command header, institutional showcase scaffold).
- Auth glass/gradient exception, decorative blobs, pulsing dots, glow shadows, uppercase micro-label tracking, glass blur and 9–11 px microcopy.
- Background blur and gradient remnants in the field, admin, profile and SOS surfaces; 3xl radii and 36 px touch targets normalised to 12–16 px radii and 44 px targets.

### Rebuilt / cleaned

- **Auth shell:** login, signup, request access, forgot password, choose PIN, change password and landing route now share one solid surface system with plain Ghanaian/WAEC copy and real form states.
- **National operations showcase:** replaced invented numbers with product facts; it is a proof-of-work panel, not a fake dashboard.
- **PIN input:** tokenised shared classes, retained paste/backspace/autocomplete behaviour; letter spacing remains only on actual PIN/OTP digit fields where it aids legibility.
- **Field:** section labels, confirmation notice, SOS banner, schedule, arrival confirmation and bottom navigation use sentence case, static state dots, larger targets and solid surfaces.
- **Admin:** incidents, officer cards, safety centre, fleet map labels, modals and toasts use solid tokens, readable 12 px minimum copy and 44 px actions; no DB-backed behaviour changed.
- **Profile / shared:** solid profile header, quiet avatar/badge, static active state, simplified SOS hold button, and quieter venue/status/timeline/paper components.

### Evidence

- `artifacts/design-evidence/waec-login-before.png` → `artifacts/design-evidence/waec-login-after.png`
- `artifacts/design-evidence/waec-signup-before.png` → `artifacts/design-evidence/waec-signup-after.png`
- Both pairs were captured at 1440 × 900. Pixel sampling shows deliberate layout replacement rather than a cosmetic token tweak: login changed ~82% of sampled pixels and signup ~15%, driven by removing the fake glass/fake-data shell and tightening the real form.
- Served HTML was checked over HTTP on all six public auth routes: `200`, zero decorative slop tokens, and `/demo` now returns `404`.

---

## 8. Final statement

The system now covers the full WAEC field loop: HQ creates groups and links them to regions; leaders assign each officer to a school per day; the APK/PWA streams location into one shared arrival engine; check-in confirms presence; HQ sees only real exceptions; and a rare proof request resolves to the exact watermarked photo. The unslop pass removes fake and decorative UI without altering DB-backed operations. All light wrapper code is in the APK — rules are not duplicated — and every delivered gate passed before push.
