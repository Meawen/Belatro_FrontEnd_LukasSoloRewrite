# Frontend follow-up to the backend identity/PII hardening — design

> Backend work: branch `lukasDev` in `Belatro/belatro-backend`, commits `e316178..ab3daed` (not deployed).
> Full backend write-up: `/Users/lmiholic/IdeaProjects/Belatro/.superpowers/sdd/2026-07-26-identity-pii-hardening/task-14-report.md`
> Date: 2026-08-25. Branch for this work: `identity-pii-frontend`.

## Why

The backend closed a set of identity/PII vulnerabilities. In doing so it removed or moved
endpoints this frontend still calls, and stopped returning PII from public endpoints this
frontend still reads. The profile-edit screen was itself the vulnerability's UI: it submitted a
full `UserUpdateDTO` (including `passwordHashed`, `eloRating`, `expPoints`, `gamesPlayed`)
against an arbitrary user id via `PUT /user/{id}`, which now answers 405.

## Backend contract (verified against source, 2026-08-25)

| Endpoint | Shape |
|---|---|
| `GET /user/me` | `UserDto` — `{id, username, email, roles, deletionRequested}` (caller's own; **new**) |
| `POST /user/me/password` | body `{currentPassword, newPassword}` → 204; 401 `{"error":...}` wrong current password; 400 blank new password |
| `POST /user/me/request-forget` | → 202 (moved from `/user/{id}/request-forget`) |
| `GET /user/findAll`, `GET /user/{id}` | `UserSummaryDto` — `{id, username, eloRating, level, gamesPlayed}` — no email/hash/roles |
| `PUT /user/{id}` | **removed** |
| `DELETE /user/{id}` | **removed** — admin path is `DELETE /admin/user/{id}` (ROLE_ADMIN) |
| `GET /admin/users` | still `UserDto` with email — unchanged |
| `POST /api/auth/signup` | duplicate → 409 `{"error":...}`; invalid → 400 field-error map |
| Errors generally | `UserNotFoundException` → 404; `IllegalArgumentException` → 400; bodies use `{"error": ...}` |

Username is immutable by construction (no backend write path). Email has deliberately **no**
change endpoint — deferred to a second spec (verification / change-of-address flow). WebSocket
identity comes only from the validated JWT on the STOMP CONNECT frame; the `Authorization`
header in `useGameWebSocket.ts` is correct and **must not be touched**. `?user=` must never
return — it was the impersonation hole.

## Decisions (made with the user, 2026-08-25)

1. **Testing**: add `vitest` + `@testing-library/react` (+ `user-event`, `jest-dom`, `jsdom`),
   TDD **only the surface this work changes**. No retrofit of untouched code.
2. **Email**: read-only on your own profile (ProfileStats "Account Information", fed by
   `GET /user/me`). Removed from the edit modal. Other users' profiles show no email.
3. **Password change**: the profile page's "Edit Profile" modal becomes a **"Change Password"**
   modal. `EditProfile.tsx` is replaced by `ChangePasswordForm.tsx`.
4. **Extras all in scope**: delete dead user-write plumbing; clean the two dead WS lines; add a
   self-service "Request account deletion" action; fix the silently-broken admin gating using
   `/user/me` roles.
5. **Me-data flow**: a `useMe()` hook in the existing `useApi` style. No auth context
   introduced; each consumer fetches independently (small GET, staleTime-cached per instance).

## Design

### 1. Wire-contract layer — types and services

- `src/types/user.ts`
  - Narrow `User` to the real `UserSummaryDto` shape: `{id, username, eloRating, level,
    gamesPlayed}` (keep the name `User` to limit churn in ~10 consumer files). Removed fields:
    `email`, `passwordHashed`, `expPoints`, `lastLogin`, `roles`, `deletionRequested`.
  - Delete `UserUpdateDTO`.
  - Keep `UserDto` `{id, username, email, roles, deletionRequested}` — matches `/user/me` and
    `/admin/users`.
  - Add `ChangePasswordRequest` `{currentPassword, newPassword}`.
  - `tsc -b` is the auditor: every read of a removed field fails compilation and gets an
    explicit decision — drop the UI element, or reroute it to me-data.
- `src/services/userService.ts`
  - Delete `updateUser`, `deleteUser`.
  - Repoint `requestForget` to `POST /user/me/request-forget` (no id argument).
  - Add `getMe(): Promise<UserDto>` → `GET /user/me`.
  - Add `changePassword(req: ChangePasswordRequest): Promise<void>` → `POST /user/me/password`,
    opting out of the 401 token-clear (below).
- `src/services/api.ts` — two surgical changes only:
  - Error message extraction: `errorData.message || errorData.error || fallback` (backend
    bodies are `{"error": ...}`; today they render as "HTTP 401/409").
  - Per-request option (e.g. `{ keepTokenOn401: true }`) so a call can opt out of the global
    "clear token on any 401". Only `changePassword` uses it — a typo'd current password must
    not half-log the user out.

### 2. Hooks

- `src/hooks/useUser.ts`: remove the update/delete mutations from `useUser`; add `useMe()`
  built on `useApi`, mirroring `useUser`.
- The password form calls `useMutation(userService.changePassword)` directly — no wrapper hook.

### 3. Profile UI

- **`src/components/profile/ChangePasswordForm.tsx`** replaces `EditProfile.tsx` (delete it;
  update the barrel `index.ts`). Same modal slot and `onSuccess`/`onCancel` contract in
  `UserProfile`; no `user` prop. Fields: current password, new password, confirm. Client
  validation mirrors SignupForm: required, new ≥ 6 chars, confirm matches. Outcomes:
  204 → `onSuccess()`; 401 → inline "Current password is incorrect" (from parsed body);
  400 → inline message. Token survives the 401.
- **`src/components/profile/UserProfile.tsx`**
  - Button and modal retitled "Change Password".
  - When `isOwnProfile`, additionally call `useMe()`; pass the `UserDto` to ProfileStats.
  - New "Request account deletion" action (own profile only): two-step inline confirm →
    `userService.requestForget()` → on 202 refetch me. If `me.deletionRequested` is already
    true, show a "Deletion requested" state instead of the button. (Deletion itself is
    actioned by an admin via `DELETE /admin/user/{id}` — this only flags the account.)
- **`src/components/profile/ProfileStats.tsx`**: new optional prop for me-data (`UserDto`).
  Email row and role display render only when it is provided (own profile). Other profiles
  omit those rows.
- **`src/components/profile/UserList.tsx`**: search filter matches username only (the email
  term is dead data).

### 4. Admin gating fix

`src/components/auth/AuthGuard.tsx` (admin-required paths) and
`src/components/admin/AdminDashboard.tsx` currently read `.roles` off the localStorage auth
user, which never contains roles — the admin check is silently broken today. Both switch to
`useMe().roles` (`ROLE_ADMIN`), with a loading state while it resolves. Ordinary
is-authenticated checks stay as they are. (Server-side authorization is unaffected either way;
this only fixes client-side routing/UX.)

### 5. WebSocket tidy

`src/hooks/useGameWebSocket.ts`: remove exactly two dead things — the `?user=` query appended
to the SockJS URL (~line 156) and the `X-Player-Name` CONNECT header (~line 163). The
`Authorization: Bearer` header stays byte-for-byte. Never reintroduce `?user=`.

### 6. Testing

- Dev-dependencies: `vitest`, `jsdom`, `@testing-library/react`,
  `@testing-library/user-event`, `@testing-library/jest-dom`. Separate `vitest.config.ts`
  (`vite.config.ts` untouched). New script: `"test": "vitest run"`.
- TDD (red-green) on the changed surface:
  - `userService`: request paths/bodies for `getMe`, `changePassword`, `requestForget`;
    error mapping incl. `{"error":...}` extraction; 401 from `changePassword` keeps the token.
  - `ChangePasswordForm`: validation errors, success path calls `onSuccess`, wrong current
    password shows the inline message and does not log out.
  - `UserList`: filter matches username, no longer consults email.
  - `AuthGuard`: admin route allows `ROLE_ADMIN` from me-data, denies otherwise, handles
    loading.
- Final verification: manual browser click-through against the locally running hardened
  backend (login → profile → change password wrong/right → request deletion → users list →
  admin page as admin/non-admin).

## Error handling notes

- `getMe()` on an expired token → 401 → apiClient clears the token (existing behaviour, kept):
  consumers see unauthenticated state.
- `useMutation` rethrows; forms try/catch and read `ApiError.message`.

## Out of scope (flagged, deliberately untouched)

- Dead components `Header.tsx`, `UserDropdown.tsx`, `MainLayout.tsx` (never imported).
- The ad-hoc root `test-*.cjs` scripts.
- Dev-mode `/api/api/auth/*` double-prefix quirk in `authService`/`apiClient`.
- The harmless `playerId` field still sent in STOMP bodies (ignored by the backend).
- Email editing (requires backend Spec 2: verification flow).
- The uncommitted game-related WIP in the working tree — never staged by this work
  (explicit paths only; no `git add -A` / `git add .`).
- The backend repo is read-only for this work.

## User Stories

- **US-1**: As a signed-in user, I open my profile and see a "Change Password" button where
  "Edit Profile" used to be, so that the UI no longer offers edits that cannot happen.
- **US-2**: As a signed-in user, I change my password by entering my current password and a
  new one twice, so that my account stays under my control.
- **US-3**: As a signed-in user who mistypes their current password, I see "Current password
  is incorrect" and remain logged in, so that a typo doesn't eject me from the app.
- **US-4**: As a signed-in user, I see my email read-only under Account Information on my own
  profile, so that I can confirm which address my account uses.
- **US-5**: As a signed-in user viewing someone else's profile, I see no email address, so
  that other players' PII stays private.
- **US-6**: As a signed-in user, I can request deletion of my account (with a confirm step)
  and afterwards see a "Deletion requested" state, so that I have a self-service GDPR path.
- **US-7**: As a user of the players list, I search by username and get correct results, so
  that the search doesn't silently depend on data the server no longer sends.
- **US-8**: As an admin, the admin area recognises my role (fetched from `/user/me`) and
  lets me in; as a non-admin I am kept out client-side, so that gating actually works.
- **US-9**: As a player, my game WebSocket connects exactly as before via the JWT on CONNECT,
  so that the cleanup changes nothing about how I authenticate.
