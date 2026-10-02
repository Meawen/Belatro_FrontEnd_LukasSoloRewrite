# Frontend Addendum Implementation Plan (identity follow-up, game page, one socket, Phase 3–5 consumers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the identity/PII frontend follow-up, make the connected game page and the lobby-to-game flow actually work over exactly one STOMP connection per tab, and consume every backend contract change of the 2026-10-01 run (lane-authz C1/C3, lane-email D8, lane-debt E5/E7) — proven at the end by four browser seats playing cards against the merged backend.

**Architecture:** Repo-conventional layers stay: `apiClient` → services → `useApi`/`useMutation` hooks → components. One new seam: `src/services/gameSocket.ts` becomes the sole owner of the tab's STOMP client (ref-counted `acquire()`, one shared subscription per destination, re-subscribe on every connect, `reconnect()` for token rotation); `useGameWebSocket` becomes a thin hook over it. The game page renders a new presentational `GameTable` from the real wire types in `src/types/game.ts`. Work is staged: Stage A has no backend dependency; Stages B–D each start only after the named backend lane has merged into `lukasDev`; Stage E runs the gameplay harness against the fully merged backend.

**Tech Stack:** React 19.1, TypeScript 5.8, Vite 7, react-router-dom 7.7, @stomp/stompjs 7.1.1 + sockjs-client 1.6.1, vitest 4.1 + @testing-library/react 16 + user-event 14 (jsdom). E2E only: playwright-core 1.62.1 installed outside the repo (matches the cached Chromium build 1234).

**Spec:**
- Frontend spec (decisions, user stories): `docs/superpowers/specs/2026-08-25-identity-pii-frontend-followup-design.md`
- Previous frontend plan (Tasks 1–4 done; 5–10 are amended here): `docs/superpowers/plans/2026-09-02-identity-pii-frontend-followup.md`
- Backend roadmap, Phase 2 (B1–B10): `/Users/lmiholic/IdeaProjects/stiglja/docs/superpowers/plans/2026-10-01-remaining-work-roadmap.md`
- Backend Phase 3 spec (C1, C3, C5 contracts): `/Users/lmiholic/IdeaProjects/stiglja/docs/superpowers/specs/2026-10-01-hardening-round-2-design.md`
- Backend Phase 4 spec (§3 HTTP contract, §8 frontend D8): `/Users/lmiholic/IdeaProjects/stiglja/docs/superpowers/specs/2026-10-01-email-and-sessions-design.md`
- Backend Phase 5 spec (E5, E7): `/Users/lmiholic/IdeaProjects/stiglja/docs/superpowers/specs/2026-10-01-debt-round-design.md`
- Decisions ledger: `/Users/lmiholic/IdeaProjects/Belatro/.superpowers/sdd/2026-10-01-remaining-work/progress.md`

**Execution context:** frontend worktree `/Users/lmiholic/IdeaProjects/stiglja-lanes/frontend`, branch `identity-pii-frontend-2`, cut from `identity-pii-frontend` @ `88f8a3f` (which contains the user's former game WIP). All repo paths below are relative to that worktree unless absolute.

| Stage | Tasks | Starts when |
|---|---|---|
| A | 1–12 | immediately (no backend dependency) |
| B | 13–14 | lane-authz merged into `lukasDev` (gate G-B in Task 13) |
| C | 15–19 | lane-email merged into `lukasDev` (gate G-C in Task 15) |
| D | 20–21 | lane-debt (incl. its stage 2) merged into `lukasDev` (gate G-D in Task 20) |
| E | 22 | all backend lanes merged (gates G-B, G-C, G-D all pass) |

B10 (PR `identity-pii-frontend → master`) is the orchestrator's close-out, not a task here.

## File manifest

Paths relative to the frontend worktree. C = create, M = modify, D = delete.

| File | Action | Task(s) |
|---|---|---|
| `docs/superpowers/plans/2026-10-01-frontend-addendum.md` | C (copy of this plan) | 1 |
| `tsconfig.app.json` | M | 1 |
| `src/components/profile/ProfileStats.tsx` | M | 2, 18 |
| `src/components/profile/ProfileStats.test.tsx` | C, M | 2, 18 |
| `src/components/profile/UserProfile.tsx` | M | 2, 3, 18 |
| `src/components/profile/UserProfile.test.tsx` | C, M | 3, 18 |
| `src/components/auth/AuthGuard.tsx` | M | 4 |
| `src/components/auth/AuthGuard.test.tsx` | C | 4 |
| `src/components/admin/AdminDashboard.tsx` | M | 4 |
| `src/components/admin/AdminDashboard.test.tsx` | C | 4 |
| `src/components/layout/Sidebar.tsx` | M | 4 |
| `src/components/layout/Sidebar.test.tsx` | C | 4 |
| `src/hooks/useGameWebSocket.ts` | M | 5, 7 |
| `src/components/auth/credentialRules.ts` | C | 6 |
| `src/components/auth/credentialRules.test.ts` | C | 6 |
| `src/components/auth/SignupForm.tsx` | M | 6, 19 |
| `src/components/auth/SignupForm.test.tsx` | C, M | 6, 19 |
| `src/components/profile/ChangePasswordForm.tsx` | M | 6 |
| `src/components/profile/ChangePasswordForm.test.tsx` | M | 6 |
| `src/services/api.ts` | M | 6, 15, 20 |
| `src/services/api.test.ts` | M | 6, 15, 20 |
| `src/types/game.ts` | M (content replaced) | 7 |
| `src/services/gameSocket.ts` | C | 7 |
| `src/services/gameSocket.test.ts` | C | 7 |
| `src/hooks/useGameWebSocket.test.tsx` | C | 7 |
| `src/hooks/useBelatroGame.ts` | M | 7 |
| `src/hooks/useBelatroGame.test.tsx` | C | 7 |
| `src/hooks/useEnhancedRanked.ts` | M | 7 |
| `src/components/game/MatchFoundModal.tsx` | M | 7 |
| `src/components/game/PlayPage.test.tsx` | C | 7 |
| `src/MockComponents/MockGameBoard.tsx` | M | 7 |
| `src/MockComponents/RealisticGameBoard.tsx` | M | 7, 10 |
| `src/components/game/gameView.ts` | C | 8 |
| `src/components/game/gameView.test.ts` | C | 8 |
| `src/components/game/GameTable.tsx` | C | 8 |
| `src/components/game/GameTable.test.tsx` | C | 8 |
| `src/components/game/GamePageConnected.tsx` | M | 8 |
| `src/components/game/GamePageConnected.test.tsx` | C | 8 |
| `src/components/game/GameBoard.tsx` | D | 8 |
| `src/components/game/index.ts` | M | 8 |
| `src/App.tsx` | M | 8, 9, 10, 16, 17 |
| `src/services/lobbyService.ts` | M | 9, 13 |
| `src/services/lobbyService.test.ts` | C, M | 9, 13 |
| `src/services/matchService.ts` | M | 9 |
| `src/components/lobby/LobbyDetails.tsx` | M | 9 |
| `src/components/lobby/LobbyDetails.test.tsx` | C | 9 |
| `src/components/lobby/TeamManagment.tsx` | M | 9, 13 |
| `src/components/lobby/TeamManagement.test.tsx` | C, M | 9, 13 |
| `src/components/lobby/index.ts` | M | 9 |
| `src/components/layout/Header.tsx` | D | 10 |
| `src/components/layout/UserDropdown.tsx` | D | 10 |
| `src/components/layout/MainLayout.tsx` | D | 10 |
| `src/components/admin/AdminStats.tsx` | M | 10, 21 |
| `src/components/profile/UserList.tsx` | M | 10, 21 |
| `src/components/match/MatchCard.tsx` | M | 10 |
| `src/components/match/MatchDetails.tsx` | M | 10 |
| `src/components/match/MatchSummaryCard.tsx` | M | 10 |
| `src/components/game/PlayButton.tsx` | M | 10, 19 |
| `src/components/game/QueueStatus.tsx` | M | 10 |
| `src/hooks/useFriends.ts` | M | 10 |
| `e2e/gameplay.mjs` | C | 11 |
| `src/types/lobby.ts` | M | 13 |
| `src/hooks/useLobby.ts` | M | 13 |
| `src/components/lobby/CreateLobbyForm.tsx` | M | 13 |
| `src/components/lobby/CreateLobbyForm.test.tsx` | C | 13 |
| `src/components/lobby/JoinLobbyModal.tsx` | M | 13 |
| `src/components/lobby/LobbyDetailsPopup.tsx` | M | 13 |
| `src/components/lobby/LobbyDetailsPopup.test.tsx` | C | 13 |
| `src/components/lobby/LobbyControls.tsx` | M | 13 |
| `src/components/lobby/LobbyControls.test.tsx` | C | 13 |
| `src/types/friendship.ts` | M | 14 |
| `src/components/profile/UserCard.tsx` | M | 14 |
| `src/components/profile/UserCard.test.tsx` | C | 14 |
| `src/components/profile/FriendList.tsx` | M | 14 |
| `src/components/profile/FriendList.test.tsx` | C | 14 |
| `src/types/user.ts` | M | 15 |
| `src/services/authService.ts` | M | 15 |
| `src/services/authService.test.ts` | C | 15 |
| `src/services/userService.ts` | M | 15, 21 |
| `src/services/userService.test.ts` | M | 15, 21 |
| `src/components/auth/ConfirmEmailPage.tsx` | C | 16 |
| `src/components/auth/ConfirmEmailPage.test.tsx` | C | 16 |
| `src/components/auth/ForgotPasswordPage.tsx` | C | 17 |
| `src/components/auth/ForgotPasswordPage.test.tsx` | C | 17 |
| `src/components/auth/ResetPasswordPage.tsx` | C | 17 |
| `src/components/auth/ResetPasswordPage.test.tsx` | C | 17 |
| `src/components/auth/LoginForm.tsx` | M | 17 |
| `src/components/auth/LoginForm.test.tsx` | C | 17 |
| `src/components/auth/ResendConfirmationButton.tsx` | C | 18 |
| `src/components/auth/ResendConfirmationButton.test.tsx` | C | 18 |
| `src/components/profile/ChangeEmailForm.tsx` | C | 18 |
| `src/components/profile/ChangeEmailForm.test.tsx` | C | 18 |
| `src/components/layout/UnverifiedEmailBanner.tsx` | C | 19 |
| `src/components/layout/UnverifiedEmailBanner.test.tsx` | C | 19 |
| `src/components/layout/AppLayout.tsx` | M | 19 |
| `src/components/game/PlayButton.test.tsx` | C | 19 |
| `vite.config.ts` | M | 20 |
| `test-defensive-fix.js` (tracked, repo root) | D (`git rm`) | 20 |
| `test-response-structure-fix.js` (tracked, repo root) | D (`git rm`) | 20 |
| 35 untracked root `test-*.cjs`/`test-*.js` in the **main checkout** (not in the worktree) | moved to `~/.Trash/belatro-fe-test-scripts-2026-10-01/` | 20 |
| `src/types/common.ts` | M | 21 |
| `src/hooks/useUser.ts` | M | 21 |
| `src/hooks/index.ts` | M | 21 |
| `src/components/profile/UserList.test.tsx` | C | 21 |

No backend file is touched by this plan.

## Global Constraints

- **No AI attribution anywhere.** No `Co-Authored-By`, no "Generated with" line, in any commit message or PR text. Plain conventional-commit messages. (The previous frontend plan's `Co-Authored-By` instruction is void.)
- **Work only in the worktree** `/Users/lmiholic/IdeaProjects/stiglja-lanes/frontend`. The main checkout `/Users/lmiholic/IdeaProjects/Belatro_FrontEnd_LukasSoloRewrite` is read-only for this plan, with one exception: Task 20 moves its 35 untracked root test scripts to the Trash.
- **Stage explicit paths only.** Never `git add -A` / `git add .`. Commit with pathspecs: `git commit -m "..." -- <path> <path>`. After every commit run `git show --stat HEAD` and confirm it lists only the task's paths.
- **The backend repo is read-only.** Backend code is run, never edited, and only from the detached worktree `/Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run` (procedure R). **Never** run the backend from `/Users/lmiholic/IdeaProjects/stiglja` and never against the real Atlas/Redis in its `.env`: local Docker Mongo (single-node replica set), Redis and Mailpit only, settings overridden on the command line.
- **Gradle needs JDK 23:** `JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-23.jdk/Contents/Home ./gradlew <task>`.
- **WebSocket identity:** the only identity on the socket is `Authorization: Bearer <jwt>` on the STOMP CONNECT frame. Never add `?user=` to a socket URL or a username header (`X-Player-Name`, `login`). `?user=` was the impersonation hole.
- **One STOMP client per browser tab** (B7). After Task 7 nothing but `src/services/gameSocket.ts` may construct a `@stomp/stompjs` `Client`.
- **Password rule (C5):** at least 8 characters and at most 72 UTF-8 bytes; message exactly `Password must be at least 8 characters and at most 72 bytes`. **Username rule (C5):** `^[A-Za-z0-9_]{3,20}$`; message exactly `Username must be 3-20 characters: letters, digits or underscore`.
- **Backend error bodies** are `{"error": "..."}`; bean-validation failures are a 400 field map `{"field": "message"}`; 429 carries `Retry-After` and `{"error":"Too many requests, try again later"}`.
- **Wire changes are consumed, not invented.** Every request/response shape used here is pinned by a backend spec or was read in the backend code; the assumptions that no spec pins are listed in the Self-Review.
- **Commit messages that adapt to a backend contract** name the backend repo and item in the body, e.g. `Consumes Meawen/stiglja lane-authz C1.`
- **TDD on the changed surface** (vitest + Testing Library). Write the test, watch it fail for the stated reason, implement, watch it pass. No retrofit of untouched code.
- **Node 26 localStorage quirk:** Node 26 defines a global `localStorage` that is undefined without `--localstorage-file`, and it shadows jsdom's. A test that needs real storage borrows jsdom's, exactly as `src/services/api.test.ts` does: `const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window` then `vi.stubGlobal('localStorage', jsdomStorage)`.
- **Type gate (procedure T)** after every code task: no type error that is not in the Task 1 baseline (per-task allowances are stated explicitly). From Task 10 on, `npx tsc -b` must exit 0 and stay at 0.
- **Lint gate (procedure L)** after every code task: no new ESLint finding (file + rule count) in a file the task touched, compared with the Task 1 baseline. Pre-existing findings elsewhere stay.
- **Surgical changes.** Do not reformat, reorder imports or tidy code a task does not need to change. Do not delete or rewrite comments you do not understand.
- **Artifacts** (baselines, logs, pids) go to `/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/`.

## File structure (responsibilities after this plan)

| Unit | Responsibility |
|---|---|
| `src/types/game.ts` | Wire types of the game STOMP channels, mirroring backend `PublicGameView`, `PrivateGameView`, `PlayerPublicInfo {id, cardsLeft}`, `BidDTO`, `Card {boja, rank}`, `Trick`, `QueueStatusDTO`. |
| `src/services/gameSocket.ts` | The tab's single STOMP connection: acquire/release, shared subscriptions, publish, reconnect, state for `useSyncExternalStore`. |
| `src/hooks/useGameWebSocket.ts` | Thin per-component hook over `gameSocket`: ranked-queue and game channel subscriptions, typed actions (`play`, `bid`, `challenge`, `refresh`, `cancel`) with the backend message shapes. Also keeps the UI-only `Card` type the mock boards use. |
| `src/hooks/useBelatroGame.ts` | Game-page state: public/private view, last move error, snapshot refresh until the first private view, actions bound to one game id. |
| `src/components/game/gameView.ts` | Pure helpers: seat rotation, trump, labels. |
| `src/components/game/GameTable.tsx` | Presentational live table: scores, phase, seats, trick, bids, bid panel, hand, challenge, game over. |
| `src/components/game/GamePageConnected.tsx` | `/game/:gameId` page: wires `useBelatroGame` to `GameTable`. |
| `src/components/lobby/LobbyDetails.tsx` | `/lobby/:lobbyId` page body: polls the lobby, host start, every member follows the closed lobby into its match. |
| `src/components/auth/credentialRules.ts` | Client mirror of the backend C5 username/password rules. |
| `src/components/auth/{ConfirmEmail,ForgotPassword,ResetPassword}Page.tsx` | D8 public pages. |
| `src/components/auth/ResendConfirmationButton.tsx` | Resend-confirmation action shared by the banner and the profile. |
| `src/components/profile/ChangeEmailForm.tsx` | D8 change-of-address form. |
| `src/components/layout/UnverifiedEmailBanner.tsx` | D8 banner for unverified accounts (rendered by `AppLayout`). |
| `e2e/gameplay.mjs` | Four-seat gameplay harness (playwright-core resolved from outside the repo). |

## Shared procedures

These are complete command blocks that tasks invoke by name.

### Procedure T — type gate

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
npx tsc -b --pretty false 2>&1 | grep -E '^src/.*error TS' | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u \
  > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/tsc-now.txt
comm -13 /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/tsc-baseline.txt \
         /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/tsc-now.txt
```

Expected: no output (every remaining error was already in the baseline), unless the task names an allowance. Positions are stripped so line shifts do not count as new errors.

### Procedure L — lint gate

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
npx eslint . 2>&1 | awk -v root="$PWD/" '/^\//{f=$0; sub(root, "", f)} /^ +[0-9]+:[0-9]+ +(error|warning)/{n=split($0,a," "); print f" :: "a[n]}' \
  | sort | uniq -c > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/lint-now.txt
diff /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/lint-baseline.txt \
     /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/lint-now.txt
```

Expected: no `>` line for a file the task touched that is new or shows a higher count than its `<` counterpart. Lines for other files, and lines that disappeared, are fine.

### Procedure G — backend gates (run in the main backend checkout; read-only `git show`/`git grep`)

```bash
cd /Users/lmiholic/IdeaProjects/stiglja
# G-B (lane-authz merged): FriendshipDto exists; lobby join and friendship create no longer carry an actor
git show lukasDev:src/main/java/backend/belatro/dtos/FriendshipDto.java >/dev/null && echo "G-B FriendshipDto present"
git show lukasDev:src/main/java/backend/belatro/dtos/JoinLobbyRequestDTO.java | grep -c userId          # expect 0
git show lukasDev:src/main/java/backend/belatro/dtos/CreateFriendshipDTO.java | grep -c fromUserId     # expect 0
# G-C (lane-email merged): UserDto carries pendingEmail and emailVerified; the public email routes exist
git show lukasDev:src/main/java/backend/belatro/dtos/UserDto.java | grep -o -E 'pendingEmail|emailVerified' | sort -u | wc -l   # expect 2
git grep -c -E '"/confirm-email"|"/forgot-password"|"/reset-password"' lukasDev -- src/main/java             # expect 3 matches in total
# G-D (lane-debt incl. stage 2 merged): PlayerPublicInfo has no username; /user/findAll is paged
git show lukasDev:src/main/java/backend/belatro/dtos/PlayerPublicInfo.java | grep -c username        # expect 0
git show lukasDev:src/main/java/backend/belatro/controllers/UserController.java | grep -n -A6 'findAll'  # expect page/size/q parameters (Pageable or @RequestParam)
```

If a file named above no longer exists (a lane renamed it), read the controller that serves the route at `lukasDev` and confirm the shape matches the pinned spec before continuing. If a gate fails, stop the stage and report; do not code against an unmerged contract.

### Procedure R — local rig (backend from a detached worktree + local Docker + SPA dev server)

R0. Ports must be free. If anything listens, identify it with `ps -p <pid> -o command=` and stop — never kill another agent's process.
```bash
lsof -nP -iTCP:8080 -iTCP:5173 -iTCP:27017 -iTCP:6379 -iTCP:1025 -iTCP:8025 -sTCP:LISTEN
```
Expected: no output.

R1. Docker running:
```bash
docker info >/dev/null 2>&1 || open -a Docker
until docker info >/dev/null 2>&1; do sleep 2; done
```

R2. Containers (images are already cached locally: `mongo:7`, `redis:7-alpine`, `axllent/mailpit:v1.31`):
```bash
docker rm -f belatro-fe-mongo belatro-fe-redis belatro-fe-mailpit 2>/dev/null
docker run -d --name belatro-fe-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
docker run -d --name belatro-fe-redis -p 6379:6379 redis:7-alpine
docker run -d --name belatro-fe-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.31 --smtp-auth-accept-any --smtp-auth-allow-insecure
until docker exec belatro-fe-mongo mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; do sleep 1; done
docker exec belatro-fe-mongo mongosh --quiet --eval 'try { rs.status().ok } catch (e) { rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]}).ok }'
```

R3. Backend worktree at the current trunk, built without tests:
```bash
mkdir -p /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend
if [ -d /Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run ]; then
  git -C /Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run checkout --detach lukasDev
else
  git -C /Users/lmiholic/IdeaProjects/stiglja worktree add --detach /Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run lukasDev
fi
test ! -e /Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run/.env || { echo ".env present in fe-run - STOP"; exit 1; }
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-23.jdk/Contents/Home ./gradlew bootJar -x test \
  > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/bootjar.log 2>&1; echo "bootJar exit=$?"
ls -l build/libs/belatro.jar
```

R4. Start the backend. `env -i` keeps any `MONGO_*`/`REDIS_*` variables of the login shell out of the process; every connection setting comes from the command line. `ADMIN_ARG` is empty unless Task 12 sets it.
```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run
JWT_SECRET_VALUE=$(openssl rand -hex 32)
nohup env -i PATH="$PATH" HOME="$HOME" \
  MAIL_HOST=localhost MAIL_PORT=1025 MAIL_USERNAME=e2e MAIL_PASSWORD=e2e \
  MAIL_FROM=no-reply@stiglja.hr APP_BASE_URL=http://localhost:5173 \
  /Library/Java/JavaVirtualMachines/jdk-23.jdk/Contents/Home/bin/java -jar build/libs/belatro.jar \
  --spring.data.mongodb.uri='mongodb://localhost:27017/belatro_fe?replicaSet=rs0&directConnection=true' \
  --spring.data.redis.host=localhost --spring.data.redis.port=6379 \
  --spring.data.redis.username= --spring.data.redis.password= \
  --jwt.secret="$JWT_SECRET_VALUE" ${ADMIN_ARG:-} \
  > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/backend.log 2>&1 &
echo $! > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/backend.pid
for i in $(seq 1 90); do grep -q 'Started BelatroApplication' /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/backend.log && break; sleep 2; done
grep -c 'Started BelatroApplication' /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/backend.log          # expect 1
grep -c -E 'mongodb\+srv|belatrocluster' /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/backend.log      # expect 0
```
If it does not start, read the last 80 lines of `backend.log`; a missing required property means a lane added a new mandatory setting — add it as another `--name=value` override (never copy anything from `stiglja/.env`).

R5. SPA dev server from the frontend worktree (the Vite proxy forwards API, `/actuator` and `/ws` to :8080):
```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
nohup npx vite --port 5173 --strictPort > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/vite.log 2>&1 &
until curl -sf -o /dev/null http://localhost:5173/; do sleep 1; done; echo "vite up"
```

R6. Teardown (verify each pid's command line belongs to this rig before killing):
```bash
BPID=$(cat /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/backend.pid); ps -p "$BPID" -o command= | grep -q 'belatro.jar' && kill "$BPID"
for p in $(lsof -ti tcp:5173 -sTCP:LISTEN); do ps -p "$p" -o command= | grep -q vite && kill "$p"; done
docker rm -f belatro-fe-mongo belatro-fe-redis belatro-fe-mailpit
```

---

# Stage A — no backend dependency

### Task 1: Worktree, install, plan copy, test files out of the app type-check, baselines

**Files:**
- Create: `docs/superpowers/plans/2026-10-01-frontend-addendum.md` (copy of this file)
- Modify: `tsconfig.app.json`

**Interfaces:**
- Produces: worktree at `/Users/lmiholic/IdeaProjects/stiglja-lanes/frontend` on branch `identity-pii-frontend-2`; `node_modules` installed; baselines `tsc-baseline.txt`, `lint-baseline.txt`, `vitest-baseline.txt` in `/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/` (procedures T and L compare against them).

- [ ] **Step 1: Create the worktree (skip if it already exists on the right branch)**

```bash
mkdir -p /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend
if [ ! -d /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend ]; then
  git -C /Users/lmiholic/IdeaProjects/Belatro_FrontEnd_LukasSoloRewrite worktree add -b identity-pii-frontend-2 \
    /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend identity-pii-frontend
fi
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git branch --show-current          # expect identity-pii-frontend-2
git merge-base --is-ancestor 88f8a3f HEAD && echo "contains 88f8a3f"
git status --short                 # expect empty
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend && npm ci
```

Expected: completes without `ERR!`; `ls node_modules/.bin/vitest node_modules/.bin/tsc` both exist.

- [ ] **Step 3: Copy this plan into the worktree and commit it**

```bash
mkdir -p /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend/docs/superpowers/plans
cp /Users/lmiholic/IdeaProjects/Belatro_FrontEnd_LukasSoloRewrite/docs/superpowers/plans/2026-10-01-frontend-addendum.md \
   /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend/docs/superpowers/plans/
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add docs/superpowers/plans/2026-10-01-frontend-addendum.md
git commit -m "docs: plan for the frontend addendum (game page, one socket, Phase 3-5 consumers)" -- docs/superpowers/plans/2026-10-01-frontend-addendum.md
git show --stat HEAD
```

Note for the orchestrator: the original copy stays untracked in the main checkout; move it aside before fast-forwarding `identity-pii-frontend` there, or git refuses to overwrite it.

- [ ] **Step 4: Keep test files out of the app type-check**

`tsc -b` is the gate of `npm run build`. It compiles `src/**`, including test files, which reference vitest globals and `jsdom` without type declarations (3 of today's errors: `src/test/smoke.test.tsx` ×2, `src/services/api.test.ts` ×1). Vitest runs tests through esbuild without type-checking either way, so tests do not belong in the production type gate. Replace the whole of `tsconfig.app.json` with:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test"]
}
```

(The only change is the added `"exclude"` line and the comma before it.)

- [ ] **Step 5: Capture the baselines**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
npx tsc -b --pretty false 2>&1 | grep -E '^src/.*error TS' | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u \
  > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/tsc-baseline.txt
wc -l < /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/tsc-baseline.txt
npx eslint . 2>&1 | awk -v root="$PWD/" '/^\//{f=$0; sub(root, "", f)} /^ +[0-9]+:[0-9]+ +(error|warning)/{n=split($0,a," "); print f" :: "a[n]}' \
  | sort | uniq -c > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/lint-baseline.txt
npm test > /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/vitest-baseline.txt 2>&1; tail -5 /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/vitest-baseline.txt
```

Expected: the tsc baseline has 46 lines (planning measured 49 normalized errors in the main checkout; the exclude removes the 3 test-file errors). If the count differs, record the real number — the baseline file is authoritative, not this estimate. Vitest: `Test Files 4 passed (4)`, `Tests 12 passed (12)`.

- [ ] **Step 6: Commit the tsconfig change**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add tsconfig.app.json
git commit -m "build: keep test files out of the app type-check

tsc -b is the gate of npm run build. Test files reference vitest globals
and jsdom, which the app program has no types for; vitest does not
type-check them either way." -- tsconfig.app.json
git show --stat HEAD
```

---

### Task 2: Profile reads email and roles from `GET /user/me` (old plan Task 5, B1)

**Files:**
- Modify: `src/components/profile/ProfileStats.tsx` (full rewrite below), `src/components/profile/UserProfile.tsx`
- Test: `src/components/profile/ProfileStats.test.tsx`

**Interfaces:**
- Consumes: `useMe(enabled?: boolean)` from `src/hooks/useUser.ts` (exists since commit `1adadd5`; returns the `useApi` result `{ data, isLoading, error, refetch, ... }`); `UserDto` from `src/types/user.ts`.
- Produces: `ProfileStatsProps = { user: User; me?: UserDto | null }` (the unused `isOwnProfile` prop is removed). Task 3 reuses the `me` variable in `UserProfile`; Task 18 adds a `confirmAction` prop.

- [ ] **Step 1: Write the failing test** — create `src/components/profile/ProfileStats.test.tsx`:

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileStats } from './ProfileStats'
import type { User, UserDto } from '../../types/user'

const player: User = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const me: UserDto = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: ['ROLE_ADMIN'], deletionRequested: false }

describe('ProfileStats', () => {
    test("someone else's profile shows stats but no email or roles", () => {
        render(<ProfileStats user={player} />)
        expect(screen.getByText('ana')).toBeInTheDocument()
        expect(screen.getByText('1450')).toBeInTheDocument()
        expect(screen.queryByText('Email:')).not.toBeInTheDocument()
        expect(screen.queryByText('Roles:')).not.toBeInTheDocument()
    })

    test('own profile shows email and roles from /user/me', () => {
        render(<ProfileStats user={player} me={me} />)
        expect(screen.getByText('Email:')).toBeInTheDocument()
        expect(screen.getByText('ana@example.com')).toBeInTheDocument()
        expect(screen.getByText('ADMIN')).toBeInTheDocument()
    })

    test('no experience-points tile: the API no longer serves expPoints', () => {
        render(<ProfileStats user={player} me={me} />)
        expect(screen.queryByText('Experience Points')).not.toBeInTheDocument()
        expect(screen.queryByText('Experience Progress')).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/profile/ProfileStats.test.tsx`
Expected: FAIL — the first test finds `Email:` (today the email row always renders from `user.email`), the third finds `Experience Points`.

- [ ] **Step 3: Rewrite `src/components/profile/ProfileStats.tsx`** with exactly this content:

```tsx
import React from 'react';
import type { User, UserDto } from '../../types/user';

export interface ProfileStatsProps {
    user: User;
    me?: UserDto | null;
}

export const ProfileStats: React.FC<ProfileStatsProps> = ({ user, me }) => {
    const eloRating = user.eloRating || 1200;
    const gamesPlayed = user.gamesPlayed || 0;
    const level = user.level || 1;

    return (
        <div className="space-y-6">
            {/* Game Statistics */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Game Statistics</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-purple-400 mb-1">
                            {eloRating}
                        </div>
                        <div className="text-sm text-slate-400">Current ELO</div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-blue-400 mb-1">
                            {gamesPlayed}
                        </div>
                        <div className="text-sm text-slate-400">Games Played</div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-green-400 mb-1">
                            {level}
                        </div>
                        <div className="text-sm text-slate-400">Level</div>
                    </div>
                </div>
            </div>

            {/* Rank Information */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Ranking</h3>

                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-2xl">
                        {getRankIcon(eloRating)}
                    </div>

                    <div>
                        <h4 className="text-xl font-bold text-white">
                            {getRankName(eloRating)}
                        </h4>
                        <p className="text-slate-400">
                            {eloRating} ELO • {getRankDescription(eloRating)}
                        </p>
                    </div>
                </div>

                {/* ELO Progress to Next Rank */}
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Progress to Next Rank</span>
                        <span className="text-sm text-white font-medium">
              {getProgressToNextRank(eloRating)}%
            </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProgressToNextRank(eloRating)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Account Information */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-slate-400">Username:</span>
                        <div className="text-white font-medium">
                            {user.username || 'Not set'}
                        </div>
                    </div>

                    {/* Email and roles come from GET /user/me and exist only on your own profile. */}
                    {me && (
                        <div>
                            <span className="text-slate-400">Email:</span>
                            <div className="text-white font-medium">
                                {me.email || 'Not set'}
                            </div>
                        </div>
                    )}

                    {me?.roles && me.roles.length > 0 && (
                        <div>
                            <span className="text-slate-400">Roles:</span>
                            <div className="flex gap-1 mt-1">
                                {me.roles.map((role, index) => (
                                    <span key={index} className="badge badge-purple text-xs">
                    {role.replace('ROLE_', '')}
                  </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper functions for rank system
function getRankIcon(elo: number): string {
    if (elo >= 2000) return '👑';
    if (elo >= 1800) return '💎';
    if (elo >= 1600) return '🏆';
    if (elo >= 1400) return '🥈';
    if (elo >= 1200) return '🥉';
    return '🆕';
}

function getRankName(elo: number): string {
    if (elo >= 2000) return 'Grandmaster';
    if (elo >= 1800) return 'Master';
    if (elo >= 1600) return 'Expert';
    if (elo >= 1400) return 'Advanced';
    if (elo >= 1200) return 'Intermediate';
    return 'Beginner';
}

function getRankDescription(elo: number): string {
    if (elo >= 2000) return 'Elite player';
    if (elo >= 1800) return 'Highly skilled';
    if (elo >= 1600) return 'Very experienced';
    if (elo >= 1400) return 'Experienced player';
    if (elo >= 1200) return 'Learning the ropes';
    return 'Just getting started';
}

function getProgressToNextRank(elo: number): number {
    const thresholds = [1200, 1400, 1600, 1800, 2000];
    const nextThreshold = thresholds.find(t => t > elo);

    if (!nextThreshold) return 100; // Max rank reached

    const prevThreshold = thresholds[thresholds.indexOf(nextThreshold) - 1] || 0;
    const progress = ((elo - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

    return Math.min(Math.max(progress, 0), 100);
}
```

(Removed versus today: the `expPoints` tile, the Experience Progress card with its helpers `getExpRequiredForNextLevel`/`getLevelProgress`, the `lastLogin` row, and reads of `user.email`/`user.roles`, none of which the API serves since the identity work.)

- [ ] **Step 4: Edit `src/components/profile/UserProfile.tsx`**

4a. Import `useMe` — replace

```tsx
import { useUser } from '../../hooks/useUser';
```

with

```tsx
import { useUser, useMe } from '../../hooks/useUser';
```

4b. Fetch me-data on your own profile only — replace

```tsx
    const isOwnProfile = !userId || userId === currentUser?.id;
```

with

```tsx
    const isOwnProfile = !userId || userId === currentUser?.id;
    const { data: me } = useMe(isOwnProfile);
```

(Hook call order: this sits above every early `return` in the component.)

4c. Delete the XP subtext — remove exactly:

```tsx
                                <div className="text-xs text-emerald-400">
                                    {displayUser.expPoints || 0} XP
                                </div>
```

4d. Delete the whole "Last Seen" tile — remove exactly:

```tsx
                            <div className="bg-emerald-800/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-emerald-300 text-sm font-medium">Last Seen</span>
                                </div>
                                <div className="text-sm text-white">
                                    {displayUser.lastLogin
                                        ? new Date(displayUser.lastLogin).toLocaleDateString()
                                        : 'Never'
                                    }
                                </div>
                            </div>
```

and change the grid that contained it from `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">` to `<div className="grid grid-cols-2 md:grid-cols-3 gap-4">`.

4e. Header roles come from me-data — replace

```tsx
                        {displayUser.roles && displayUser.roles.length > 0 && (
```

with

```tsx
                        {me?.roles && me.roles.length > 0 && (
```

and replace

```tsx
                                    {displayUser.roles.map((role, index) => (
```

with

```tsx
                                    {me.roles.map((role, index) => (
```

4f. Pass me-data to the stats — replace

```tsx
                <ProfileStats user={displayUser} isOwnProfile={isOwnProfile} />
```

with

```tsx
                <ProfileStats user={displayUser} me={me ?? null} />
```

- [ ] **Step 5: Run the test and the suite**

Run: `npx vitest run src/components/profile/ProfileStats.test.tsx` → 3 passed. Then `npm test` → all files pass.

- [ ] **Step 6: Type and lint gates** — run procedure T (expect no output; the baseline errors in `ProfileStats.tsx` and `UserProfile.tsx` disappear) and procedure L (no new finding in the two files).

- [ ] **Step 7: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/profile/ProfileStats.tsx src/components/profile/ProfileStats.test.tsx src/components/profile/UserProfile.tsx
git commit -m "feat(profile): source email and roles from GET /user/me; drop fields the API no longer returns" -- src/components/profile/ProfileStats.tsx src/components/profile/ProfileStats.test.tsx src/components/profile/UserProfile.tsx
git show --stat HEAD
```

---

### Task 3: Request account deletion (old plan Task 6, B2)

**Files:**
- Modify: `src/components/profile/UserProfile.tsx`
- Test: `src/components/profile/UserProfile.test.tsx`

**Interfaces:**
- Consumes: `useMe` (Task 2), `userService.requestForget(): Promise<void>` (`POST /user/me/request-forget`, exists since `1adadd5`), `useMutation` from `src/hooks/useApi.ts`.
- Produces: an own-profile-only "Account" card with the states request → confirm → requested. Task 18 extends this test file.

- [ ] **Step 1: Write the failing test** — create `src/components/profile/UserProfile.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProfile } from './UserProfile'
import { userService } from '../../services/userService'
import { useUser, useMe } from '../../hooks/useUser'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false }),
}))
vi.mock('../../hooks/useUser', () => ({
    useUser: vi.fn(),
    useMe: vi.fn(),
}))
vi.mock('../../services/userService', () => ({
    userService: { requestForget: vi.fn(), changePassword: vi.fn() },
}))

const player = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: null, deletionRequested: false }
const refetchMe = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({ user: player, isLoading: false, error: null, refetch: vi.fn() } as never)
    vi.mocked(useMe).mockReturnValue({ data: meBase, isLoading: false, error: null, refetch: refetchMe } as never)
})

describe('UserProfile deletion request', () => {
    test('request goes through a confirm step, calls the service, refreshes me', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.requestForget).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: /request account deletion/i }))
        expect(userService.requestForget).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: /confirm request/i }))
        expect(userService.requestForget).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(refetchMe).toHaveBeenCalled())
    })

    test('an already-flagged account shows the requested state instead of the button', () => {
        vi.mocked(useMe).mockReturnValue({ data: { ...meBase, deletionRequested: true }, isLoading: false, error: null, refetch: refetchMe } as never)
        render(<UserProfile />)
        expect(screen.getByText(/deletion requested/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })

    test("someone else's profile has no deletion section", () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: null, refetch: refetchMe } as never)
        render(<UserProfile userId="u2" />)
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/profile/UserProfile.test.tsx`
Expected: FAIL — "Unable to find an accessible element with the role "button" and name `/request account deletion/i`".

- [ ] **Step 3: Implement in `src/components/profile/UserProfile.tsx`**

3a. Imports — replace

```tsx
import { useUser, useMe } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
```

with

```tsx
import { useUser, useMe } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
// direct module import (not the ../../hooks barrel) so the component test does
// not load every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
```

3b. Expose `refetch` from `useMe` and add the deletion state — replace

```tsx
    const { data: me } = useMe(isOwnProfile);
```

with

```tsx
    const { data: me, refetch: refetchMe } = useMe(isOwnProfile);

    const [confirmingDeletion, setConfirmingDeletion] = useState(false);
    const [deletionError, setDeletionError] = useState<string | null>(null);
    const requestForgetMutation = useMutation(() => userService.requestForget());

    const handleRequestDeletion = async () => {
        try {
            setDeletionError(null);
            await requestForgetMutation.mutate();
            setConfirmingDeletion(false);
            refetchMe();
        } catch (error) {
            setDeletionError(error instanceof Error ? error.message : 'Failed to request deletion');
        }
    };
```

3c. Render the Account card after the stats tab — replace

```tsx
            {/* Tab Content */}
            {activeTab === 'stats' && (
                <ProfileStats user={displayUser} me={me ?? null} />
            )}
```

with

```tsx
            {/* Tab Content */}
            {activeTab === 'stats' && (
                <ProfileStats user={displayUser} me={me ?? null} />
            )}

            {isOwnProfile && (
                <div className="card border border-red-500/30">
                    <h3 className="text-lg font-semibold text-white mb-3">Account</h3>
                    {me?.deletionRequested ? (
                        <p className="text-amber-400 text-sm">
                            Deletion requested — an administrator will process your account removal.
                        </p>
                    ) : confirmingDeletion ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-red-300 text-sm flex-1 min-w-[200px]">
                                Request deletion of your account? An administrator has to approve it; you can keep playing until then.
                            </p>
                            <Button variant="outline" size="small" onClick={() => setConfirmingDeletion(false)}>
                                Keep my account
                            </Button>
                            <Button
                                variant="primary"
                                size="small"
                                disabled={requestForgetMutation.isLoading}
                                isLoading={requestForgetMutation.isLoading}
                                onClick={handleRequestDeletion}
                                className="bg-red-600 hover:bg-red-500"
                            >
                                Confirm request
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="small"
                            onClick={() => setConfirmingDeletion(true)}
                            className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                        >
                            Request account deletion
                        </Button>
                    )}
                    {deletionError && <p className="text-red-400 text-sm mt-2">{deletionError}</p>}
                </div>
            )}
```

- [ ] **Step 4: Run the test and the suite** — `npx vitest run src/components/profile/UserProfile.test.tsx` → 3 passed; `npm test` → all pass.

- [ ] **Step 5: Gates** — procedures T and L (no new output for `UserProfile.tsx`).

- [ ] **Step 6: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/profile/UserProfile.tsx src/components/profile/UserProfile.test.tsx
git commit -m "feat(profile): self-service account deletion request via POST /user/me/request-forget" -- src/components/profile/UserProfile.tsx src/components/profile/UserProfile.test.tsx
git show --stat HEAD
```

---

### Task 4: Admin gating from `GET /user/me` (old plan Task 8, B4)

**Files:**
- Modify: `src/components/auth/AuthGuard.tsx`, `src/components/admin/AdminDashboard.tsx`, `src/components/layout/Sidebar.tsx`
- Test: `src/components/auth/AuthGuard.test.tsx`, `src/components/admin/AdminDashboard.test.tsx`, `src/components/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `useMe(enabled?: boolean)` (barrel `src/hooks/index.ts` already exports it; `AuthGuard` imports from the barrel, the other two from `src/hooks/useUser`).
- Produces: admin checks everywhere read `me.roles` containing `'ROLE_ADMIN'`. The `/admin` route in `App.tsx` wraps only `ProtectedRoute`, so **`AdminDashboard`'s own check is the live gate**; `AuthGuard requireAdmin` and the Sidebar link are fixed for consistency. (Sidebar was added beyond the old plan: it hard-codes `const isAdmin = false` with a TODO for exactly this, so no admin could ever see the Admin Panel link.)

- [ ] **Step 1: Write the failing tests**

`src/components/auth/AuthGuard.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthGuard } from './AuthGuard'
import { useAuth, useMe } from '../../hooks'

vi.mock('../../hooks', () => ({
    useAuth: vi.fn(),
    useMe: vi.fn(),
}))

const authed = { user: { id: 'u1', username: 'ana' }, isLoading: false, isAuthenticated: true }

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue(authed as never)
})

describe('AuthGuard admin gating', () => {
    test('admin (per /user/me) sees the children', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] }, isLoading: false, error: null } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.getByText('secret')).toBeInTheDocument()
    })

    test('non-admin is denied', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: [] }, isLoading: false, error: null } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.queryByText('secret')).not.toBeInTheDocument()
        expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    })

    test('shows loading while /user/me resolves', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: true, error: null } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.queryByText('secret')).not.toBeInTheDocument()
        expect(screen.getByText('Checking permissions...')).toBeInTheDocument()
    })

    test('a failed /user/me denies instead of spinning forever', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: { status: 500, message: 'boom' } } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    })

    test('non-admin routes never consult /user/me', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: null } as never)
        render(<AuthGuard><div>plain</div></AuthGuard>)
        expect(screen.getByText('plain')).toBeInTheDocument()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(false)
    })
})
```

`src/components/admin/AdminDashboard.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminDashboard } from './AdminDashboard'
import { useMe } from '../../hooks/useUser'

vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))
// the pre-fix component reads roles off the auth user, which never has any
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))
vi.mock('./AdminStats', () => ({ AdminStats: () => <div>stats panel</div> }))
vi.mock('./UserManagement', () => ({ UserManagement: () => <div>user management</div> }))
vi.mock('./SystemStatus', () => ({ SystemStatus: () => <div>system status</div> }))

beforeEach(() => vi.clearAllMocks())

describe('AdminDashboard gate (the live /admin gate)', () => {
    test('an admin per /user/me sees the dashboard', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] }, error: null } as never)
        render(<AdminDashboard />)
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
        expect(screen.getByText('stats panel')).toBeInTheDocument()
    })

    test('a non-admin is denied', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_USER'] }, error: null } as never)
        render(<AdminDashboard />)
        expect(screen.getByText('Access Denied')).toBeInTheDocument()
        expect(screen.queryByText('stats panel')).not.toBeInTheDocument()
    })

    test('waits for /user/me instead of flashing a denial', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, error: null } as never)
        render(<AdminDashboard />)
        expect(screen.getByText('Checking permissions...')).toBeInTheDocument()
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
    })
})
```

`src/components/layout/Sidebar.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useMe } from '../../hooks/useUser'

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, logout: vi.fn(), isAuthenticated: true }),
}))
vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

function renderSidebar() {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
}

describe('Sidebar admin link', () => {
    test('shows Admin Panel to an admin per /user/me', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] } } as never)
        renderSidebar()
        expect(screen.getByText('Admin Panel')).toBeInTheDocument()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('hides it from everyone else', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_USER'] } } as never)
        renderSidebar()
        expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/auth/AuthGuard.test.tsx src/components/admin/AdminDashboard.test.tsx src/components/layout/Sidebar.test.tsx`
Expected: FAIL — AuthGuard: "admin sees the children" fails (roles read from the auth user, which has none) and `useMe` is never called; AdminDashboard: "Unable to find an element with the text: Admin Dashboard"; Sidebar: "Unable to find an element with the text: Admin Panel".

- [ ] **Step 3: Rewrite `src/components/auth/AuthGuard.tsx`** with exactly:

```tsx

import React from 'react';
import { useAuth, useMe } from '../../hooks';
import { Loading } from '../common';

export interface AuthGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    requireAdmin?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
                                                        children,
                                                        fallback,
                                                        requireAdmin = false,
                                                    }) => {
    const { isLoading, isAuthenticated } = useAuth();
    // Roles live only in GET /user/me; the stored login user never carried them.
    const { data: me, isLoading: isMeLoading, error: meError } = useMe(requireAdmin && isAuthenticated);

    if (isLoading) {
        return <Loading size="large" text="Checking authentication..." fullScreen />;
    }

    if (!isAuthenticated) {
        return fallback || (
            <div className="card max-w-md mx-auto mt-8 text-center">
                <div className="text-yellow-500 text-6xl mb-4">🔒</div>
                <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
                <p className="text-slate-400">Please sign in to access this content.</p>
            </div>
        );
    }

    if (requireAdmin) {
        if (!meError && (isMeLoading || !me)) {
            return <Loading size="large" text="Checking permissions..." fullScreen />;
        }
        if (!me?.roles?.some(role => role === 'ROLE_ADMIN')) {
            return (
                <div className="card max-w-md mx-auto mt-8 text-center">
                    <div className="text-red-500 text-6xl mb-4">⛔</div>
                    <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                    <p className="text-slate-400">You don't have permission to access this content.</p>
                </div>
            );
        }
    }

    return <>{children}</>;
};
```

- [ ] **Step 4: Edit `src/components/admin/AdminDashboard.tsx`**

Replace

```tsx
import { useAuth } from '../../hooks/useAuth';

export const AdminDashboard: React.FC = () => {
    const { user } = useAuth();

    // Check if user has admin role
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');

    if (!isAdmin) {
```

with

```tsx
import { useMe } from '../../hooks/useUser';
import { Loading } from '../common';

export const AdminDashboard: React.FC = () => {
    // Roles come only from GET /user/me; the stored login user never carried them.
    const { data: me, error } = useMe();

    if (!me && !error) {
        return <Loading size="large" text="Checking permissions..." />;
    }

    const isAdmin = me?.roles?.includes('ROLE_ADMIN') ?? false;

    if (!isAdmin) {
```

- [ ] **Step 5: Edit `src/components/layout/Sidebar.tsx`**

5a. Replace `import { useAuth } from '../../hooks/useAuth';` with

```tsx
import { useAuth } from '../../hooks/useAuth';
import { useMe } from '../../hooks/useUser';
```

5b. Replace

```tsx
    // For now, we'll disable admin features since UserLoginDetailsDTO doesn't include roles
    // You might need to add a separate API call to get full user details with roles
    const isAdmin = false; // TODO: Implement proper admin check when role info is available
```

with

```tsx
    // Roles come from GET /user/me; the stored login user (UserLoginDetailsDTO) has none.
    const { data: me } = useMe(isAuthenticated);
    const isAdmin = me?.roles?.includes('ROLE_ADMIN') ?? false;
```

(The component has no early return before this line, so the hook order is stable.)

- [ ] **Step 6: Run the tests and the suite** — the three files pass (5 + 3 + 2 tests); `npm test` all pass.

- [ ] **Step 7: Gates** — procedure T (the baseline errors in `AuthGuard.tsx` and `AdminDashboard.tsx` disappear; nothing new), procedure L.

- [ ] **Step 8: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/auth/AuthGuard.tsx src/components/auth/AuthGuard.test.tsx src/components/admin/AdminDashboard.tsx src/components/admin/AdminDashboard.test.tsx src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "fix(admin): gate on roles from GET /user/me; the auth-context user never had roles

AdminDashboard is the live /admin gate. The sidebar hard-coded isAdmin to
false, so no admin ever saw the Admin Panel link." -- src/components/auth/AuthGuard.tsx src/components/auth/AuthGuard.test.tsx src/components/admin/AdminDashboard.tsx src/components/admin/AdminDashboard.test.tsx src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git show --stat HEAD
```

---
### Task 5: Drop the inert `?user=` and `X-Player-Name` from the socket (old plan Task 9, B5) — now committable

The WIP that made this file uncommitted is committed (`88f8a3f`), so this edit is committed too. Task 7 then moves the whole connection into `src/services/gameSocket.ts`; this task only removes the two impersonation-era leftovers so that history shows their removal on its own. Its regression test lands in Task 7 (`stompConfig` test: the socket URL is exactly `/ws` and the CONNECT headers are exactly `{ Authorization }`).

**Files:**
- Modify: `src/hooks/useGameWebSocket.ts` (the `webSocketFactory` and `connectHeaders` of the `Client` built in `connect()`)

**Interfaces:**
- Consumes: nothing new. Produces: SockJS URL `/ws` with no query; CONNECT headers without `X-Player-Name`. The backend (`WsConfig`) reads only `Authorization: Bearer` on CONNECT.

- [ ] **Step 1: Remove `?user=`** — in `src/hooks/useGameWebSocket.ts` replace

```ts
                    webSocketFactory: () => {
                        const base = optionsRef.current.wsPath || '/ws';
                        const wsUrl = user?.username ? `${base}?user=${encodeURIComponent(user.username)}` : base;
                        const sock = new SockJS(wsUrl);
                        return sock;
                    },
```

with

```ts
                    webSocketFactory: () => {
                        const base = optionsRef.current.wsPath || '/ws';
                        return new SockJS(base);
                    },
```

- [ ] **Step 2: Remove `X-Player-Name`** — in the same file delete only the line

```ts
                            headers['X-Player-Name'] = user.username;
```

Leave `headers['login']`, `headers['Authorization']` and `headers['auth-token']` as they are (Task 7 replaces this whole block).

- [ ] **Step 3: Verify**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
grep -n -e '?user=' -e 'X-Player-Name' src/hooks/useGameWebSocket.ts   # expect no output
npm test                                                                 # expect all pass
```

Then procedures T and L (no new output).

- [ ] **Step 4: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/hooks/useGameWebSocket.ts
git commit -m "fix(ws): drop the inert ?user= query and X-Player-Name header

The backend takes the socket identity only from the Bearer token on the
STOMP CONNECT frame; ?user= was the impersonation hole it closed." -- src/hooks/useGameWebSocket.ts
git show --stat HEAD
```

---

### Task 6: Username and password rules in the forms, trimmed usernames, readable 400s (C5 consumer)

**Files:**
- Create: `src/components/auth/credentialRules.ts`, `src/components/auth/credentialRules.test.ts`, `src/components/auth/SignupForm.test.tsx`, `src/components/auth/LoginForm.test.tsx`
- Modify: `src/components/auth/SignupForm.tsx`, `src/components/auth/LoginForm.tsx`, `src/components/profile/ChangePasswordForm.tsx`, `src/components/profile/ChangePasswordForm.test.tsx`, `src/services/api.ts`, `src/services/api.test.ts`

**Interfaces:**
- Consumes (backend, foundation C5, pinned): `SignupRequestDTO.username` must match `^[A-Za-z0-9_]{3,20}$` on the **raw** value (leading/trailing spaces are a 400); `@ValidPassword` on signup `password`, `PasswordChangeRequest.newPassword` and the reset `newPassword`; failures are a 400 field map such as `{"password":"Password must be at least 8 characters and at most 72 bytes"}`.
- Produces:
  - `PASSWORD_RULE_MESSAGE`, `USERNAME_RULE_MESSAGE` (exact backend messages)
  - `passwordRuleError(password: string): string | null`
  - `usernameRuleError(username: string): string | null`
  - `apiClient` errors: message = `body.message || body.error || <first string value of a field map> || "HTTP <status>: <text>"`.
  - Task 17 (`ResetPasswordPage`) reuses `passwordRuleError`.

- [ ] **Step 1: Write the failing tests**

`src/components/auth/credentialRules.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { passwordRuleError, usernameRuleError, PASSWORD_RULE_MESSAGE, USERNAME_RULE_MESSAGE } from './credentialRules'

describe('passwordRuleError (mirrors backend @ValidPassword)', () => {
    test('8 characters is enough, 7 is not', () => {
        expect(passwordRuleError('12345678')).toBeNull()
        expect(passwordRuleError('1234567')).toBe(PASSWORD_RULE_MESSAGE)
    })
    test('the cap is 72 bytes of UTF-8, not 72 characters', () => {
        expect(passwordRuleError('a'.repeat(72))).toBeNull()
        expect(passwordRuleError('a'.repeat(73))).toBe(PASSWORD_RULE_MESSAGE)
        // 37 x "ä" is 37 characters but 74 bytes
        expect(passwordRuleError('ä'.repeat(37))).toBe(PASSWORD_RULE_MESSAGE)
    })
    test('the message is the backend one, word for word', () => {
        expect(PASSWORD_RULE_MESSAGE).toBe('Password must be at least 8 characters and at most 72 bytes')
    })
})

describe('usernameRuleError (mirrors SignupRequestDTO @Pattern)', () => {
    test('letters, digits and underscore, 3 to 20 long', () => {
        expect(usernameRuleError('Ana_99')).toBeNull()
        expect(usernameRuleError('ab')).toBe(USERNAME_RULE_MESSAGE)
        expect(usernameRuleError('a'.repeat(21))).toBe(USERNAME_RULE_MESSAGE)
        expect(usernameRuleError('ana.b')).toBe(USERNAME_RULE_MESSAGE)
        expect(usernameRuleError('ana b')).toBe(USERNAME_RULE_MESSAGE)
    })
    test('the message is the backend one, word for word', () => {
        expect(USERNAME_RULE_MESSAGE).toBe('Username must be 3-20 characters: letters, digits or underscore')
    })
})
```

`src/components/auth/SignupForm.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'

const auth = vi.hoisted(() => ({ signup: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ signup: auth.signup, isSignupLoading: false }),
}))

beforeEach(() => vi.clearAllMocks())

async function fill(username: string, password: string, confirm = password) {
    const user = userEvent.setup()
    render(<SignupForm onSuccess={vi.fn()} />)
    await user.type(screen.getByLabelText('Username'), username)
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), password)
    await user.type(screen.getByLabelText('Confirm Password'), confirm)
    await user.click(screen.getByRole('button', { name: /create account/i }))
}

describe('SignupForm credential rules', () => {
    test('a 7-character password is refused with the backend message', async () => {
        await fill('ana', 'short12')
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a password over 72 bytes is refused', async () => {
        await fill('ana', 'ä'.repeat(37))
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a username outside the pattern is refused', async () => {
        await fill('ana.b', 'long-enough-1')
        expect(screen.getByText('Username must be 3-20 characters: letters, digits or underscore')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a valid form sends the trimmed username', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await fill('  ana  ', 'long-enough-1')
        expect(auth.signup).toHaveBeenCalledWith({ username: 'ana', email: 'ana@example.com', password: 'long-enough-1' })
    })
})
```

`src/components/auth/LoginForm.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginForm } from './LoginForm'

const auth = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ login: auth.login, isLoginLoading: false }),
}))

beforeEach(() => vi.clearAllMocks())

describe('LoginForm', () => {
    test('sends the trimmed username (the backend matches the raw value)', async () => {
        const user = userEvent.setup()
        auth.login.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        await user.type(screen.getByLabelText('Username'), ' ana ')
        await user.type(screen.getByLabelText('Password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: /sign in/i }))
        expect(auth.login).toHaveBeenCalledWith({ username: 'ana', password: 'long-enough-1' })
    })
})
```

In `src/components/profile/ChangePasswordForm.test.tsx` replace the line

```tsx
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
```

with

```tsx
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
```

In `src/services/api.test.ts`, inside `describe('apiClient error handling', ...)`, add after the test `'prefers "message" over "error" when both exist'`:

```ts
    test('a validation field map surfaces its first message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(400, { password: 'Password must be at least 8 characters and at most 72 bytes' })))
        await expect(apiClient.post('/api/auth/signup', {})).rejects.toMatchObject({
            status: 400, message: 'Password must be at least 8 characters and at most 72 bytes',
        })
    })
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/auth src/components/profile/ChangePasswordForm.test.tsx src/services/api.test.ts`
Expected: FAIL — `credentialRules` module not found; SignupForm accepts the 7-character password (min is 6) and the username `ana.b`, and sends `'  ana  '`; LoginForm sends `' ana '`; ChangePasswordForm still says "at least 6 characters"; the field-map test gets `HTTP 400: status-400`.

- [ ] **Step 3: Create `src/components/auth/credentialRules.ts`**

```ts
/**
 * Client-side mirror of the backend's credential rules (stiglja, roadmap C5).
 * The server enforces them; mirroring them here only saves a round trip, so the
 * messages are the backend's own, word for word.
 */

/** backend.belatro.validation.ValidPassword */
export const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and at most 72 bytes';

/** SignupRequestDTO.username @Pattern */
export const USERNAME_RULE_MESSAGE = 'Username must be 3-20 characters: letters, digits or underscore';

const MIN_PASSWORD_LENGTH = 8;
// BCrypt ignores everything after 72 bytes, so the backend refuses longer passwords.
const MAX_PASSWORD_BYTES = 72;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export function passwordRuleError(password: string): string | null {
    const tooShort = password.length < MIN_PASSWORD_LENGTH;
    const tooLong = new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
    return tooShort || tooLong ? PASSWORD_RULE_MESSAGE : null;
}

export function usernameRuleError(username: string): string | null {
    return USERNAME_PATTERN.test(username) ? null : USERNAME_RULE_MESSAGE;
}
```

- [ ] **Step 4: Edit `src/components/auth/SignupForm.tsx`**

4a. Add the import below `import { useAuth } from '../../hooks/useAuth';`:

```tsx
import { passwordRuleError, usernameRuleError } from './credentialRules';
```

4b. Replace

```tsx
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }
```

with

```tsx
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else {
            const usernameError = usernameRuleError(formData.username.trim());
            if (usernameError) newErrors.username = usernameError;
        }
```

4c. Replace

```tsx
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }
```

with

```tsx
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else {
            const passwordError = passwordRuleError(formData.password);
            if (passwordError) newErrors.password = passwordError;
        }
```

4d. Send the trimmed username — replace

```tsx
            const result = await signup({
                username: formData.username,
```

with

```tsx
            const result = await signup({
                // the backend validates the raw value, so stray spaces would be a 400
                username: formData.username.trim(),
```

- [ ] **Step 5: Edit `src/components/auth/LoginForm.tsx`** — replace

```tsx
            const result = await login({
                username: formData.username,
```

with

```tsx
            const result = await login({
                username: formData.username.trim(),
```

- [ ] **Step 6: Edit `src/components/profile/ChangePasswordForm.tsx`**

6a. Add below `import type { ChangePasswordRequest } from '../../types/user';`:

```tsx
import { passwordRuleError } from '../auth/credentialRules';
```

6b. Replace

```tsx
        if (!formData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (formData.newPassword.length < 6) {
            newErrors.newPassword = 'Password must be at least 6 characters';
        }
```

with

```tsx
        if (!formData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else {
            const passwordError = passwordRuleError(formData.newPassword);
            if (passwordError) newErrors.newPassword = passwordError;
        }
```

- [ ] **Step 7: Edit `src/services/api.ts`**

7a. Add above `class ApiClient {`:

```ts
// Bean-validation failures arrive as a field map, e.g. {"password": "..."}.
function firstFieldMessage(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const value = Object.values(body as Record<string, unknown>).find((v) => typeof v === 'string');
    return typeof value === 'string' ? value : undefined;
}

```

7b. Replace

```ts
                    message: errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`,
```

with

```ts
                    message: errorData.message || errorData.error || firstFieldMessage(errorData) || `HTTP ${response.status}: ${response.statusText}`,
```

- [ ] **Step 8: Run the tests and the suite**

Run: `npx vitest run src/components/auth src/components/profile/ChangePasswordForm.test.tsx src/services/api.test.ts` → all pass (credentialRules 5, SignupForm 4, LoginForm 1, ChangePasswordForm 3, api 5). Then `npm test` → all pass.

- [ ] **Step 9: Gates** — procedures T and L (nothing new in the six touched source files).

- [ ] **Step 10: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/auth/credentialRules.ts src/components/auth/credentialRules.test.ts src/components/auth/SignupForm.tsx src/components/auth/SignupForm.test.tsx src/components/auth/LoginForm.tsx src/components/auth/LoginForm.test.tsx src/components/profile/ChangePasswordForm.tsx src/components/profile/ChangePasswordForm.test.tsx src/services/api.ts src/services/api.test.ts
git commit -m "feat(auth): mirror the 8-72 byte password and username rules; trim usernames; show field-map 400s

Consumes Meawen/stiglja foundation C5: @ValidPassword on signup and password
change, the raw-username pattern, and 400 field-error maps." -- src/components/auth/credentialRules.ts src/components/auth/credentialRules.test.ts src/components/auth/SignupForm.tsx src/components/auth/SignupForm.test.tsx src/components/auth/LoginForm.tsx src/components/auth/LoginForm.test.tsx src/components/profile/ChangePasswordForm.tsx src/components/profile/ChangePasswordForm.test.tsx src/services/api.ts src/services/api.test.ts
git show --stat HEAD
```

---

### Task 7: One STOMP connection per tab, and the game protocol the backend actually speaks (B7 + B8 protocol)

**Why one task:** both changes rewrite the same file (`useGameWebSocket.ts`) and its two consumers.

**B7 — what is wrong today (read in code):** `PlayPage` mounts `PlayButton`, `QueueStatus` and `MatchFoundModal`; each calls `useEnhancedRanked()`, which calls `useGameWebSocket()`, which owns a private `Client`. Each instance auto-connects twice (its own effect and `useEnhancedRanked`'s effect), `connect()` awaits a health check *before* it records the pending connection, and every `connect()` deactivates the instance's previous client — so concurrent calls race and tear each other down (runtime: ~17 sockets opened, ~9 killed, in 0.7 s). React StrictMode doubles all of it in dev.

**B7 design (decided):** the sole owner of the connection is a **module-level manager**, `src/services/gameSocket.ts`, not a React context. Reason: `useAuth()` has no shared state — every call reads `localStorage` once on mount — so a provider mounted at the app root would never see a login that happens after mount, and route elements remount unpredictably; a module owner needs no placement and is unit-testable with a fake client factory. It is ref-counted (`acquire()` returns `release`; the last release closes after a 1 s grace, which also absorbs StrictMode's mount/unmount/mount), multiplexes subscriptions (one STOMP SUBSCRIBE per destination however many hooks listen, re-sent after every connect), and exposes `reconnect()` for token rotation (Task 15). `useGameWebSocket` becomes a thin hook over it (`useSyncExternalStore` for state). `useEnhancedRanked` loses its own connect effect. The pre-connect `GET /actuator/health` probe goes away (it was the race window, and CONSTELLATION.md documents it as a same-origin-only production trap).

**B8 protocol gaps fixed here (read in code, backend `stiglja`):**
- Cards are `{boja, rank}` with `Boja ∈ KARA|HERC|TREF|PIK` and `Rank ∈ SEDMICA..AS` (`pojo/gamelogic/Card.java`, enums); the SPA sent `{suit, rank}` and the WIP page mapped Karo to `KARO` — the backend could not deserialize either.
- `PlayCardMsg` is `{card, declareBela}` and `BidMsg` is `{pass, trump}`; the actor comes from the JWT principal. The SPA's `playerId` field is dropped now (E5's STOMP item, no backend dependency: the backend already ignores it).
- `PlayerPublicInfo` is `{username, id, cardsLeft}` today and `{id, cardsLeft}` after lane-debt E5; the SPA typed `{username, playerId, handSize}` and the old `GameBoard` read `id`/`cardCount`. The new type is `{id, cardsLeft}` — valid against both backend versions (E5's frontend part, done here).
- `Trick` serializes as `{leadPlayerId, trump, plays: {playerId: card}, …}` (a map, not a list); `gameState` has 8 values; `PublicGameView` also carries `declarations`, `belaDeclaredByPlayer`, `challengeWindowExpiresAt`.
- The page subscribed with an effect keyed on a new object every render (subscribe/unsubscribe loop) and never asked for state. `@SubscribeMapping` on `/topic/games/{id}` and `/queue/games/{id}` never runs (those are not `/app` destinations), and the server fans out only on actions — a page that subscribes after the deal sees nothing until it sends `/app/games/{id}/refresh`.
- Rejected moves by non-participants arrive as plain text on `/user/queue/errors`; it was never subscribed. (Illegal cards and out-of-turn bids are silently ignored by the backend — no error frame exists for them.)

**Files:**
- Modify (content replaced): `src/types/game.ts`, `src/hooks/useGameWebSocket.ts`, `src/hooks/useBelatroGame.ts`
- Create: `src/services/gameSocket.ts`, `src/services/gameSocket.test.ts`, `src/hooks/useGameWebSocket.test.tsx`, `src/hooks/useBelatroGame.test.tsx`, `src/components/game/PlayPage.test.tsx`
- Modify: `src/hooks/useEnhancedRanked.ts`, `src/components/game/MatchFoundModal.tsx`, `src/MockComponents/MockGameBoard.tsx`, `src/MockComponents/RealisticGameBoard.tsx`

**Interfaces:**
- Consumes (backend, verified in code): STOMP endpoint `/ws` (SockJS); CONNECT header `Authorization: Bearer <jwt>`; destinations `/topic/games/{id}` (public view, or the bare string `DISCONNECT` on cancel), `/user/queue/games/{id}` (private view), `/user/queue/errors` (text), `/user/queue/ranked/status` (`QueueStatusDTO`), `/user/queue/match-found` (`MatchDTO` with `teamA/teamB: {id, username}[]`); sends `/app/games/{id}/{play|bid|challenge|refresh|cancel}`.
- Produces:
  - `src/types/game.ts`: `Boja`, `Rank`, `GamePhase`, `GameCard`, `PlayerPublicInfo`, `GameBid`, `LiveTrick`, `DeclarationsView`, `PublicGameView`, `PrivateGameView`, `QueueStatusDTO` (exact definitions in Step 3; re-exported by `src/types/index.ts`).
  - `src/services/gameSocket.ts`: `gameSocket` with `acquire(): () => void`, `subscribe(destination: string, handler: (body: string) => void): () => void`, `publish(destination: string, body: unknown): boolean`, `reconnect(): void`, `getState(): GameSocketState`, `onStateChange(listener: () => void): () => void`; plus `createGameSocket(createClient?, getToken?)`, `stompConfig(token, handlers)`, types `GameSocketState`, `StompClientLike`, `StompClientHandlers`, `StompClientFactory`.
  - `useGameWebSocket(options)` → `{ isConnected, isConnecting, connectionError, subscribeToRankedQueue(), unsubscribeFromRankedQueue(), subscribeToGame(gameId), unsubscribeFromGame(gameId), playCard(gameId, card: GameCard, declareBela: boolean), placeBid(gameId, pass: boolean, trump?: Boja), challenge(gameId), refreshGameState(gameId), cancelMatch(gameId) }`; options `{ onQueueStatusUpdate?, onMatchFound?, onPublicGameUpdate?, onPrivateGameUpdate?, onGameError?, onGameDisconnect? }`. Also still exports the UI-only `Card {suit, rank}` used by the mock boards.
  - `useBelatroGame(gameId: string, onDisconnect?: () => void)` → `{ publicView: PublicGameView | null, privateView: PrivateGameView | null, isConnected: boolean, connectionError: string | null, error: string | null, actions: { bidTrump(trump: Boja), passBid(), play(card: GameCard), challenge() } }`. Task 8 consumes this exact shape.
- **Type-gate allowance for this task only:** new errors in `src/components/game/GameBoard.tsx` and `src/components/game/GamePageConnected.tsx` (they still use the removed exports; Task 8 deletes the first and rewrites the second).

- [ ] **Step 1: Write the failing tests**

`src/services/gameSocket.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IMessage, StompSubscription } from '@stomp/stompjs'

const sockjs = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('sockjs-client', () => ({
    default: class FakeSockJS {
        constructor(url: string) { sockjs.urls.push(url) }
    },
}))
vi.mock('@stomp/stompjs', () => ({ Client: class FakeClient {} }))

import { createGameSocket, stompConfig, type StompClientHandlers, type StompClientLike } from './gameSocket'

class FakeClient implements StompClientLike {
    activated = 0
    deactivated = 0
    published: { destination: string; body: string }[] = []
    subs: { destination: string; callback: (m: IMessage) => void; active: boolean }[] = []
    token: string
    handlers: StompClientHandlers
    constructor(token: string, handlers: StompClientHandlers) {
        this.token = token
        this.handlers = handlers
    }
    activate() { this.activated += 1 }
    deactivate() { this.deactivated += 1 }
    publish(params: { destination: string; body: string }) { this.published.push(params) }
    subscribe(destination: string, callback: (m: IMessage) => void): StompSubscription {
        const sub = { destination, callback, active: true }
        this.subs.push(sub)
        return { id: `sub-${this.subs.length}`, unsubscribe: () => { sub.active = false } }
    }
    deliver(destination: string, body: string) {
        this.subs.filter((s) => s.active && s.destination === destination)
            .forEach((s) => s.callback({ body } as IMessage))
    }
    activeSubs(destination: string) {
        return this.subs.filter((s) => s.active && s.destination === destination).length
    }
}

function setup(token: string | null = 'tok-1') {
    const clients: FakeClient[] = []
    let currentToken = token
    const socket = createGameSocket(
        (t, handlers) => { const c = new FakeClient(t, handlers); clients.push(c); return c },
        () => currentToken,
    )
    return { socket, clients, setToken: (t: string) => { currentToken = t } }
}

beforeEach(() => { vi.useFakeTimers(); sockjs.urls.length = 0 })
afterEach(() => { vi.useRealTimers() })

describe('gameSocket: one STOMP connection per tab', () => {
    test('any number of holders share one client', () => {
        const { socket, clients } = setup()
        socket.acquire(); socket.acquire(); socket.acquire()
        expect(clients).toHaveLength(1)
        expect(clients[0].activated).toBe(1)
        expect(socket.getState()).toEqual({ isConnected: false, isConnecting: true, error: null })
    })

    test('a quick release and re-acquire (React StrictMode) keeps the same client', () => {
        const { socket, clients } = setup()
        const release = socket.acquire()
        release()
        socket.acquire()
        vi.advanceTimersByTime(5000)
        expect(clients).toHaveLength(1)
        expect(clients[0].deactivated).toBe(0)
    })

    test('the last release closes the client after the grace period', () => {
        const { socket, clients } = setup()
        const release = socket.acquire()
        clients[0].handlers.onConnect()
        release()
        vi.advanceTimersByTime(999)
        expect(clients[0].deactivated).toBe(0)
        vi.advanceTimersByTime(1)
        expect(clients[0].deactivated).toBe(1)
        expect(socket.getState().isConnected).toBe(false)
    })

    test('without a token nothing connects and the state says why', () => {
        const { socket, clients } = setup(null)
        socket.acquire()
        expect(clients).toHaveLength(0)
        expect(socket.getState().error).toBe('Authentication required')
    })
})

describe('gameSocket: subscriptions', () => {
    test('subscriptions made before CONNECTED are sent on connect, one per destination', () => {
        const { socket, clients } = setup()
        socket.acquire()
        const a = vi.fn()
        const b = vi.fn()
        socket.subscribe('/topic/games/g1', a)
        socket.subscribe('/topic/games/g1', b)
        expect(clients[0].subs).toHaveLength(0)
        clients[0].handlers.onConnect()
        expect(clients[0].activeSubs('/topic/games/g1')).toBe(1)
        clients[0].deliver('/topic/games/g1', '{"x":1}')
        expect(a).toHaveBeenCalledWith('{"x":1}')
        expect(b).toHaveBeenCalledWith('{"x":1}')
    })

    test('the STOMP subscription lives until its last handler leaves', () => {
        const { socket, clients } = setup()
        socket.acquire()
        clients[0].handlers.onConnect()
        const offA = socket.subscribe('/user/queue/ranked/status', vi.fn())
        const offB = socket.subscribe('/user/queue/ranked/status', vi.fn())
        offA()
        expect(clients[0].activeSubs('/user/queue/ranked/status')).toBe(1)
        offB()
        expect(clients[0].activeSubs('/user/queue/ranked/status')).toBe(0)
    })

    test('publish sends JSON only while connected', () => {
        const { socket, clients } = setup()
        socket.acquire()
        expect(socket.publish('/app/games/g1/refresh', {})).toBe(false)
        clients[0].handlers.onConnect()
        expect(socket.publish('/app/games/g1/bid', { pass: true, trump: null })).toBe(true)
        expect(clients[0].published).toEqual([{ destination: '/app/games/g1/bid', body: '{"pass":true,"trump":null}' }])
    })
})

describe('gameSocket: reconnects', () => {
    test('reconnect() replaces the client with one on the current token and re-subscribes', () => {
        const { socket, clients, setToken } = setup('old-token')
        socket.acquire()
        clients[0].handlers.onConnect()
        socket.subscribe('/user/queue/games/g1', vi.fn())
        setToken('new-token')
        socket.reconnect()
        expect(clients[0].deactivated).toBe(1)
        expect(clients).toHaveLength(2)
        expect(clients[1].token).toBe('new-token')
        clients[1].handlers.onConnect()
        expect(clients[1].activeSubs('/user/queue/games/g1')).toBe(1)
    })

    test('a late close from the replaced client is ignored', () => {
        const { socket, clients } = setup()
        socket.acquire()
        clients[0].handlers.onConnect()
        socket.reconnect()
        clients[1].handlers.onConnect()
        clients[0].handlers.onWebSocketClose(1008)
        expect(socket.getState().isConnected).toBe(true)
        vi.advanceTimersByTime(60000)
        expect(clients).toHaveLength(2)
    })

    test('an abnormal close retries with backoff, at most three times', () => {
        const { socket, clients } = setup()
        socket.acquire()
        clients[0].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(4999)
        expect(clients).toHaveLength(1)
        vi.advanceTimersByTime(1)
        expect(clients).toHaveLength(2)
        clients[1].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(10000)
        expect(clients).toHaveLength(3)
        clients[2].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(20000)
        expect(clients).toHaveLength(4)
        clients[3].handlers.onWebSocketClose(1006)
        vi.advanceTimersByTime(60000)
        expect(clients).toHaveLength(4)
        expect(socket.getState().error).toBe('Failed to connect after multiple attempts')
    })

    test('a revoked session (close 1008) or a STOMP ERROR is not retried', () => {
        const a = setup()
        a.socket.acquire()
        a.clients[0].handlers.onWebSocketClose(1008)
        vi.advanceTimersByTime(60000)
        expect(a.clients).toHaveLength(1)

        const b = setup()
        b.socket.acquire()
        b.clients[0].handlers.onStompError('STOMP CONNECT requires a valid Bearer token')
        b.clients[0].handlers.onWebSocketClose(1002)
        vi.advanceTimersByTime(60000)
        expect(b.clients).toHaveLength(1)
        expect(b.socket.getState().error).toBe('STOMP CONNECT requires a valid Bearer token')
    })
})

describe('stompConfig', () => {
    test('identity travels only as the Bearer token on CONNECT; the socket URL carries no user', () => {
        const config = stompConfig('tok-9', { onConnect: vi.fn(), onStompError: vi.fn(), onWebSocketClose: vi.fn() })
        expect(config.connectHeaders).toEqual({ Authorization: 'Bearer tok-9' })
        config.webSocketFactory?.()
        expect(sockjs.urls).toEqual(['/ws'])
    })
})
```

`src/hooks/useGameWebSocket.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const fake = vi.hoisted(() => {
    const handlers = new Map<string, Set<(body: string) => void>>()
    const published: { destination: string; body: unknown }[] = []
    const counters = { acquired: 0, released: 0 }
    const state = { isConnected: true, isConnecting: false, error: null as string | null }
    const gameSocket = {
        acquire: () => {
            counters.acquired += 1
            return () => { counters.released += 1 }
        },
        subscribe: (destination: string, handler: (body: string) => void) => {
            if (!handlers.has(destination)) handlers.set(destination, new Set())
            handlers.get(destination)!.add(handler)
            return () => { handlers.get(destination)?.delete(handler) }
        },
        publish: (destination: string, body: unknown) => {
            published.push({ destination, body })
            return true
        },
        getState: () => state,
        onStateChange: () => () => {},
    }
    const deliver = (destination: string, body: string) => handlers.get(destination)?.forEach((h) => h(body))
    return { handlers, published, counters, gameSocket, deliver }
})
vi.mock('../services/gameSocket', () => ({ gameSocket: fake.gameSocket }))

import { useGameWebSocket } from './useGameWebSocket'

beforeEach(() => {
    fake.handlers.clear()
    fake.published.length = 0
    fake.counters.acquired = 0
    fake.counters.released = 0
})

describe('useGameWebSocket game channels', () => {
    test('subscribes to the public topic, the private queue and the error queue; unmount releases all', () => {
        const { result, unmount } = renderHook(() => useGameWebSocket({}))
        act(() => result.current.subscribeToGame('g1'))
        expect([...fake.handlers.keys()].sort()).toEqual(['/topic/games/g1', '/user/queue/errors', '/user/queue/games/g1'])
        expect(fake.counters.acquired).toBe(1)
        unmount()
        expect([...fake.handlers.values()].every((set) => set.size === 0)).toBe(true)
        expect(fake.counters.released).toBe(1)
    })

    test('routes views, errors and the DISCONNECT marker to the callbacks', () => {
        const onPublicGameUpdate = vi.fn()
        const onPrivateGameUpdate = vi.fn()
        const onGameError = vi.fn()
        const onGameDisconnect = vi.fn()
        const { result } = renderHook(() =>
            useGameWebSocket({ onPublicGameUpdate, onPrivateGameUpdate, onGameError, onGameDisconnect }))
        act(() => result.current.subscribeToGame('g1'))
        fake.deliver('/topic/games/g1', '{"gameId":"g1"}')
        fake.deliver('/user/queue/games/g1', '{"yourTurn":true}')
        fake.deliver('/user/queue/errors', 'Not a participant in game g1')
        fake.deliver('/topic/games/g1', 'DISCONNECT')
        expect(onPublicGameUpdate).toHaveBeenCalledWith({ gameId: 'g1' })
        expect(onPrivateGameUpdate).toHaveBeenCalledWith({ yourTurn: true })
        expect(onGameError).toHaveBeenCalledWith('Not a participant in game g1')
        expect(onGameDisconnect).toHaveBeenCalledTimes(1)
    })

    test('the ranked queue channels are the two /user/queue destinations', () => {
        const onQueueStatusUpdate = vi.fn()
        const onMatchFound = vi.fn()
        const { result } = renderHook(() => useGameWebSocket({ onQueueStatusUpdate, onMatchFound }))
        act(() => result.current.subscribeToRankedQueue())
        fake.deliver('/user/queue/ranked/status', '{"state":"IN_QUEUE"}')
        fake.deliver('/user/queue/match-found', '{"id":"m1"}')
        expect(onQueueStatusUpdate).toHaveBeenCalledWith({ state: 'IN_QUEUE' })
        expect(onMatchFound).toHaveBeenCalledWith({ id: 'm1' })
    })
})

describe('useGameWebSocket actions match the backend messages (actor comes from the JWT)', () => {
    test('play sends {card: {boja, rank}, declareBela} and no playerId', () => {
        const { result } = renderHook(() => useGameWebSocket({}))
        act(() => result.current.playCard('g1', { boja: 'HERC', rank: 'AS' }, false))
        expect(fake.published).toEqual([
            { destination: '/app/games/g1/play', body: { card: { boja: 'HERC', rank: 'AS' }, declareBela: false } },
        ])
    })

    test('bid sends {pass, trump}', () => {
        const { result } = renderHook(() => useGameWebSocket({}))
        act(() => result.current.placeBid('g1', false, 'KARA'))
        act(() => result.current.placeBid('g1', true))
        expect(fake.published).toEqual([
            { destination: '/app/games/g1/bid', body: { pass: false, trump: 'KARA' } },
            { destination: '/app/games/g1/bid', body: { pass: true, trump: null } },
        ])
    })

    test('challenge, refresh and cancel send an empty object', () => {
        const { result } = renderHook(() => useGameWebSocket({}))
        act(() => {
            result.current.challenge('g1')
            result.current.refreshGameState('g1')
            result.current.cancelMatch('g1')
        })
        expect(fake.published).toEqual([
            { destination: '/app/games/g1/challenge', body: {} },
            { destination: '/app/games/g1/refresh', body: {} },
            { destination: '/app/games/g1/cancel', body: {} },
        ])
    })
})
```

`src/hooks/useBelatroGame.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { PrivateGameView, PublicGameView } from '../types/game'

type Options = {
    onPublicGameUpdate?: (view: PublicGameView) => void
    onPrivateGameUpdate?: (view: PrivateGameView) => void
    onGameError?: (message: string) => void
    onGameDisconnect?: () => void
}

const ws = vi.hoisted(() => ({
    options: {} as Options,
    isConnected: false,
    subscribeToGame: vi.fn(),
    unsubscribeFromGame: vi.fn(),
    refreshGameState: vi.fn(),
    placeBid: vi.fn(),
    playCard: vi.fn(),
    challenge: vi.fn(),
}))
vi.mock('./useGameWebSocket', () => ({
    useGameWebSocket: (options: Options) => {
        ws.options = options
        return {
            isConnected: ws.isConnected,
            isConnecting: false,
            connectionError: null,
            subscribeToGame: ws.subscribeToGame,
            unsubscribeFromGame: ws.unsubscribeFromGame,
            refreshGameState: ws.refreshGameState,
            placeBid: ws.placeBid,
            playCard: ws.playCard,
            challenge: ws.challenge,
        }
    },
}))

import { useBelatroGame } from './useBelatroGame'

const publicView = { gameId: 'g1', gameState: 'BIDDING', bids: [], teamAScore: 0, teamBScore: 0 } as unknown as PublicGameView
const privateView = {
    publicPart: publicView, hand: [{ boja: 'HERC', rank: 'AS' }], yourTurn: true, challengeUsed: false,
} as PrivateGameView

beforeEach(() => {
    vi.clearAllMocks()
    ws.isConnected = false
    ws.options = {}
})
afterEach(() => vi.useRealTimers())

describe('useBelatroGame', () => {
    test('subscribes to its game on mount and unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useBelatroGame('g1'))
        expect(ws.subscribeToGame).toHaveBeenCalledWith('g1')
        unmount()
        expect(ws.unsubscribeFromGame).toHaveBeenCalledWith('g1')
    })

    test('once connected it asks for a snapshot, every 2 s, until the private view arrives', () => {
        vi.useFakeTimers()
        const { rerender } = renderHook(() => useBelatroGame('g1'))
        expect(ws.refreshGameState).not.toHaveBeenCalled()
        ws.isConnected = true
        rerender()
        expect(ws.refreshGameState).toHaveBeenCalledTimes(1)
        act(() => { vi.advanceTimersByTime(2000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(2)
        act(() => ws.options.onPrivateGameUpdate?.(privateView))
        act(() => { vi.advanceTimersByTime(6000) })
        expect(ws.refreshGameState).toHaveBeenCalledTimes(2)
    })

    test('a private view sets both views; a later public view replaces the public part', () => {
        const { result } = renderHook(() => useBelatroGame('g1'))
        act(() => ws.options.onPrivateGameUpdate?.(privateView))
        expect(result.current.privateView).toBe(privateView)
        expect(result.current.publicView).toBe(publicView)
        const next = { ...publicView, gameState: 'PLAYING' } as PublicGameView
        act(() => ws.options.onPublicGameUpdate?.(next))
        expect(result.current.publicView).toBe(next)
    })

    test('actions send this game\'s moves and clear the last error', () => {
        const { result } = renderHook(() => useBelatroGame('g1'))
        act(() => ws.options.onGameError?.('Not a participant in game g1'))
        expect(result.current.error).toBe('Not a participant in game g1')
        act(() => result.current.actions.bidTrump('HERC'))
        expect(ws.placeBid).toHaveBeenCalledWith('g1', false, 'HERC')
        expect(result.current.error).toBeNull()
        act(() => result.current.actions.passBid())
        expect(ws.placeBid).toHaveBeenLastCalledWith('g1', true)
        act(() => result.current.actions.play({ boja: 'KARA', rank: 'DESETKA' }))
        expect(ws.playCard).toHaveBeenCalledWith('g1', { boja: 'KARA', rank: 'DESETKA' }, false)
        act(() => result.current.actions.challenge())
        expect(ws.challenge).toHaveBeenCalledWith('g1')
    })

    test('a cancelled game (DISCONNECT) calls onDisconnect', () => {
        const onDisconnect = vi.fn()
        renderHook(() => useBelatroGame('g1', onDisconnect))
        act(() => ws.options.onGameDisconnect?.())
        expect(onDisconnect).toHaveBeenCalledTimes(1)
    })
})
```

`src/components/game/PlayPage.test.tsx`:

```tsx
import { StrictMode } from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { PlayPage } from './PlayPage'

const stomp = vi.hoisted(() => ({ clients: [] as unknown[] }))
vi.mock('@stomp/stompjs', () => ({
    Client: class FakeClient {
        constructor(config: unknown) { stomp.clients.push(config) }
        activate() {}
        deactivate() {}
        publish() {}
        subscribe() { return { id: 'sub', unsubscribe() {} } }
    },
}))
vi.mock('sockjs-client', () => ({ default: class FakeSockJS {} }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true, isLoading: false, token: 'tok-1' }),
}))

const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

beforeEach(() => {
    vi.stubGlobal('localStorage', jsdomStorage)
    jsdomStorage.setItem('authToken', 'tok-1')
    // the pre-fix hook gated every connect() on GET /actuator/health
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})
afterEach(() => {
    jsdomStorage.clear()
    vi.unstubAllGlobals()
})

describe('/play page (B7)', () => {
    test('opens exactly one STOMP client although three components use the socket', async () => {
        render(<StrictMode><MemoryRouter><PlayPage /></MemoryRouter></StrictMode>)
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
        expect(screen.getByText('RANKED')).toBeInTheDocument()
        expect(stomp.clients).toHaveLength(1)
    })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/services/gameSocket.test.ts src/hooks/useGameWebSocket.test.tsx src/hooks/useBelatroGame.test.tsx src/components/game/PlayPage.test.tsx`
Expected: FAIL — `gameSocket` module not found; `useGameWebSocket` has no `/user/queue/errors` subscription and sends `playerId`; `useBelatroGame` has no `error`/`isConnected` and never refreshes; PlayPage: `expected [ …(n) ] to have a length of 1` with n > 1 (each of the three hook instances builds its own client, more than once).

- [ ] **Step 3: Replace the whole of `src/types/game.ts`** (its old content — `HEARTS`/`KING` cards, an unused `GameState`, `GameEvent`, `PlayerAction` — is imported by nothing; checked with grep):

```ts
// Wire types of the game's STOMP channels. They mirror the backend records in
// Meawen/stiglja: dtos/PublicGameView, dtos/PrivateGameView, dtos/PlayerPublicInfo,
// dtos/BidDTO, dtos/QueueStatusDTO, pojo/gamelogic/Card and pojo/gamelogic/Trick.
// Player ids are usernames: the backend seats players by username.

export type Boja = 'KARA' | 'HERC' | 'TREF' | 'PIK';

export type Rank = 'SEDMICA' | 'OSMICA' | 'DEVETKA' | 'DECKO' | 'BABA' | 'KRALJ' | 'DESETKA' | 'AS';

export type GamePhase =
    | 'INITIALIZED'
    | 'BIDDING'
    | 'DECLARATIONS'
    | 'PLAYING'
    | 'SCORING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'HAND_COMPLETE';

export interface GameCard {
    boja: Boja;
    rank: Rank;
}

/** One seat. The backend also sent `username` (equal to `id`) until lane-debt E5. */
export interface PlayerPublicInfo {
    id: string;
    cardsLeft: number;
}

export interface GameBid {
    playerId: string;
    action: 'PASS' | 'CALL_TRUMP';
    selectedTrump: Boja | null;
}

/** The trick on the table; `plays` maps player id to card, and map order means nothing. */
export interface LiveTrick {
    leadPlayerId: string;
    trump: Boja | null;
    plays: Record<string, GameCard>;
}

export interface DeclarationsView {
    bela: boolean;
    sequencesBySuit: Partial<Record<Boja, number>>;
    fourOfAKindPoints: number | null;
    bestSequencePoints: number | null;
}

export interface PublicGameView {
    gameId: string;
    gameState: GamePhase;
    bids: GameBid[];
    currentTrick: LiveTrick | null;
    teamAScore: number;
    teamBScore: number;
    teamA: PlayerPublicInfo[];
    teamB: PlayerPublicInfo[];
    challengeUsedByPlayer: Record<string, boolean>;
    /** "A" or "B" once COMPLETED, otherwise null. */
    winnerTeamId: 'A' | 'B' | null;
    tieBreaker: boolean;
    seatingOrder: PlayerPublicInfo[];
    declarations: Record<string, DeclarationsView>;
    belaDeclaredByPlayer: Record<string, boolean>;
    challengeWindowExpiresAt: number | null;
}

export interface PrivateGameView {
    publicPart: PublicGameView;
    hand: GameCard[];
    yourTurn: boolean;
    challengeUsed: boolean;
}

export interface QueueStatusDTO {
    state: 'IN_QUEUE' | 'MATCH_FOUND' | 'CANCELLED' | 'ERROR';
    estWaitSeconds: number;
    queueSize: number;
    mmr: number;
    matchId?: string;
}
```

- [ ] **Step 4: Create `src/services/gameSocket.ts`**

```ts
import { Client, type IFrame, type IMessage, type StompConfig, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * The one STOMP connection of this browser tab.
 *
 * Every component that needs the game server holds it with acquire() while
 * mounted and listens with subscribe(); this module owns the single Client,
 * shares one STOMP subscription per destination between all listeners and
 * re-subscribes after every connect. Before it existed each useGameWebSocket
 * instance built its own Client and every connect() tore the previous one down
 * (/play mounted three: ~17 sockets opened in the first 0.7 s).
 *
 * Identity travels only as the Bearer token on the CONNECT frame (SockJS cannot
 * set handshake headers). Never add ?user= or a username header: the backend
 * ignores both, and ?user= was the impersonation hole.
 */

export interface GameSocketState {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
}

/** The part of @stomp/stompjs's Client this module uses; tests pass a fake. */
export interface StompClientLike {
    activate(): void;
    deactivate(): unknown;
    publish(params: { destination: string; body: string }): void;
    subscribe(destination: string, callback: (message: IMessage) => void): StompSubscription;
}

export interface StompClientHandlers {
    onConnect: () => void;
    onStompError: (message: string) => void;
    onWebSocketClose: (code: number) => void;
}

export type StompClientFactory = (token: string, handlers: StompClientHandlers) => StompClientLike;

const WS_PATH = '/ws';
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 5000;
/** Long enough to survive React StrictMode's unmount/remount and a route change. */
const RELEASE_GRACE_MS = 1000;
/** The server closes a socket whose token was revoked or went stale with 1008. */
const CLOSE_POLICY_VIOLATION = 1008;

export function stompConfig(token: string, handlers: StompClientHandlers): StompConfig {
    return {
        webSocketFactory: () => new SockJS(WS_PATH),
        connectHeaders: { Authorization: `Bearer ${token}` },
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        // reconnects are ours (bounded, token-aware), not stompjs's endless loop
        reconnectDelay: 0,
        // the default debug output would print the CONNECT frame, token included
        debug: () => undefined,
        onConnect: () => handlers.onConnect(),
        onStompError: (frame: IFrame) =>
            handlers.onStompError(frame.headers['message'] || frame.body || 'STOMP connection failed'),
        onWebSocketClose: (event: CloseEvent) => handlers.onWebSocketClose(event.code),
    };
}

type Route = { handlers: Set<(body: string) => void>; stomp: StompSubscription | null };

export function createGameSocket(
    createClient: StompClientFactory = (token, handlers) => new Client(stompConfig(token, handlers)),
    getToken: () => string | null = () => localStorage.getItem('authToken'),
) {
    let state: GameSocketState = { isConnected: false, isConnecting: false, error: null };
    const listeners = new Set<() => void>();
    const routes = new Map<string, Route>();
    let client: StompClientLike | null = null;
    let connected = false;
    let holders = 0;
    let reconnectAttempts = 0;
    let releaseTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const setState = (next: Partial<GameSocketState>) => {
        state = { ...state, ...next };
        listeners.forEach((listener) => listener());
    };

    const attach = (destination: string, route: Route) => {
        if (!client || !connected || route.stomp) return;
        route.stomp = client.subscribe(destination, (message) => {
            route.handlers.forEach((handler) => handler(message.body));
        });
    };

    const open = () => {
        if (client) return;
        const token = getToken();
        if (!token) {
            setState({ isConnecting: false, error: 'Authentication required' });
            return;
        }
        // An ERROR frame means the server refused us (bad or revoked token): retrying
        // with the same token cannot succeed.
        let refused = false;
        const created: StompClientLike = createClient(token, {
            onConnect: () => {
                if (client !== created) return;
                connected = true;
                reconnectAttempts = 0;
                routes.forEach((route, destination) => attach(destination, route));
                setState({ isConnected: true, isConnecting: false, error: null });
            },
            onStompError: (message) => {
                if (client !== created) return;
                refused = true;
                setState({ error: message });
            },
            onWebSocketClose: (code) => {
                // a socket replaced by reconnect() may still report its close; ignore it
                if (client !== created) return;
                client = null;
                connected = false;
                routes.forEach((route) => { route.stomp = null; });
                setState({ isConnected: false, isConnecting: false });
                if (refused || holders === 0 || code === 1000 || code === 1001 || code === CLOSE_POLICY_VIOLATION) return;
                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    setState({ error: 'Failed to connect after multiple attempts' });
                    return;
                }
                const delay = RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts;
                reconnectAttempts += 1;
                retryTimer = setTimeout(() => {
                    retryTimer = null;
                    if (holders > 0) open();
                }, delay);
            },
        });
        client = created;
        setState({ isConnecting: true, error: null });
        created.activate();
    };

    const close = () => {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        const old = client;
        client = null;
        connected = false;
        routes.forEach((route) => { route.stomp = null; });
        if (old) old.deactivate();
        setState({ isConnected: false, isConnecting: false });
    };

    return {
        /** Hold the connection while mounted; call the returned function on unmount. */
        acquire(): () => void {
            holders += 1;
            if (releaseTimer) {
                clearTimeout(releaseTimer);
                releaseTimer = null;
            }
            open();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                holders -= 1;
                if (holders > 0) return;
                releaseTimer = setTimeout(() => {
                    releaseTimer = null;
                    if (holders === 0) close();
                }, RELEASE_GRACE_MS);
            };
        },

        /** Listen on a destination; works before the connection is up. Returns the unsubscribe. */
        subscribe(destination: string, handler: (body: string) => void): () => void {
            let route = routes.get(destination);
            if (!route) {
                route = { handlers: new Set(), stomp: null };
                routes.set(destination, route);
            }
            route.handlers.add(handler);
            attach(destination, route);
            return () => {
                const current = routes.get(destination);
                if (!current || !current.handlers.delete(handler)) return;
                if (current.handlers.size > 0) return;
                routes.delete(destination);
                try {
                    current.stomp?.unsubscribe();
                } catch {
                    // the socket is already gone
                }
            };
        },

        /** Send JSON to an /app destination; false when not connected. */
        publish(destination: string, body: unknown): boolean {
            if (!client || !connected) return false;
            client.publish({ destination, body: JSON.stringify(body ?? {}) });
            return true;
        },

        /** Reopen with the token now in storage (after a password change rotated it). */
        reconnect(): void {
            reconnectAttempts = 0;
            close();
            if (holders > 0) open();
        },

        getState: (): GameSocketState => state,

        onStateChange: (listener: () => void): (() => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

export type GameSocket = ReturnType<typeof createGameSocket>;

export const gameSocket: GameSocket = createGameSocket();
```

- [ ] **Step 5: Replace the whole of `src/hooks/useGameWebSocket.ts`**

```ts
// src/hooks/useGameWebSocket.ts
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { gameSocket } from '../services/gameSocket';
import type { MatchDTO } from '../types/match';
import type { Boja, GameCard, PrivateGameView, PublicGameView, QueueStatusDTO } from '../types/game';

/** Display card of the mock boards in src/MockComponents (UI names such as 'Herc'/'As'), not the wire card. */
export interface Card {
    suit: string;
    rank: string;
}

interface GameWebSocketOptions {
    onQueueStatusUpdate?: (status: QueueStatusDTO) => void;
    onMatchFound?: (match: MatchDTO) => void;
    onPublicGameUpdate?: (view: PublicGameView) => void;
    onPrivateGameUpdate?: (view: PrivateGameView) => void;
    onGameError?: (message: string) => void;
    onGameDisconnect?: () => void;
}

/**
 * Per-component access to the tab's single STOMP connection (services/gameSocket).
 * Holds the connection while mounted and drops this component's subscriptions on unmount.
 */
export function useGameWebSocket(options: GameWebSocketOptions = {}) {
    const state = useSyncExternalStore(gameSocket.onStateChange, gameSocket.getState);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const unsubscribersRef = useRef(new Map<string, () => void>());

    useEffect(() => {
        const release = gameSocket.acquire();
        const unsubscribers = unsubscribersRef.current;
        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
            unsubscribers.clear();
            release();
        };
    }, []);

    const track = useCallback((key: string, destination: string, onBody: (body: string) => void) => {
        unsubscribersRef.current.get(key)?.();
        unsubscribersRef.current.set(key, gameSocket.subscribe(destination, onBody));
    }, []);

    const untrack = useCallback((key: string) => {
        unsubscribersRef.current.get(key)?.();
        unsubscribersRef.current.delete(key);
    }, []);

    /* ---------- Ranked queue channels ---------- */
    const subscribeToRankedQueue = useCallback(() => {
        track('queueStatus', '/user/queue/ranked/status', (body) => {
            try {
                optionsRef.current.onQueueStatusUpdate?.(JSON.parse(body));
            } catch (e) {
                console.warn('queue status parse failed', e);
            }
        });
        track('matchFound', '/user/queue/match-found', (body) => {
            try {
                optionsRef.current.onMatchFound?.(JSON.parse(body));
            } catch (e) {
                console.warn('match-found parse failed', e);
            }
        });
    }, [track]);

    const unsubscribeFromRankedQueue = useCallback(() => {
        untrack('queueStatus');
        untrack('matchFound');
    }, [untrack]);

    /* ---------- Game channels ---------- */
    const subscribeToGame = useCallback((gameId: string) => {
        track(`game-${gameId}-public`, `/topic/games/${gameId}`, (body) => {
            // On cancel the backend sends this bare string on the JSON topic.
            if (body === 'DISCONNECT') {
                optionsRef.current.onGameDisconnect?.();
                return;
            }
            try {
                optionsRef.current.onPublicGameUpdate?.(JSON.parse(body));
            } catch (e) {
                console.error('public game parse failed', e);
            }
        });
        track(`game-${gameId}-private`, `/user/queue/games/${gameId}`, (body) => {
            try {
                optionsRef.current.onPrivateGameUpdate?.(JSON.parse(body));
            } catch (e) {
                console.error('private game parse failed', e);
            }
        });
        // Rejected moves (InvalidMoveException) come back as a plain string.
        track(`game-${gameId}-errors`, '/user/queue/errors', (body) => {
            optionsRef.current.onGameError?.(body.replace(/^"|"$/g, ''));
        });
    }, [track]);

    const unsubscribeFromGame = useCallback((gameId: string) => {
        untrack(`game-${gameId}-public`);
        untrack(`game-${gameId}-private`);
        untrack(`game-${gameId}-errors`);
    }, [untrack]);

    /* ---------- Actions: backend PlayCardMsg / BidMsg; the actor is the JWT principal ---------- */
    const playCard = useCallback((gameId: string, card: GameCard, declareBela: boolean) => {
        gameSocket.publish(`/app/games/${gameId}/play`, { card, declareBela });
    }, []);

    const placeBid = useCallback((gameId: string, pass: boolean, trump?: Boja) => {
        gameSocket.publish(`/app/games/${gameId}/bid`, { pass, trump: trump ?? null });
    }, []);

    const challenge = useCallback((gameId: string) => {
        gameSocket.publish(`/app/games/${gameId}/challenge`, {});
    }, []);

    const refreshGameState = useCallback((gameId: string) => {
        gameSocket.publish(`/app/games/${gameId}/refresh`, {});
    }, []);

    const cancelMatch = useCallback((gameId: string) => {
        gameSocket.publish(`/app/games/${gameId}/cancel`, {});
    }, []);

    return {
        // status
        isConnected: state.isConnected,
        isConnecting: state.isConnecting,
        connectionError: state.error,

        // ranked queue
        subscribeToRankedQueue,
        unsubscribeFromRankedQueue,

        // game
        subscribeToGame,
        unsubscribeFromGame,

        // actions
        playCard,
        placeBid,
        challenge,
        refreshGameState,
        cancelMatch,
    };
}
```

- [ ] **Step 6: Replace the whole of `src/hooks/useBelatroGame.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { useGameWebSocket } from './useGameWebSocket';
import type { Boja, GameCard, PrivateGameView, PublicGameView } from '../types/game';

/** How often a page that has no state yet asks the server again. */
const SNAPSHOT_RETRY_MS = 2000;

export function useBelatroGame(gameId: string, onDisconnect?: () => void) {
    const [publicView, setPublicView] = useState<PublicGameView | null>(null);
    const [privateView, setPrivateView] = useState<PrivateGameView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snapshotPending, setSnapshotPending] = useState(true);

    const {
        isConnected,
        connectionError,
        subscribeToGame,
        unsubscribeFromGame,
        refreshGameState,
        placeBid,
        playCard,
        challenge: sendChallenge,
    } = useGameWebSocket({
        onPublicGameUpdate: setPublicView,
        onPrivateGameUpdate: (view) => {
            setPrivateView(view);
            setPublicView(view.publicPart);
            setSnapshotPending(false);
        },
        onGameError: setError,
        onGameDisconnect: onDisconnect,
    });

    useEffect(() => {
        if (!gameId) return;
        subscribeToGame(gameId);
        return () => unsubscribeFromGame(gameId);
    }, [gameId, subscribeToGame, unsubscribeFromGame]);

    // After a disconnect the next state must come from a fresh snapshot.
    useEffect(() => {
        if (!isConnected) setSnapshotPending(true);
    }, [isConnected]);

    // The server pushes state only when something happens, and a page usually
    // subscribes after the deal was pushed. Ask for a snapshot and keep asking:
    // the SUBSCRIBE and this SEND are not ordered on the server's inbound thread
    // pool, so the first answer can race past the new subscription.
    useEffect(() => {
        if (!gameId || !isConnected || !snapshotPending) return;
        refreshGameState(gameId);
        const timer = window.setInterval(() => refreshGameState(gameId), SNAPSHOT_RETRY_MS);
        return () => window.clearInterval(timer);
    }, [gameId, isConnected, snapshotPending, refreshGameState]);

    const bidTrump = useCallback((trump: Boja) => {
        setError(null);
        placeBid(gameId, false, trump);
    }, [gameId, placeBid]);

    const passBid = useCallback(() => {
        setError(null);
        placeBid(gameId, true);
    }, [gameId, placeBid]);

    const play = useCallback((card: GameCard) => {
        setError(null);
        playCard(gameId, card, false);
    }, [gameId, playCard]);

    const challenge = useCallback(() => {
        setError(null);
        sendChallenge(gameId);
    }, [gameId, sendChallenge]);

    return {
        publicView,
        privateView,
        isConnected,
        connectionError,
        error,
        actions: { bidTrump, passBid, play, challenge },
    };
}
```

- [ ] **Step 7: Edit `src/hooks/useEnhancedRanked.ts`**

7a. Replace

```ts
import { useGameWebSocket, type QueueStatusDTO, type MatchDTO } from './useGameWebSocket';
```

with

```ts
import { useGameWebSocket } from './useGameWebSocket';
import type { MatchDTO, QueueStatusDTO } from '../types';
```

7b. Replace

```ts
    const { isConnected, isConnecting, connect, subscribeToRankedQueue, unsubscribeFromRankedQueue, connectionError } = useGameWebSocket({
```

with

```ts
    const { isConnected, isConnecting, subscribeToRankedQueue, unsubscribeFromRankedQueue, connectionError } = useGameWebSocket({
```

7c. Delete the auto-connect effect — replace this whole block

```ts
    // Only attempt connection when auth is fully loaded and user is available
    useEffect(() => {
        if (isLoading) {
            console.log('useEnhancedRanked: Auth still loading, waiting...');
            return;
        }

        console.log('useEnhancedRanked: checking WebSocket connection...', {
            isConnected,
            isConnecting,
            connectionError,
            hasUser: !!user,
            hasUsername: !!user?.username,
            isAuthenticated
        });

        if (isAuthenticated && user?.username && !isConnected && !isConnecting && !connectionError) {
            console.log('Attempting to connect WebSocket...');
            connect().catch((error: any) => {
                console.error('Failed to auto-connect WebSocket:', error);
            });
        }
    }, [connect, isConnected, isConnecting, connectionError, user, isAuthenticated, isLoading]);
```

with

```ts
    // The connection is owned by services/gameSocket (one per tab); useGameWebSocket
    // holds it while this component is mounted.
```

7d. In `joinQueue`, replace

```ts
            // First, ensure WebSocket is connected
            if (!isConnected) {
                console.log('WebSocket not connected, connecting...');
                await connect();
            }
```

with

```ts
            // MATCH_FOUND arrives over the WebSocket; queueing without it would go unnoticed.
            if (!isConnected) {
                throw new Error('Not connected to the game server');
            }
```

and replace the `joinQueue` dependency list

```ts
    }, [joinQueueMutation, isConnected, connect, user, isAuthenticated, isLoading]);
```

with

```ts
    }, [joinQueueMutation, isConnected, user, isAuthenticated, isLoading]);
```

(The ranked queue now expires after 600 s on the backend (lane-debt E7); the existing `CANCELLED` handling in `handleQueueStatusUpdate` already covers it — no change.)

- [ ] **Step 8: Edit `src/components/game/MatchFoundModal.tsx`** — the match-found frame is the backend `MatchDTO`, whose teams are `{id, username}`. Replace

```tsx
                                {foundMatch.teamA.map((player) => (
                                    <div key={player.playerId ?? player.username} className="text-gray-700">
```

with

```tsx
                                {(foundMatch.teamA ?? []).map((player) => (
                                    <div key={player.id ?? player.username ?? ''} className="text-gray-700">
```

and replace

```tsx
                                {foundMatch.teamB.map((player) => (
                                    <div key={player.playerId ?? player.username} className="text-gray-700">
```

with

```tsx
                                {(foundMatch.teamB ?? []).map((player) => (
                                    <div key={player.id ?? player.username ?? ''} className="text-gray-700">
```

- [ ] **Step 9: Edit `src/MockComponents/MockGameBoard.tsx`** — the dev mock at `/play/mock` builds display-shaped data, not wire data, so it gets its own local types.

Replace

```tsx
import type { PublicGameView, PrivateGameView, Card } from '../hooks/useGameWebSocket'
```

with

```tsx
import type { Card } from '../hooks/useGameWebSocket'

// Display-only shapes for this mock board; the live wire types are in src/types/game.ts.
interface MockPlayer { id: string; username: string; cardCount: number }
interface MockPublicView {
    gameId: string;
    gameState: string;
    bids: unknown[];
    currentTrick: null;
    teamAScore: number;
    teamBScore: number;
    teamA: MockPlayer[];
    teamB: MockPlayer[];
    challengeUsedByPlayer: Record<string, boolean>;
    winnerTeamId?: string;
    tieBreaker: boolean;
}
interface MockPrivateView { publicPart: MockPublicView; hand: Card[]; yourTurn: boolean; challengeUsed: boolean }
```

Then replace `{ public: PublicGameView; private: PrivateGameView }` with `{ public: MockPublicView; private: MockPrivateView }`, `const publicState: PublicGameView = {` with `const publicState: MockPublicView = {`, and `const privateState: PrivateGameView = {` with `const privateState: MockPrivateView = {`. Nothing else in the file changes (this also clears its 9 baseline errors).

- [ ] **Step 10: Edit `src/MockComponents/RealisticGameBoard.tsx`** — the animated demo at `/play/realistic` is not wired to live data (its handlers gate on its own simulated state); only keep it compiling against the corrected types.

10a. Replace

```tsx
import type { Card , PublicGameView} from '../hooks/useGameWebSocket';
```

with

```tsx
import type { Card } from '../hooks/useGameWebSocket';
import type { PublicGameView } from '../types/game';
```

10b. Replace

```tsx
    const currentTrickPlays = pub?.currentTrick?.plays ?? [];
```

with

```tsx
    // The wire trick maps player id -> card; this board draws { card: { suit, rank } } entries.
    const currentTrickPlays = Object.entries(pub?.currentTrick?.plays ?? {})
        .map(([playerId, card]) => ({ playerId, card: { suit: card.boja, rank: card.rank } }));
```

- [ ] **Step 11: Run the tests and the suite**

Run: `npx vitest run src/services/gameSocket.test.ts src/hooks/useGameWebSocket.test.tsx src/hooks/useBelatroGame.test.tsx src/components/game/PlayPage.test.tsx` → all pass (13 + 6 + 5 + 1). Then `npm test` → all pass.

- [ ] **Step 12: Gates**

Procedure T, then filter the allowance:

```bash
comm -13 /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/tsc-baseline.txt /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/tsc-now.txt \
  | grep -v -e '^src/components/game/GameBoard.tsx' -e '^src/components/game/GamePageConnected.tsx'
```

Expected: no output. Procedure L: nothing new in the touched files (`useGameWebSocket.ts` loses its 12 `no-empty` findings).

Check the single-owner rule:

```bash
grep -rn "new Client(" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'   # expect only src/services/gameSocket.ts
grep -rn -e '?user=' -e 'X-Player-Name' -e "headers\['login'\]" src                  # expect no output
```

- [ ] **Step 13: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/types/game.ts src/services/gameSocket.ts src/services/gameSocket.test.ts src/hooks/useGameWebSocket.ts src/hooks/useGameWebSocket.test.tsx src/hooks/useBelatroGame.ts src/hooks/useBelatroGame.test.tsx src/hooks/useEnhancedRanked.ts src/components/game/MatchFoundModal.tsx src/components/game/PlayPage.test.tsx src/MockComponents/MockGameBoard.tsx src/MockComponents/RealisticGameBoard.tsx
git commit -m "fix(ws): one STOMP connection per tab, and the game messages the backend accepts

services/gameSocket owns the tab's only Client: ref-counted holders, one
STOMP subscription per destination, re-subscribe on connect, bounded
retries, no retry on a refused or revoked session. useGameWebSocket is a
thin hook over it; useEnhancedRanked no longer connects on its own (/play
opened ~17 sockets in 0.7 s).

Wire types now mirror the backend: cards are {boja, rank}, seats are
{id, cardsLeft}, the trick is a player->card map, eight game states. Moves
send PlayCardMsg {card, declareBela} and BidMsg {pass, trump} without
playerId (the actor is the JWT principal). The game page asks for a
snapshot until its first private view arrives and listens on
/user/queue/errors.

Consumes Meawen/stiglja: STOMP contract as read in GameSocketController;
PlayerPublicInfo {id, cardsLeft} (lane-debt E5)." -- src/types/game.ts src/services/gameSocket.ts src/services/gameSocket.test.ts src/hooks/useGameWebSocket.ts src/hooks/useGameWebSocket.test.tsx src/hooks/useBelatroGame.ts src/hooks/useBelatroGame.test.tsx src/hooks/useEnhancedRanked.ts src/components/game/MatchFoundModal.tsx src/components/game/PlayPage.test.tsx src/MockComponents/MockGameBoard.tsx src/MockComponents/RealisticGameBoard.tsx
git show --stat HEAD
```

---
### Task 8: The game page renders the live table, and `/game/:gameId` routes to it (B8 UI)

**B8 gap list (what the committed WIP does not do, read in code):**
1. `/game/:gameId` renders the old placeholder `GameBoard` (imported from `./components/game`), not `GamePageConnected` — which nothing imports.
2. `GameBoard` has no bid UI at all, reads `player.id`/`player.cardCount`/`player.username` from a type that has none of them, says "Current trick display would go here", and builds card image URLs with one argument.
3. `GamePageConnected` renders the 1739-line demo `RealisticGameBoard`, whose live mode cannot work: its bid and play handlers first check its own simulated `gameState.phase === 'BIDDING' && gameState.currentPlayer === 0`, and in live mode the simulation never starts; trick rendering expects an array of `{card: {suit, rank}}` (the wire sends a player→card map); there is no seat rotation from `seatingOrder`; and it maps Karo to `KARO` (the backend enum is `KARA`).
4. No "your turn", no trump display, no bids list, no error display, no game-over or cancelled state.
5. (Fixed in Task 7) wrong wire types and payloads, subscribe/unsubscribe loop, no snapshot request, one socket per component.
6. (Task 9) non-host players are never routed to the game; the lobby page is unreachable.

**Decision:** a new presentational `GameTable` (one file, data in via props, fully testable) is the live table; `GamePageConnected` wires `useBelatroGame` to it. `RealisticGameBoard` stays the animated demo at `/play/realistic` — making it live is a separate design task (flagged in the report).

**Files:**
- Create: `src/components/game/gameView.ts`, `src/components/game/gameView.test.ts`, `src/components/game/GameTable.tsx`, `src/components/game/GameTable.test.tsx`, `src/components/game/GamePageConnected.test.tsx`
- Modify: `src/components/game/GamePageConnected.tsx` (full rewrite), `src/components/game/index.ts`, `src/App.tsx`
- Delete: `src/components/game/GameBoard.tsx`

**Interfaces:**
- Consumes: `useBelatroGame(gameId, onDisconnect)` → `{ publicView, privateView, isConnected, connectionError, error, actions: { bidTrump, passBid, play, challenge } }` (Task 7); types from `src/types/game.ts`; `PlayingCard` (`src/components/common/PlayingCard.tsx`, already maps `KARA`→Karo, `SEDMICA`→7, etc. to the R2 image names); `useAuth().user.username` (player ids are usernames).
- Produces:
  - `gameView.ts`: `BOJE: Boja[]`, `SUIT_LABEL: Record<Boja, string>`, `RANK_LABEL: Record<Rank, string>`, `cardLabel(card: GameCard): string`, `seatsFromMe(seatingOrder: PlayerPublicInfo[], me: string): PlayerPublicInfo[]`, `trumpOf(view: PublicGameView): Boja | null`.
  - `GameTable` props `{ publicView: PublicGameView; privateView: PrivateGameView | null; me: string; error: string | null; onPass(): void; onCallTrump(trump: Boja): void; onPlayCard(card: GameCard): void; onChallenge(): void; onLeave(): void }`.
  - DOM hooks the e2e harness (Task 11) relies on: `data-testid="game-phase"` (text = raw phase, e.g. `BIDDING`), `data-testid="your-turn"`, `data-testid="hand"`, `data-testid="hand-card"` buttons (`disabled` unless playable, `aria-label` like `As Herc`, `data-card="HERC-AS"`), `data-testid="bid"` list items, `data-testid="trick-card"`, `data-testid="seat-<playerId>"`, `data-testid="cards-left-<playerId>"`, buttons named `Pass`, `Call Herc`, `Call Karo`, `Call Pik`, `Call Tref`, `Challenge`, `Back to lobbies`.

- [ ] **Step 1: Write the failing tests**

`src/components/game/gameView.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { cardLabel, seatsFromMe, trumpOf } from './gameView'
import type { PublicGameView } from '../../types/game'

const seats = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 8 }))

describe('seatsFromMe', () => {
    test('rotates so I come first and the turn order is kept', () => {
        expect(seatsFromMe(seats, 'carol').map((s) => s.id)).toEqual(['carol', 'dave', 'alice', 'bob'])
    })
    test('leaves the order alone when I am first or not seated', () => {
        expect(seatsFromMe(seats, 'alice').map((s) => s.id)).toEqual(['alice', 'bob', 'carol', 'dave'])
        expect(seatsFromMe(seats, 'zoe').map((s) => s.id)).toEqual(['alice', 'bob', 'carol', 'dave'])
    })
})

describe('trumpOf', () => {
    const base = {
        bids: [],
        currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
    } as unknown as PublicGameView

    test('no trump before the call', () => {
        expect(trumpOf(base)).toBeNull()
    })
    test('the last trump call counts, passes do not', () => {
        const view = {
            ...base,
            bids: [
                { playerId: 'alice', action: 'PASS', selectedTrump: null },
                { playerId: 'bob', action: 'CALL_TRUMP', selectedTrump: 'PIK' },
            ],
        } as PublicGameView
        expect(trumpOf(view)).toBe('PIK')
    })
    test("the trick's own trump wins when present", () => {
        const view = { ...base, currentTrick: { leadPlayerId: 'alice', trump: 'TREF', plays: {} } } as PublicGameView
        expect(trumpOf(view)).toBe('TREF')
    })
})

describe('cardLabel', () => {
    test('uses the Croatian names the card art uses', () => {
        expect(cardLabel({ boja: 'KARA', rank: 'DESETKA' })).toBe('10 Karo')
        expect(cardLabel({ boja: 'HERC', rank: 'AS' })).toBe('As Herc')
    })
})
```

`src/components/game/GameTable.test.tsx`:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable, type GameTableProps } from './GameTable'
import type { GameCard, PrivateGameView, PublicGameView } from '../../types/game'

const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }))

function view(overrides: Partial<PublicGameView> = {}): PublicGameView {
    return {
        gameId: 'g1',
        gameState: 'BIDDING',
        bids: [],
        currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
        teamAScore: 0,
        teamBScore: 0,
        teamA: [seating[0], seating[2]],
        teamB: [seating[1], seating[3]],
        challengeUsedByPlayer: {},
        winnerTeamId: null,
        tieBreaker: false,
        seatingOrder: seating,
        declarations: {},
        belaDeclaredByPlayer: {},
        challengeWindowExpiresAt: null,
        ...overrides,
    }
}

const myCards: GameCard[] = [
    { boja: 'HERC', rank: 'AS' },
    { boja: 'HERC', rank: 'SEDMICA' },
    { boja: 'KARA', rank: 'DESETKA' },
    { boja: 'PIK', rank: 'KRALJ' },
    { boja: 'TREF', rank: 'BABA' },
    { boja: 'TREF', rank: 'DECKO' },
]

function privateFor(publicPart: PublicGameView, yourTurn: boolean): PrivateGameView {
    return { publicPart, hand: myCards, yourTurn, challengeUsed: false }
}

function renderTable(publicView: PublicGameView, yourTurn: boolean, extra: Partial<GameTableProps> = {}) {
    const handlers = {
        onPass: vi.fn(), onCallTrump: vi.fn(), onPlayCard: vi.fn(), onChallenge: vi.fn(), onLeave: vi.fn(),
    }
    render(
        <GameTable
            publicView={publicView}
            privateView={privateFor(publicView, yourTurn)}
            me="carol"
            error={null}
            {...handlers}
            {...extra}
        />,
    )
    return handlers
}

describe('GameTable', () => {
    test('seats start with me at the bottom and follow the turn order', () => {
        renderTable(view(), false)
        const order = screen.getAllByTestId(/^seat-/).map((el) => el.getAttribute('data-testid'))
        expect(order).toEqual(['seat-carol', 'seat-dave', 'seat-alice', 'seat-bob'])
        expect(within(screen.getByTestId('seat-carol')).getByText('You')).toBeInTheDocument()
        expect(screen.getByTestId('cards-left-dave')).toHaveTextContent('6')
    })

    test('on my bidding turn I can pass or call any suit; my cards stay locked', async () => {
        const user = userEvent.setup()
        const handlers = renderTable(view(), true)
        expect(screen.getByTestId('game-phase')).toHaveTextContent('BIDDING')
        expect(screen.getByTestId('your-turn')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Pass' }))
        expect(handlers.onPass).toHaveBeenCalledTimes(1)
        await user.click(screen.getByRole('button', { name: 'Call Herc' }))
        expect(handlers.onCallTrump).toHaveBeenCalledWith('HERC')
        await user.click(screen.getByRole('button', { name: 'Call Karo' }))
        expect(handlers.onCallTrump).toHaveBeenLastCalledWith('KARA')
        expect(screen.getAllByTestId('hand-card')).toHaveLength(6)
        screen.getAllByTestId('hand-card').forEach((card) => expect(card).toBeDisabled())
    })

    test('not my turn: no bid panel, a waiting note', () => {
        renderTable(view(), false)
        expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('your-turn')).not.toBeInTheDocument()
        expect(screen.getByText('Waiting for other players...')).toBeInTheDocument()
    })

    test('on my playing turn a click plays that card; the trick shows at each seat; trump and bids are visible', async () => {
        const user = userEvent.setup()
        const playing = view({
            gameState: 'PLAYING',
            bids: [
                { playerId: 'alice', action: 'PASS', selectedTrump: null },
                { playerId: 'bob', action: 'CALL_TRUMP', selectedTrump: 'HERC' },
            ],
            currentTrick: { leadPlayerId: 'dave', trump: 'HERC', plays: { dave: { boja: 'PIK', rank: 'AS' } } },
        })
        const handlers = renderTable(playing, true)
        expect(screen.getByTestId('trump')).toHaveTextContent('Herc')
        expect(screen.getAllByTestId('bid').map((el) => el.textContent)).toEqual(['alice: Pass', 'bob: Herc'])
        expect(within(screen.getByTestId('seat-dave')).getByTestId('trick-card')).toHaveAttribute('data-card', 'PIK-AS')
        await user.click(screen.getByRole('button', { name: 'As Herc' }))
        expect(handlers.onPlayCard).toHaveBeenCalledWith({ boja: 'HERC', rank: 'AS' })
    })

    test('a challenge is offered while playing until it is used', async () => {
        const user = userEvent.setup()
        const handlers = renderTable(view({ gameState: 'PLAYING' }), false)
        await user.click(screen.getByRole('button', { name: 'Challenge' }))
        expect(handlers.onChallenge).toHaveBeenCalledTimes(1)
    })

    test('a finished game names the winner and offers the way back', async () => {
        const user = userEvent.setup()
        const handlers = renderTable(view({ gameState: 'COMPLETED', winnerTeamId: 'A', teamAScore: 1001, teamBScore: 640 }), false)
        expect(screen.getByText('Game over')).toBeInTheDocument()
        expect(screen.getByText('Team A wins')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Back to lobbies' }))
        expect(handlers.onLeave).toHaveBeenCalledTimes(1)
    })

    test('a rejected move is shown', () => {
        renderTable(view(), false, { error: 'Not a participant in game g1' })
        expect(screen.getByRole('alert')).toHaveTextContent('Not a participant in game g1')
    })
})
```

`src/components/game/GamePageConnected.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GamePageConnected from './GamePageConnected'
import { useBelatroGame } from '../../hooks/useBelatroGame'
import type { PublicGameView } from '../../types/game'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u3', username: 'carol' } }) }))
vi.mock('../../hooks/useBelatroGame', () => ({ useBelatroGame: vi.fn() }))

const actions = { bidTrump: vi.fn(), passBid: vi.fn(), play: vi.fn(), challenge: vi.fn() }
const seating = ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, cardsLeft: 6 }))
const publicView = {
    gameId: 'g1', gameState: 'BIDDING', bids: [],
    currentTrick: { leadPlayerId: '_NO_LEAD_', trump: null, plays: {} },
    teamAScore: 0, teamBScore: 0, teamA: [], teamB: [], challengeUsedByPlayer: {}, winnerTeamId: null,
    tieBreaker: false, seatingOrder: seating, declarations: {}, belaDeclaredByPlayer: {}, challengeWindowExpiresAt: null,
} as PublicGameView

function renderPage() {
    render(
        <MemoryRouter initialEntries={['/game/g1']}>
            <Routes><Route path="/game/:gameId" element={<GamePageConnected />} /></Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => vi.clearAllMocks())

describe('GamePageConnected', () => {
    test('waits for the connection and the first snapshot', () => {
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView: null, privateView: null, isConnected: false, connectionError: null, error: null, actions,
        })
        renderPage()
        expect(screen.getByText('Connecting to game...')).toBeInTheDocument()
        expect(vi.mocked(useBelatroGame).mock.calls[0][0]).toBe('g1')
    })

    test('renders the table for the signed-in player', () => {
        vi.mocked(useBelatroGame).mockReturnValue({
            publicView, privateView: null, isConnected: true, connectionError: null, error: null, actions,
        })
        renderPage()
        expect(screen.getByTestId('game-phase')).toHaveTextContent('BIDDING')
        expect(screen.getAllByTestId(/^seat-/)[0]).toHaveAttribute('data-testid', 'seat-carol')
    })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/game/gameView.test.ts src/components/game/GameTable.test.tsx src/components/game/GamePageConnected.test.tsx`
Expected: FAIL — `./gameView` and `./GameTable` not found; GamePageConnected renders `RealisticGameBoard` (no "Connecting to game...", no `game-phase`).

- [ ] **Step 3: Create `src/components/game/gameView.ts`**

```ts
import type { Boja, GameCard, PlayerPublicInfo, PublicGameView, Rank } from '../../types/game';

/** Bid buttons, in this order. */
export const BOJE: Boja[] = ['HERC', 'KARA', 'PIK', 'TREF'];

export const SUIT_LABEL: Record<Boja, string> = { HERC: 'Herc', KARA: 'Karo', PIK: 'Pik', TREF: 'Tref' };

export const RANK_LABEL: Record<Rank, string> = {
    SEDMICA: '7',
    OSMICA: '8',
    DEVETKA: '9',
    DESETKA: '10',
    DECKO: 'Decko',
    BABA: 'Baba',
    KRALJ: 'Kralj',
    AS: 'As',
};

export function cardLabel(card: GameCard): string {
    return `${RANK_LABEL[card.rank]} ${SUIT_LABEL[card.boja]}`;
}

/**
 * Seats in table order starting with `me` at the bottom, then the next player in
 * turn order (right), the partner (top) and the previous player (left).
 */
export function seatsFromMe(seatingOrder: PlayerPublicInfo[], me: string): PlayerPublicInfo[] {
    const start = seatingOrder.findIndex((seat) => seat.id === me);
    if (start <= 0) return seatingOrder;
    return [...seatingOrder.slice(start), ...seatingOrder.slice(0, start)];
}

/** Trump of the hand in progress: the trick's own, else the last trump call. */
export function trumpOf(view: PublicGameView): Boja | null {
    if (view.currentTrick?.trump) return view.currentTrick.trump;
    const call = [...(view.bids ?? [])].reverse().find((bid) => bid.action === 'CALL_TRUMP');
    return call?.selectedTrump ?? null;
}
```

- [ ] **Step 4: Create `src/components/game/GameTable.tsx`**

```tsx
import React from 'react';
import { Button } from '../common/Button';
import { PlayingCard } from '../common/PlayingCard';
import type { Boja, GameCard, PrivateGameView, PublicGameView } from '../../types/game';
import { BOJE, SUIT_LABEL, cardLabel, seatsFromMe, trumpOf } from './gameView';

export interface GameTableProps {
    publicView: PublicGameView;
    privateView: PrivateGameView | null;
    /** The signed-in player's username (the backend's player id). */
    me: string;
    error: string | null;
    onPass: () => void;
    onCallTrump: (trump: Boja) => void;
    onPlayCard: (card: GameCard) => void;
    onChallenge: () => void;
    onLeave: () => void;
}

// Grid cells for seatsFromMe order: you (bottom), next player (right), partner (top), left.
const SEAT_CELL = [
    'col-start-2 row-start-3',
    'col-start-3 row-start-2',
    'col-start-2 row-start-1',
    'col-start-1 row-start-2',
];

export const GameTable: React.FC<GameTableProps> = ({
    publicView,
    privateView,
    me,
    error,
    onPass,
    onCallTrump,
    onPlayCard,
    onChallenge,
    onLeave,
}) => {
    const phase = publicView.gameState;
    const yourTurn = privateView?.yourTurn === true;
    const hand = privateView?.hand ?? [];
    const seats = seatsFromMe(publicView.seatingOrder ?? [], me);
    const plays = publicView.currentTrick?.plays ?? {};
    const trump = trumpOf(publicView);
    const finished = phase === 'COMPLETED' || phase === 'CANCELLED';
    const canBid = phase === 'BIDDING' && yourTurn;
    const canPlay = phase === 'PLAYING' && yourTurn;
    const canChallenge = (phase === 'PLAYING' || phase === 'HAND_COMPLETE')
        && privateView !== null && !privateView.challengeUsed;

    return (
        <div className="max-w-5xl mx-auto px-4 space-y-6">
            <div className="card flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-lg font-semibold">
                    <span className="text-blue-300">Team A: <span data-testid="score-a">{publicView.teamAScore}</span></span>
                    <span className="text-red-300">Team B: <span data-testid="score-b">{publicView.teamBScore}</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-emerald-200">
                    <span>Phase: <span data-testid="game-phase" className="font-medium text-white">{phase}</span></span>
                    {trump && (
                        <span>Trump: <span data-testid="trump" className="font-medium text-amber-300">{SUIT_LABEL[trump]}</span></span>
                    )}
                    {yourTurn && !finished && (
                        <span data-testid="your-turn" className="font-bold text-amber-400">Your turn</span>
                    )}
                </div>
            </div>

            {error && (
                <div role="alert" className="text-red-300 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {error}
                </div>
            )}

            {finished ? (
                <div className="card text-center space-y-4">
                    <h2 className="text-2xl font-bold text-white">
                        {phase === 'CANCELLED' ? 'Match cancelled' : 'Game over'}
                    </h2>
                    {phase === 'COMPLETED' && (
                        <p className="text-emerald-200">
                            {publicView.winnerTeamId ? `Team ${publicView.winnerTeamId} wins` : 'Draw'}
                        </p>
                    )}
                    <Button onClick={onLeave} variant="primary">Back to lobbies</Button>
                </div>
            ) : (
                <>
                    <div className="card grid grid-cols-3 grid-rows-3 gap-2 min-h-[22rem] items-center justify-items-center">
                        {seats.map((seat, index) => {
                            const played = plays[seat.id];
                            return (
                                <div
                                    key={seat.id}
                                    data-testid={`seat-${seat.id}`}
                                    className={`${SEAT_CELL[index]} flex flex-col items-center gap-2`}
                                >
                                    <div className="text-sm text-emerald-200">
                                        <span className="font-medium text-white">{seat.id === me ? 'You' : seat.id}</span>
                                        {' · '}
                                        <span data-testid={`cards-left-${seat.id}`}>{seat.cardsLeft}</span> cards
                                    </div>
                                    {played && (
                                        <div data-testid="trick-card" data-card={`${played.boja}-${played.rank}`}>
                                            <PlayingCard suit={played.boja} rank={played.rank} className="w-16 h-24" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {publicView.bids.length > 0 && (
                        <div className="card">
                            <h3 className="text-sm font-semibold text-emerald-200 mb-2">Bids</h3>
                            <ol className="flex flex-wrap gap-3 text-sm text-white">
                                {publicView.bids.map((bid, index) => (
                                    <li key={index} data-testid="bid">
                                        {bid.playerId}: {bid.action === 'CALL_TRUMP' && bid.selectedTrump ? SUIT_LABEL[bid.selectedTrump] : 'Pass'}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {canBid && (
                        <div className="card flex flex-wrap items-center gap-3">
                            <span className="text-emerald-200 text-sm mr-2">Your bid:</span>
                            <Button variant="outline" onClick={onPass}>Pass</Button>
                            {BOJE.map((boja) => (
                                <Button key={boja} variant="primary" onClick={() => onCallTrump(boja)}>
                                    Call {SUIT_LABEL[boja]}
                                </Button>
                            ))}
                        </div>
                    )}

                    <div className="card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-white">Your hand</h3>
                            {canChallenge && (
                                <Button variant="outline" size="small" onClick={onChallenge}>Challenge</Button>
                            )}
                        </div>
                        <div data-testid="hand" className="flex flex-wrap justify-center gap-2">
                            {hand.map((card) => (
                                <button
                                    key={`${card.boja}-${card.rank}`}
                                    type="button"
                                    data-testid="hand-card"
                                    data-card={`${card.boja}-${card.rank}`}
                                    aria-label={cardLabel(card)}
                                    disabled={!canPlay}
                                    onClick={() => onPlayCard(card)}
                                    className={`w-16 h-24 rounded-lg transition-transform ${
                                        canPlay ? 'hover:-translate-y-1 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <PlayingCard suit={card.boja} rank={card.rank} className="w-full h-full" />
                                </button>
                            ))}
                        </div>
                        {!yourTurn && (
                            <p className="text-center text-emerald-300 text-sm mt-2">Waiting for other players...</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
```

- [ ] **Step 5: Replace the whole of `src/components/game/GamePageConnected.tsx`**

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBelatroGame } from '../../hooks/useBelatroGame';
import { Loading } from '../common';
import { GameTable } from './GameTable';

export default function GamePageConnected() {
    const { gameId = '' } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const { publicView, privateView, isConnected, connectionError, error, actions } =
        useBelatroGame(gameId, () => navigate('/lobbies'));

    if (!publicView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-96 gap-4">
                <Loading size="large" text={isConnected ? 'Loading game state...' : 'Connecting to game...'} />
                {connectionError && <p role="alert" className="text-red-300 text-sm">{connectionError}</p>}
            </div>
        );
    }

    return (
        <GameTable
            publicView={publicView}
            privateView={privateView}
            me={user?.username ?? ''}
            error={error}
            onPass={actions.passBid}
            onCallTrump={actions.bidTrump}
            onPlayCard={actions.play}
            onChallenge={actions.challenge}
            onLeave={() => navigate('/lobbies')}
        />
    );
}
```

- [ ] **Step 6: Route `/game/:gameId` to it and delete the placeholder**

6a. In `src/App.tsx` replace

```tsx
import {GameBoard} from "./components/game";
```

with

```tsx
import GamePageConnected from './components/game/GamePageConnected';
```

and replace

```tsx
                                    <GameBoard />  {/* Game page component connected via WebSocket */}
```

with

```tsx
                                    <GamePageConnected />  {/* Game page component connected via WebSocket */}
```

6b. In `src/components/game/index.ts` delete the line

```ts
export { GameBoard } from './GameBoard';
```

6c. `git rm src/components/game/GameBoard.tsx`

- [ ] **Step 7: Run the tests and the suite** — the three new files pass (5 + 7 + 2); `npm test` all pass.

- [ ] **Step 8: Gates** — procedure T with no allowance any more (expect no output: `GameBoard.tsx` is gone and `GamePageConnected.tsx` compiles); procedure L (nothing new in `GameTable.tsx`, `gameView.ts`, `GamePageConnected.tsx`, `App.tsx`, `index.ts`).

- [ ] **Step 9: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/game/gameView.ts src/components/game/gameView.test.ts src/components/game/GameTable.tsx src/components/game/GameTable.test.tsx src/components/game/GamePageConnected.tsx src/components/game/GamePageConnected.test.tsx src/components/game/index.ts src/App.tsx
test ! -e src/components/game/GameBoard.tsx && git status --short src/components/game/GameBoard.tsx   # expect: D  src/components/game/GameBoard.tsx (staged by Step 6c)
git commit -m "feat(game): live table at /game/:gameId - seats, trick, bids, bid panel, hand, game over

/game/:gameId rendered the old GameBoard placeholder (no bidding, wrong
fields) while GamePageConnected wrapped the demo board, whose live mode
gates every move on its own simulated state. GameTable renders straight
from the public and private views." -- src/components/game/gameView.ts src/components/game/gameView.test.ts src/components/game/GameTable.tsx src/components/game/GameTable.test.tsx src/components/game/GamePageConnected.tsx src/components/game/GamePageConnected.test.tsx src/components/game/index.ts src/App.tsx src/components/game/GameBoard.tsx
git show --stat HEAD
```

Expected `git show --stat`: the 8 paths plus `src/components/game/GameBoard.tsx` as deleted.

---

### Task 9: Every lobby member reaches the game (B8 lobby flow)

**Gaps (read in code):** the lobby page `LobbyDetails` is unreachable — `LobbyDetailsPopup`'s "Enter Game" goes to `/lobby/{id}`, which has no route (404); the lobby barrel imports `./TeamManagement` but the file is `TeamManagment.tsx`; `TeamManagment` calls `switchTeam` with one argument (TS error; at runtime the lobby id becomes `[object Object]`) and sends `UNASSIGNED` where the backend wants `U`; `lobbyService` uses wrong routes and verbs for start (`/start` → backend `/start-match`), switch team (`/lobbies/{id}/switch-team` → `POST /lobbies/switchTeam`), kick and leave (`POST` → `PATCH`), update (`PUT /lobbies/{id}` → `PUT /lobbies`); the WIP's `matchService.getByLobbyId` uses a raw `fetch` with no API prefix and no bearer token. A casual start pushes nothing over STOMP (`LobbyServiceImpl.startMatch` only starts the game), so non-hosts must poll: the lobby flips to `CLOSED` **before** the match is persisted, and `GET /matches/getmatchbylobbyid/{id}` answers 404 until it exists — the follow-up must retry. `LobbyDetails` also shows a full-page spinner whenever a fetch is in flight, so a poll would blank the page every few seconds.

**Files:**
- Modify: `src/services/lobbyService.ts`, `src/services/matchService.ts`, `src/components/lobby/LobbyDetails.tsx` (full rewrite), `src/components/lobby/TeamManagment.tsx`, `src/components/lobby/index.ts`, `src/App.tsx`
- Test: `src/services/lobbyService.test.ts`, `src/components/lobby/LobbyDetails.test.tsx`, `src/components/lobby/TeamManagement.test.tsx`

**Interfaces:**
- Consumes (backend `LobbyController`/`MatchController`, read at trunk): `POST /lobbies/{id}/start-match` → `MatchDTO`; `POST /lobbies/switchTeam` body `{lobbyId, userId, targetTeam}` with `targetTeam ∈ A|B|U` (Stage B drops `userId`); `PATCH /lobbies/{id}/kick`; `PATCH /lobbies/{id}/leave`; `PUT /lobbies` with the id in the body; `GET /lobbies/{id}`; `GET /matches/getmatchbylobbyid/{lobbyId}` (404 until the match exists).
- Produces: route `/lobby/:lobbyId` (protected, sidebar layout); `lobbyService.startMatch(lobbyId): Promise<MatchDTO>`; `LobbyDetails` polls every 3 s and navigates every member to `/game/{matchId}` once the lobby is `CLOSED`. Task 11's harness drives: buttons `Create Game`, `Create Lobby`, `Join Game`, `Enter Game`, `Join Team A`, `Join Team B`, a button whose name contains `Start Match`; label `Lobby Name`.

- [ ] **Step 1: Write the failing tests**

`src/services/lobbyService.test.ts`:

```ts
import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient } from './api'
import { lobbyService } from './lobbyService'

afterEach(() => vi.restoreAllMocks())

describe('lobbyService routes match LobbyController', () => {
    test('start uses POST /lobbies/{id}/start-match', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ id: 'm1' })
        await expect(lobbyService.startMatch('l1')).resolves.toEqual({ id: 'm1' })
        expect(post).toHaveBeenCalledWith('/lobbies/l1/start-match')
    })

    test('switch team uses POST /lobbies/switchTeam with the lobby id in the body', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await lobbyService.switchTeam('l1', { lobbyId: 'l1', userId: 'u1', targetTeam: 'B' })
        expect(post).toHaveBeenCalledWith('/lobbies/switchTeam', { lobbyId: 'l1', userId: 'u1', targetTeam: 'B' })
    })

    test('kick and leave are PATCH', async () => {
        const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
        await lobbyService.kickPlayer('l1', { lobbyId: 'l1', usernameToKick: 'bob', requesterUsername: 'ana' })
        expect(patch).toHaveBeenCalledWith('/lobbies/l1/kick', { lobbyId: 'l1', usernameToKick: 'bob', requesterUsername: 'ana' })
        await lobbyService.leaveLobby('l1', { id: 'l1', username: 'ana' })
        expect(patch).toHaveBeenLastCalledWith('/lobbies/l1/leave', { id: 'l1', username: 'ana' })
    })

    test('update is PUT /lobbies with the id in the body', async () => {
        const put = vi.spyOn(apiClient, 'put').mockResolvedValue({})
        await lobbyService.updateLobby('l1', { name: 'Friday' })
        expect(put).toHaveBeenCalledWith('/lobbies', { name: 'Friday', id: 'l1' })
    })
})
```

`src/components/lobby/TeamManagement.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamManagement } from './TeamManagment'
import { useLobbies } from '../../hooks/useLobby'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn() }))

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const switchTeam = vi.fn()

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: bob,
        teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [ana], privateLobby: false, password: null,
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    switchTeam.mockResolvedValue({})
    vi.mocked(useLobbies).mockReturnValue({ switchTeam, isSwitchingTeam: false } as never)
})

describe('TeamManagement', () => {
    test('joining team B sends the lobby id and the backend team code', async () => {
        const user = userEvent.setup()
        render(<TeamManagement lobby={lobby()} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: 'Join Team B' }))
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', userId: 'u1', targetTeam: 'B' })
    })

    test('leaving a team sends U, the backend code for unassigned', async () => {
        const user = userEvent.setup()
        render(<TeamManagement lobby={lobby({ teamAPlayers: [bob, ana], unassignedPlayers: [] })} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: 'Leave Team' }))
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', userId: 'u1', targetTeam: 'U' })
    })
})
```

`src/components/lobby/LobbyDetails.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { LobbyDetails } from './LobbyDetails'
import { useLobby, useLobbies } from '../../hooks/useLobby'
import { matchService } from '../../services/matchService'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobby: vi.fn(), useLobbies: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))
vi.mock('../../services/matchService', () => ({ matchService: { getMatchByLobbyId: vi.fn() } }))

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const cy = { id: 'u3', username: 'cy' }
const dan = { id: 'u4', username: 'dan' }
const refetch = vi.fn()
const startMatch = vi.fn()

function lobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: ana,
        teamAPlayers: [ana, bob], teamBPlayers: [cy, dan], unassignedPlayers: [], privateLobby: false, password: null,
        ...overrides,
    }
}

function mockLobby(value: LobbyDTO) {
    vi.mocked(useLobby).mockReturnValue({
        lobby: value, isLoading: false, error: null, refetch, startMatch, isStartingMatch: false,
        deleteLobby: vi.fn(), isDeleting: false,
    } as never)
}

function GamePage() {
    const { gameId } = useParams()
    return <div>game page {gameId}</div>
}

function renderLobby() {
    render(
        <MemoryRouter initialEntries={['/lobby/l1']}>
            <Routes>
                <Route path="/lobby/:lobbyId" element={<LobbyDetails lobbyId="l1" />} />
                <Route path="/game/:gameId" element={<GamePage />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    refetch.mockResolvedValue(undefined)
    vi.mocked(useLobbies).mockReturnValue({
        switchTeam: vi.fn(), isSwitchingTeam: false, leaveLobby: vi.fn(), kickPlayer: vi.fn(), isLeaving: false, isKicking: false,
    } as never)
})
afterEach(() => vi.useRealTimers())

describe('LobbyDetails', () => {
    test('a member follows the closed lobby into its match', async () => {
        mockLobby(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId).mockResolvedValue({ id: 'm1' } as never)
        renderLobby()
        expect(await screen.findByText('game page m1')).toBeInTheDocument()
        expect(matchService.getMatchByLobbyId).toHaveBeenCalledWith('l1')
    })

    test('the lobby closes before the match is stored: a 404 is retried', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        mockLobby(lobby({ status: 'CLOSED', hostUser: bob }))
        vi.mocked(matchService.getMatchByLobbyId)
            .mockRejectedValueOnce(new ApiError({ status: 404, message: 'Not Found' }))
            .mockResolvedValueOnce({ id: 'm3' } as never)
        renderLobby()
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        expect(await screen.findByText('game page m3')).toBeInTheDocument()
    })

    test('the host starts the match and goes straight to it', async () => {
        mockLobby(lobby())
        startMatch.mockResolvedValue({ id: 'm2' })
        renderLobby()
        await userEvent.setup().click(screen.getByRole('button', { name: /start match/i }))
        expect(await screen.findByText('game page m2')).toBeInTheDocument()
    })

    test('a refused start shows the server message', async () => {
        mockLobby(lobby())
        startMatch.mockRejectedValue(new ApiError({ status: 409, message: 'Cannot start match: each team must have exactly 2 players.' }))
        renderLobby()
        await userEvent.setup().click(screen.getByRole('button', { name: /start match/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Cannot start match: each team must have exactly 2 players.')
    })

    test('the lobby is polled every three seconds without blanking the page', () => {
        vi.useFakeTimers()
        mockLobby(lobby({ teamBPlayers: [cy] }))
        renderLobby()
        expect(refetch).not.toHaveBeenCalled()
        act(() => { vi.advanceTimersByTime(3000) })
        expect(refetch).toHaveBeenCalledTimes(1)
        act(() => { vi.advanceTimersByTime(3000) })
        expect(refetch).toHaveBeenCalledTimes(2)
        expect(screen.getByText('Friday')).toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/services/lobbyService.test.ts src/components/lobby`
Expected: FAIL — lobbyService posts to `/lobbies/l1/start`, `/lobbies/l1/switch-team`, uses `post` for kick/leave and `PUT /lobbies/l1`; TeamManagement calls `switchTeam` with one object and `UNASSIGNED`; LobbyDetails never navigates, never polls, has no alert.

- [ ] **Step 3: Fix `src/services/lobbyService.ts`**

3a. Add `MatchDTO,` to the type import list — replace

```ts
    LobbyUpdateDTO,
    Void
} from '../types';
```

with

```ts
    LobbyUpdateDTO,
    MatchDTO,
    Void
} from '../types';
```

3b. Replace

```ts
    async leaveLobby(lobbyId: string, leaveData?: LeaveLobbyRequestDTO): Promise<Void> {
        return apiClient.post<Void>(`/lobbies/${lobbyId}/leave`, leaveData);
    },

    async updateLobby(lobbyId: string, updateData: LobbyUpdateDTO): Promise<LobbyDTO> {
        return apiClient.put<LobbyDTO>(`/lobbies/${lobbyId}`, updateData);
    },
```

with

```ts
    async leaveLobby(lobbyId: string, leaveData?: LeaveLobbyRequestDTO): Promise<Void> {
        return apiClient.patch<Void>(`/lobbies/${lobbyId}/leave`, leaveData);
    },

    // PUT /lobbies takes the lobby id in the body (LobbyController has no path variable here)
    async updateLobby(lobbyId: string, updateData: LobbyUpdateDTO): Promise<LobbyDTO> {
        return apiClient.put<LobbyDTO>('/lobbies', { ...updateData, id: lobbyId });
    },
```

3c. Replace

```ts
    async startLobby(lobbyId: string): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>(`/lobbies/${lobbyId}/start`);
    },

    // Alias for consistency with hook usage
    async startMatch(lobbyId: string): Promise<LobbyDTO> {
        return this.startLobby(lobbyId);
    },

    async kickPlayer(lobbyId: string, kickData: KickPlayerRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>(`/lobbies/${lobbyId}/kick`, kickData);
    },

    async switchTeam(lobbyId: string, switchData: TeamSwitchRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>(`/lobbies/${lobbyId}/switch-team`, switchData);
    }
```

with

```ts
    async startLobby(lobbyId: string): Promise<MatchDTO> {
        return apiClient.post<MatchDTO>(`/lobbies/${lobbyId}/start-match`);
    },

    // Alias for consistency with hook usage
    async startMatch(lobbyId: string): Promise<MatchDTO> {
        return this.startLobby(lobbyId);
    },

    async kickPlayer(lobbyId: string, kickData: KickPlayerRequestDTO): Promise<LobbyDTO> {
        return apiClient.patch<LobbyDTO>(`/lobbies/${lobbyId}/kick`, kickData);
    },

    async switchTeam(lobbyId: string, switchData: TeamSwitchRequestDTO): Promise<LobbyDTO> {
        return apiClient.post<LobbyDTO>('/lobbies/switchTeam', { ...switchData, lobbyId });
    }
```

- [ ] **Step 4: Remove the broken duplicate in `src/services/matchService.ts`** — delete exactly

```ts
    async getByLobbyId(lobbyId: string): Promise<MatchDTO | null> {
        const res = await fetch(`/matches/getmatchbylobbyid/${encodeURIComponent(lobbyId)}`, {
            credentials: "include",
        });
        if (!res.ok) return null;
        return res.json();
    },
```

(`getMatchByLobbyId`, via `apiClient`, stays; `LobbyDetails` was the only caller of the removed one.)

- [ ] **Step 5: Fix `src/components/lobby/TeamManagment.tsx`**

5a. Replace

```tsx
            await switchTeam({
                lobbyId: lobby.id,
```

with

```tsx
            await switchTeam(lobby.id, {
                lobbyId: lobby.id,
```

5b. Replace

```tsx
                            onClick={() => handleSwitchTeam('UNASSIGNED')}
```

with

```tsx
                            onClick={() => handleSwitchTeam('U')}
```

- [ ] **Step 6: Fix the barrel `src/components/lobby/index.ts`** — replace `export { TeamManagement } from './TeamManagement';` with `export { TeamManagement } from './TeamManagment';` and `export type { TeamManagementProps } from './TeamManagement';` with `export type { TeamManagementProps } from './TeamManagment';` (the file name keeps its historical spelling).

- [ ] **Step 7: Replace the whole of `src/components/lobby/LobbyDetails.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { TeamManagement } from './TeamManagment.tsx';
import { LobbyControls } from './LobbyControls';
import { Loading, Button } from '../common';
import { useLobby } from '../../hooks/useLobby';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from "react-router-dom";
import { matchService } from "../../services/matchService";

export interface LobbyDetailsProps {
    lobbyId: string;
}

// A casual start pushes nothing over STOMP: members learn about it by polling.
const LOBBY_POLL_MS = 3000;

export const LobbyDetails: React.FC<LobbyDetailsProps> = ({ lobbyId }) => {
    const {
        lobby,
        isLoading,
        error,
        refetch,
        startMatch,
        isStartingMatch
    } = useLobby(lobbyId);

    const { user } = useAuth();
    const navigate = useNavigate();
    const [startError, setStartError] = useState<string | null>(null);

    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;
    useEffect(() => {
        const timer = window.setInterval(() => {
            refetchRef.current().catch(() => undefined);
        }, LOBBY_POLL_MS);
        return () => window.clearInterval(timer);
    }, []);

    const isMember = [
        ...(lobby?.teamAPlayers ?? []),
        ...(lobby?.teamBPlayers ?? []),
        ...(lobby?.unassignedPlayers ?? []),
    ].some((player) => player?.id === user?.id);
    const lobbyClosed = lobby?.status === 'CLOSED';

    // Once the host starts, the lobby closes and every member follows it into the
    // game. The lobby is saved CLOSED before its match exists, so a 404 means
    // "not yet": try again after the next poll interval.
    useEffect(() => {
        if (!lobbyClosed || !isMember) return;
        let cancelled = false;
        let retry: number | undefined;
        const follow = () => {
            matchService.getMatchByLobbyId(lobbyId)
                .then((match) => {
                    if (!cancelled && match?.id) navigate(`/game/${match.id}`);
                })
                .catch(() => {
                    if (!cancelled) retry = window.setTimeout(follow, LOBBY_POLL_MS);
                });
        };
        follow();
        return () => {
            cancelled = true;
            if (retry) window.clearTimeout(retry);
        };
    }, [lobbyClosed, isMember, lobbyId, navigate]);

    // Only the first load shows a spinner; later polls keep the page in place.
    if (isLoading && !lobby) {
        return <Loading size="large" text="Loading lobby..." />;
    }

    if (error || !lobby) {
        const errorMessage = error ? (typeof error === 'string' ? error : 'Failed to load lobby') : 'Lobby not found';

        return (
            <div className="card bg-red-900/20 border-red-500/30">
                <div className="flex items-center gap-3">
                    <div className="text-red-400 text-2xl">⚠️</div>
                    <div>
                        <h3 className="text-red-400 font-semibold">Error Loading Lobby</h3>
                        <p className="text-red-300 text-sm">{errorMessage}</p>
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button
                        onClick={refetch}
                        variant="outline"
                        size="small"
                    >
                        Try Again
                    </Button>
                    <Button
                        onClick={() => window.history.back()}
                        variant="primary"
                        size="small"
                    >
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const isHost = user?.id === lobby.hostUser?.id;
    const totalPlayers =
        (lobby.teamAPlayers?.length || 0) +
        (lobby.teamBPlayers?.length || 0) +
        (lobby.unassignedPlayers?.length || 0);

    const teamACount = lobby.teamAPlayers?.length ?? 0;
    const teamBCount = lobby.teamBPlayers?.length ?? 0;

    const canStartMatch = Boolean(isHost && teamACount === 2 && teamBCount === 2);

    const handleStartMatch = async () => {
        setStartError(null);
        try {
            const match = await startMatch();
            if (match?.id) navigate(`/game/${match.id}`);
        } catch (e) {
            setStartError(e instanceof Error ? e.message : 'Failed to start match');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-white">
                            {lobby.name || 'Unnamed Lobby'}
                        </h1>
                        {lobby.privateLobby && (
                            <span className="text-yellow-400 text-xl">🔒</span>
                        )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              {lobby.gameMode === 'RANKED' ? '🏆' : '🎮'}
                <span className="capitalize">{lobby.gameMode}</span>
            </span>
                        <span>•</span>
                        <span>Host: {lobby.hostUser?.username}</span>
                        <span>•</span>
                        <span>{totalPlayers}/4 Players</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={refetch}
                        variant="outline"
                        size="small"
                    >
                        🔄 Refresh
                    </Button>

                    {isHost && (
                        <Button
                            onClick={handleStartMatch}
                            variant="primary"
                            disabled={!canStartMatch || isStartingMatch}
                        >
                            {isStartingMatch ? "Starting..." : "🚀 Start Match"}
                        </Button>
                    )}
                </div>
            </div>

            {startError && (
                <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {startError}
                </div>
            )}

            {/* Start Match Requirements */}
            {isHost && !canStartMatch && (
                <div className="card bg-yellow-900/20 border-yellow-500/30">
                    <div className="flex items-center gap-3">
                        <div className="text-yellow-400 text-xl">⚠️</div>
                        <div>
                            <h3 className="text-yellow-400 font-semibold">Cannot Start Match</h3>
                            <p className="text-yellow-300 text-sm">
                                Each team needs exactly 2 players, and nobody may be unassigned.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Management */}
            <TeamManagement
                lobby={lobby}
                currentUser={user}
                onUpdate={refetch}
            />

            {/* Lobby Controls */}
            <LobbyControls
                lobby={lobby}
                currentUser={user}
                onUpdate={refetch}
            />

            {/* Lobby Info */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Lobby Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-slate-400">Created:</span>
                        <div className="text-white">
                            {lobby.createdAt ? new Date(lobby.createdAt).toLocaleString() : 'Unknown'}
                        </div>
                    </div>

                    <div>
                        <span className="text-slate-400">Status:</span>
                        <div className="text-white">
                            {lobby.status === 'WAITING' ? (
                                <span className="text-green-400">Open for Players</span>
                            ) : (
                                <span className="text-red-400">Closed</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <span className="text-slate-400">Lobby Type:</span>
                        <div className="text-white">
                            {lobby.privateLobby ? (
                                <span className="text-yellow-400">🔒 Private</span>
                            ) : (
                                <span className="text-green-400">🌐 Public</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <span className="text-slate-400">Game Mode:</span>
                        <div className="text-white capitalize">
                            {lobby.gameMode === 'RANKED' ? '🏆 Ranked' : '🎮 Casual'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
```

(Changes versus the WIP: polling, the closed-lobby follow with 404 retry, a start handler that navigates on the returned match and shows refusals, spinner only on first load, the correct start requirement text, and the redundant `?? lobby?.teamAPlayers` fallbacks collapsed.)

- [ ] **Step 8: Add the `/lobby/:lobbyId` route in `src/App.tsx`**

8a. Below `import { LobbyList } from './components/lobby/LobbyList';` add

```tsx
import { LobbyDetails } from './components/lobby/LobbyDetails';
```

8b. Below the `LobbiesPage` component (after its closing `);`) add

```tsx
const LobbyPage = () => {
    const { lobbyId } = useParams<{ lobbyId: string }>();

    return (
        <PageLayout title="Lobby" subtitle="Pick your team; the host starts the match">
            <LobbyDetails lobbyId={lobbyId ?? ''} />
        </PageLayout>
    );
};
```

8c. Below the `/lobbies` route element (after its closing `} />`) add

```tsx
                    <Route path="/lobby/:lobbyId" element={
                        <ProtectedRoute>
                            <AppLayout showSidebar={true}>
                                <LobbyPage />
                            </AppLayout>
                        </ProtectedRoute>
                    } />
```

- [ ] **Step 9: Run the tests and the suite** — `npx vitest run src/services/lobbyService.test.ts src/components/lobby` → 4 + 2 + 5 pass; `npm test` all pass.

- [ ] **Step 10: Gates** — procedure T (the baseline errors for `TeamManagment.tsx` and `lobby/index.ts` disappear; nothing new), procedure L.

- [ ] **Step 11: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/services/lobbyService.ts src/services/lobbyService.test.ts src/services/matchService.ts src/components/lobby/LobbyDetails.tsx src/components/lobby/LobbyDetails.test.tsx src/components/lobby/TeamManagment.tsx src/components/lobby/TeamManagement.test.tsx src/components/lobby/index.ts src/App.tsx
git commit -m "fix(lobby): reachable lobby page, real routes, and every member follows the start into the game

/lobby/:lobbyId had no route. Start, switch team, kick, leave and update hit
paths or verbs LobbyController does not serve. A casual start pushes nothing
over STOMP, so the lobby page polls and, once CLOSED, looks up the match by
lobby id (retrying the 404 while the match is not stored yet)." -- src/services/lobbyService.ts src/services/lobbyService.test.ts src/services/matchService.ts src/components/lobby/LobbyDetails.tsx src/components/lobby/LobbyDetails.test.tsx src/components/lobby/TeamManagment.tsx src/components/lobby/TeamManagement.test.tsx src/components/lobby/index.ts src/App.tsx
git show --stat HEAD
```

---

### Task 10: Type sweep to zero (B6 part 1; old plan Task 10 step 1; E5 dead layout files; B3)

`npm run build` runs `tsc -b`, and it has failed since before this work. After Tasks 2–9 the remaining baseline errors are the ones below; this task fixes each with the smallest type-level edit, so the build passes from here on.

**Reconciliations with the old plan and the roadmap (decided):**
- Old plan Task 7 (a `userSearch` predicate + test) is **dropped**: the search already worked (an absent email made the second term false); only its type error remains, fixed below by removing the dead term. Stage D (Task 21, E7) moves search to the server anyway, which would delete that predicate again.
- E5's "delete dead `Header`/`UserDropdown`/`MainLayout`" is **done here, in Stage A**: it needs no backend change, and the old plan's alternative (minimally patching their type errors) would edit files E5 deletes. Verified unreferenced: only `Header.tsx` imports `UserDropdown`; nothing imports `Header` or `MainLayout`.

**Files:**
- Delete: `src/components/layout/Header.tsx`, `src/components/layout/UserDropdown.tsx`, `src/components/layout/MainLayout.tsx`
- Modify: `src/components/admin/AdminStats.tsx`, `src/components/profile/UserList.tsx`, `src/components/match/MatchCard.tsx`, `src/components/match/MatchDetails.tsx`, `src/components/match/MatchSummaryCard.tsx`, `src/App.tsx`, `src/components/game/PlayButton.tsx`, `src/components/game/QueueStatus.tsx`, `src/hooks/useFriends.ts`, `src/MockComponents/RealisticGameBoard.tsx`

**Interfaces:**
- Consumes: nothing new. Produces: `npx tsc -b` exit 0, which every later task keeps.

- [ ] **Step 1: Confirm the starting list**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
npx tsc -b --pretty false 2>&1 | grep -E '^src/.*error TS' | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u
```

Expected (exactly these files; if another file appears, stop and report it): `src/App.tsx` (PageLayout `title` missing), `src/components/admin/AdminStats.tsx` (`lastLogin` ×2), `src/components/layout/Header.tsx`, `src/components/layout/MainLayout.tsx`, `src/components/layout/UserDropdown.tsx`, `src/components/match/MatchCard.tsx` (null vs undefined ×4), `src/components/match/MatchDetails.tsx` (`getFinalScores` unused, `ChallengeDTO` not found), `src/components/match/MatchSummaryCard.tsx` (`result` unused), `src/components/profile/FriendList.tsx` (7× `'{}'`), `src/hooks/useFriends.ts` (`reject` unused), `src/components/profile/UserList.tsx` (`email`), `src/components/game/PlayButton.tsx` (`user` unused), `src/components/game/QueueStatus.tsx` (`isInQueue`, `webSocketError` unused), `src/MockComponents/RealisticGameBoard.tsx` (`renderPlayerCard` unused).

- [ ] **Step 2: Delete the dead layout components**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
grep -rn -e "layout/Header" -e "layout/MainLayout" -e "layout/UserDropdown" -e "from './Header'" -e "from './MainLayout'" -e "from './UserDropdown'" src | grep -v '^src/components/layout/Header.tsx'
```

Expected: no output. Then `git rm src/components/layout/Header.tsx src/components/layout/UserDropdown.tsx src/components/layout/MainLayout.tsx`.

- [ ] **Step 3: `src/components/admin/AdminStats.tsx`** — the API has no `lastLogin`, so the "Active Users (24h)" stat could only ever show 0. Delete

```tsx
    const activeUsers = allUsers?.filter(user =>
        user.lastLogin &&
        new Date(user.lastLogin) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length || 0;
```

delete the stat entry

```tsx
        {
            label: 'Active Users (24h)',
            value: activeUsers,
            icon: '🟢',
            color: 'text-green-400',
            bgColor: 'bg-green-500/20'
        },
```

and change `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">` to `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">`.

- [ ] **Step 4: `src/components/profile/UserList.tsx`** (B3: username-only search) — replace

```tsx
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const username = user.username?.toLowerCase() || '';
                    const email = user.email?.toLowerCase() || '';
                    return username.includes(term) || email.includes(term);
                }
```

with

```tsx
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const username = user.username?.toLowerCase() || '';
                    return username.includes(term);
                }
```

and change the input's `placeholder="Search users by username or email..."` to `placeholder="Search users by username..."`.

- [ ] **Step 5: `src/components/match/MatchCard.tsx`** — replace `{formatDate(match.endTime)}` with `{formatDate(match.endTime ?? undefined)}`; replace both occurrences of `title={player.username}` with `title={player.username ?? undefined}`; replace `currentUserId={currentUserId}` with `currentUserId={currentUserId ?? undefined}`.

- [ ] **Step 6: `src/components/match/MatchDetails.tsx`**

6a. Replace `import type { UserSimpleDTO, HandDTO, TrumpCallDTO, MoveDTO, TrickDTO } from '../../types';` with `import type { UserSimpleDTO, HandDTO, TrumpCallDTO, MoveDTO, TrickDTO, ChallengeDTO } from '../../types';`

6b. Delete the unused helper (nothing calls it):

```tsx
    // Helper function to get the final cumulative scores from the last hand with scores
    const getFinalScores = (hands: HandDTO[]) => {
        // Find the last hand that has a handSummary with finalScore data
        for (let i = hands.length - 1; i >= 0; i--) {
            const hand = hands[i];
            if (hand.handSummary && (hand.handSummary.finalScoreA !== undefined || hand.handSummary.finalScoreB !== undefined)) {
                return {
                    teamAFinal: hand.handSummary.finalScoreA || 0,
                    teamBFinal: hand.handSummary.finalScoreB || 0
                };
            }
        }
        return { teamAFinal: 0, teamBFinal: 0 };
    };
```

(`MoveDTO.legal` and the "illegal" badge stay — lane-debt confirmed `legal` is live.)

- [ ] **Step 7: `src/components/match/MatchSummaryCard.tsx`** — replace `const { matchId, endTime, result, yourOutcome, gameMode } = summaryItem;` with `const { matchId, endTime, yourOutcome, gameMode } = summaryItem;`

- [ ] **Step 8: `src/App.tsx`** — the play page renders its own hero and has always shown an empty `<h1>` here; keep that output exactly and satisfy the required prop. Replace

```tsx
const PlayGamePage = () => (
    <PageLayout>
```

with

```tsx
const PlayGamePage = () => (
    <PageLayout title="">
```

- [ ] **Step 9: `src/components/game/PlayButton.tsx`** — replace `const { user, isAuthenticated } = useAuth();` with `const { isAuthenticated } = useAuth();`

- [ ] **Step 10: `src/components/game/QueueStatus.tsx`** — replace

```tsx
    const {
        isInQueue,
        queueStatus,
        isJoining,
        isWebSocketConnected,
        webSocketError
    } = useEnhancedRanked();
```

with

```tsx
    const {
        queueStatus,
        isJoining,
        isWebSocketConnected
    } = useEnhancedRanked();
```

- [ ] **Step 11: `src/hooks/useFriends.ts`** — the cache and the wait-for-cache promise were untyped, so `friendships` came out as `{}` in `FriendList`.

11a. Replace `import type { CreateFriendshipDTO } from '../types';` with `import type { CreateFriendshipDTO, Friendship } from '../types';`

11b. Replace `    data: any[];` with `    data: Friendship[];`

11c. Replace `                return new Promise((resolve, reject) => {` with `                return new Promise<Friendship[]>((resolve) => {`

- [ ] **Step 12: `src/MockComponents/RealisticGameBoard.tsx`** — delete the unused `renderPlayerCard` (the whole `const renderPlayerCard = (card: Card, index: number, playerIndex: number) => { … };` block, from that line through its closing `    };` just before `const passBid = () => {`), and then the `getSuitColor` helper that only it used:

```tsx
    const getSuitColor = (suit: string) => {
        switch (suit.toLowerCase()) {
            case 'pik': return 'rgba(34, 197, 94, 0.6)'; // Green
            case 'karo': return 'rgba(245, 158, 11, 0.6)'; // Gold
            case 'herc': return 'rgba(239, 68, 68, 0.6)'; // Red
            case 'tref': return 'rgba(139, 69, 19, 0.6)'; // Brown
            default: return 'rgba(156, 163, 175, 0.6)'; // Gray fallback
        }
    };
```

Before deleting, confirm `grep -n "getSuitColor\|renderPlayerCard" src/MockComponents/RealisticGameBoard.tsx` shows uses only inside `renderPlayerCard` and the two definitions.

- [ ] **Step 13: Type check to zero**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
npx tsc -b --pretty false; echo "exit=$?"
```

Expected: no error lines, `exit=0`. If an error remains, fix it with the same minimal approach only if it is in a file this task lists; otherwise stop and report.

- [ ] **Step 14: Suite and lint** — `npm test` all pass; procedure L (no new finding in the touched files; several disappear).

- [ ] **Step 15: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/admin/AdminStats.tsx src/components/profile/UserList.tsx src/components/match/MatchCard.tsx src/components/match/MatchDetails.tsx src/components/match/MatchSummaryCard.tsx src/App.tsx src/components/game/PlayButton.tsx src/components/game/QueueStatus.tsx src/hooks/useFriends.ts src/MockComponents/RealisticGameBoard.tsx
git commit -m "chore: type-check clean (npm run build passes again)

Removes reads of fields the API no longer serves (lastLogin, email), the
never-imported Header/UserDropdown/MainLayout, and unused locals; types the
friendship cache so FriendList sees Friendship[]." -- src/components/admin/AdminStats.tsx src/components/profile/UserList.tsx src/components/match/MatchCard.tsx src/components/match/MatchDetails.tsx src/components/match/MatchSummaryCard.tsx src/App.tsx src/components/game/PlayButton.tsx src/components/game/QueueStatus.tsx src/hooks/useFriends.ts src/MockComponents/RealisticGameBoard.tsx src/components/layout/Header.tsx src/components/layout/UserDropdown.tsx src/components/layout/MainLayout.tsx
git show --stat HEAD
```

---
### Task 11: Four-seat gameplay harness, first run against trunk (B8 runtime proof; reused by B9 in Task 22)

**Decision — committed script, not a scratch file:** `e2e/gameplay.mjs` is committed. It is the only end-to-end proof that the game works through the real SPA, and it must be re-run after Stage E and after any future change to the socket, lobby or game page. It adds no dependency footprint: `playwright-core` is resolved from a directory outside the repo (`PLAYWRIGHT_CORE_DIR`), it is not in `package.json`, `tsc` (`include: ["src"]`) and vitest (`src/**/*.test.*`) never see it, and ESLint only parses `.mjs` (the config's rules target `ts`/`tsx`). It runs before Stage C too: signup without the "check your inbox" panel, and email confirmation only when `E2E_CONFIRM_EMAIL=1`.

**What it checks:** four isolated browser contexts sign up (fresh usernames per run); optionally confirm their address from the mail in Mailpit; on `/play` each tab opens **exactly one** STOMP websocket (B7); the four form a lobby (create, join, teams 2+2, host starts) and every tab lands on `/game/:id`; each sees `BIDDING` and 6 cards; one player passes and the next calls Herc through the UI; each then holds 8 cards; eight cards (two tricks) are played by clicking, each move well inside the backend's 30-second turn timer (illegal cards are silently ignored by the backend, so the harness tries the next card when the hand does not shrink); every tab's game page used exactly one STOMP websocket; no request or socket URL carries `?user=`.

**Files:**
- Create: `e2e/gameplay.mjs`

**Interfaces:**
- Consumes: the DOM hooks of Task 8 (`game-phase`, `your-turn`, `hand-card`, `bid`, buttons `Pass` / `Call Herc`) and Task 9 (`Create Game`, `Lobby Name`, `Create Lobby`, `Join Game`, `Enter Game`, `Join Team A`, `Join Team B`, `Start Match`), the signup labels (`Username`, `Email`, `Password`, `Confirm Password`) and, from Stage C on, the `Continue` button (Task 19) and the confirm page's `Confirm email address` button and `Your email address is confirmed.` text (Task 16). Mailpit HTTP API: `GET /api/v1/search?query=to:<address>` → `{messages: [{ID}]}`, `GET /api/v1/message/<ID>` → `{Text}`.
- Produces: exit code 0 and a JSON summary `{ ok, players, uiBids, played, gameSockets }` on stdout; on failure exit code 1 and one full-page screenshot per seat in `E2E_ARTIFACTS`.

- [ ] **Step 1: Install playwright-core outside the repo and check the browser**

```bash
mkdir -p /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/pw
npm i --prefix /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/pw playwright-core@1.62.1
node -e "const {chromium}=require('/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/pw/node_modules/playwright-core'); console.log(chromium.executablePath())"
ls ~/Library/Caches/ms-playwright
```

Expected: the printed executable path lies under `~/Library/Caches/ms-playwright/chromium-1234/`, and that directory exists. If the path names another build number, stop and report (do not download browsers).

- [ ] **Step 2: Create `e2e/gameplay.mjs`**

```js
#!/usr/bin/env node
// Four-seat gameplay check through the real SPA (roadmap B8/B9).
//
// Four isolated browser contexts sign up, optionally confirm their email address
// from the mail in Mailpit, check that /play opens exactly one STOMP socket,
// form a lobby, start the match, bid (one Pass, one trump call) and play eight
// cards (two tricks) by clicking the hand - each move well inside the backend's
// 30-second turn timer. Also fails if any request or socket URL carries ?user=.
//
// Needs the backend on :8080 (local Docker Mongo/Redis/Mailpit, never the real
// .env), the SPA dev server on :5173, and playwright-core 1.62.1 installed
// OUTSIDE this repo (it is not a project dependency):
//   npm i --prefix <dir> playwright-core@1.62.1
//   PLAYWRIGHT_CORE_DIR=<dir>/node_modules/playwright-core node e2e/gameplay.mjs
// Env: SPA_URL (default http://localhost:5173), MAILPIT_URL (default
// http://localhost:8025), E2E_CONFIRM_EMAIL=1 to confirm addresses (needs the
// email feature), HEADLESS=0 to watch, E2E_ARTIFACTS for failure screenshots.
// Signup is rate limited per IP (5/hour from the email lane on): restart the
// backend before re-running within the hour.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');

const SPA = process.env.SPA_URL ?? 'http://localhost:5173';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const CONFIRM_EMAIL = process.env.E2E_CONFIRM_EMAIL === '1';
const ARTIFACTS = process.env.E2E_ARTIFACTS ?? join(tmpdir(), 'belatro-e2e');
const PASSWORD = 'e2e-password-123';
const RUN = Date.now().toString(36).slice(-5);
const PLAYERS = [1, 2, 3, 4].map((n) => `e2e${RUN}p${n}`);
const TARGET_PLAYS = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const emailOf = (username) => `${username}@example.test`;

async function waitUntil(check, timeoutMs, what) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (await check()) return;
        if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms: ${what}`);
        await sleep(250);
    }
}

function watch(page, label, leaks) {
    const sockets = [];
    page.on('websocket', (ws) => {
        const url = ws.url();
        if (/[?&]user=/.test(url)) leaks.push(`${label} websocket ${url}`);
        // SockJS sessions live under /ws/<server>/<session>/websocket; Vite's HMR socket is "/".
        if (new URL(url).pathname.startsWith('/ws/')) sockets.push(url);
    });
    page.on('request', (request) => {
        if (/[?&]user=/.test(request.url())) leaks.push(`${label} ${request.url()}`);
    });
    return sockets;
}

async function signUp(page, username) {
    await page.goto(`${SPA}/signup`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Email', { exact: true }).fill(emailOf(username));
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    // From the email lane on, a "check your inbox" panel comes first.
    const proceed = page.getByRole('button', { name: 'Continue', exact: true });
    await waitUntil(
        async () => page.url().endsWith('/dashboard') || (await proceed.isVisible().catch(() => false)),
        15000, `${username} signed up`);
    if (!page.url().endsWith('/dashboard')) {
        await proceed.click();
        await page.waitForURL('**/dashboard', { timeout: 15000 });
    }
}

async function confirmLinkFor(address) {
    let link = null;
    await waitUntil(async () => {
        const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
        if (!search.ok) return false;
        const { messages = [] } = await search.json();
        for (const message of messages) {
            const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
            const match = /https?:\/\/\S+\/confirm-email\?token=[A-Za-z0-9_-]+/.exec(full.Text ?? '');
            if (match) {
                link = new URL(match[0]);
                return true;
            }
        }
        return false;
    }, 30000, `confirmation mail for ${address}`);
    return link;
}

async function confirmEmail(page, username) {
    const link = await confirmLinkFor(emailOf(username));
    await page.goto(`${SPA}${link.pathname}${link.search}`);
    await page.getByRole('button', { name: 'Confirm email address', exact: true }).click();
    await page.getByText('Your email address is confirmed.').waitFor({ timeout: 15000 });
}

async function checkPlayPage(page, sockets, label) {
    sockets.length = 0;
    await page.goto(`${SPA}/play`);
    await page.getByText('RANKED', { exact: true }).waitFor({ timeout: 15000 });
    await sleep(3000);
    if (sockets.length !== 1) throw new Error(`${label}: /play opened ${sockets.length} STOMP sockets, expected 1`);
}

async function formLobby(pages) {
    const [host, ...guests] = pages;
    const name = `e2e-${RUN}`;
    await host.goto(`${SPA}/lobbies`);
    await host.getByRole('button', { name: 'Create Game', exact: true }).click();
    await host.getByLabel('Lobby Name').fill(name);
    await host.getByRole('button', { name: 'Create Lobby', exact: true }).click();
    await host.getByText(name, { exact: true }).click({ timeout: 15000 });
    await host.getByRole('button', { name: 'Enter Game', exact: true }).click();
    await host.waitForURL('**/lobby/**', { timeout: 15000 });
    const lobbyUrl = host.url();

    for (const [index, guest] of guests.entries()) {
        await guest.goto(`${SPA}/lobbies`);
        await guest.getByText(name, { exact: true }).click({ timeout: 15000 });
        const join = guest.getByRole('button', { name: 'Join Game', exact: true });
        await join.click();
        await join.waitFor({ state: 'detached', timeout: 15000 });
        await guest.goto(lobbyUrl);
        const team = index === 0 ? 'Join Team A' : 'Join Team B';
        const teamButton = guest.getByRole('button', { name: team, exact: true });
        await teamButton.click({ timeout: 15000 });
        await teamButton.waitFor({ state: 'detached', timeout: 15000 });
    }

    const start = host.getByRole('button', { name: /Start Match/ });
    await waitUntil(() => start.isEnabled(), 20000, 'the host can start the match');
    await start.click();
    for (const page of pages) await page.waitForURL('**/game/**', { timeout: 30000 });
}

const phaseOf = (page) => page.getByTestId('game-phase').textContent({ timeout: 1000 }).catch(() => null);
const handSize = (page) => page.getByTestId('hand-card').count();
const myTurn = (page) => page.getByTestId('your-turn').isVisible().catch(() => false);
const bidCount = (page) => page.getByTestId('bid').count();

async function playGame(pages) {
    await waitUntil(async () => (await Promise.all(pages.map(phaseOf))).every((p) => p === 'BIDDING'),
        45000, 'every seat sees BIDDING');
    for (const [i, page] of pages.entries()) {
        const size = await handSize(page);
        if (size !== 6) throw new Error(`${PLAYERS[i]} holds ${size} cards while bidding, expected 6`);
    }

    // Bidding: the first player to act passes, the next one calls Herc.
    const uiBids = [];
    await waitUntil(async () => {
        const phases = await Promise.all(pages.map(phaseOf));
        if (phases.every((p) => p === 'PLAYING')) return true;
        for (const [i, page] of pages.entries()) {
            if (phases[i] !== 'BIDDING' || !(await myTurn(page))) continue;
            const before = await bidCount(page);
            const choice = uiBids.length === 0 ? 'Pass' : 'Call Herc';
            await page.getByRole('button', { name: choice, exact: true }).click();
            await waitUntil(async () => (await bidCount(page)) > before || (await phaseOf(page)) !== 'BIDDING',
                5000, `${PLAYERS[i]}'s ${choice} is registered`);
            uiBids.push(`${PLAYERS[i]}: ${choice}`);
            break;
        }
        return false;
    }, 90000, 'bidding ends in PLAYING');

    await waitUntil(async () => (await Promise.all(pages.map(handSize))).every((n) => n === 8),
        15000, 'every seat holds 8 cards after the trump call');

    let played = 0;
    while (played < TARGET_PLAYS) {
        let page = null;
        await waitUntil(async () => {
            for (const candidate of pages) {
                if ((await phaseOf(candidate)) === 'PLAYING' && (await myTurn(candidate))) {
                    page = candidate;
                    return true;
                }
            }
            return false;
        }, 20000, `a seat's turn to play card ${played + 1}`);
        const before = await handSize(page);
        const cards = page.getByTestId('hand-card');
        let accepted = false;
        for (let i = 0; i < before && !accepted; i++) {
            const card = cards.nth(i);
            if (await card.isDisabled()) continue;
            await card.click();
            // the backend ignores an illegal card without an error frame: try the next one
            accepted = await waitUntil(async () => (await handSize(page)) < before, 2500, 'card accepted')
                .then(() => true, () => false);
        }
        if (!accepted) throw new Error('no card in the hand was accepted');
        played += 1;
    }

    const sizes = await Promise.all(pages.map(handSize));
    if (!sizes.every((n) => n === 6)) {
        throw new Error(`after ${TARGET_PLAYS} plays every hand should hold 6 cards, saw ${sizes.join(',')}`);
    }
    return { uiBids, played };
}

async function main() {
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
    const leaks = [];
    const contexts = await Promise.all(PLAYERS.map(() => browser.newContext()));
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const sockets = pages.map((page, i) => watch(page, PLAYERS[i], leaks));
    try {
        for (const [i, page] of pages.entries()) {
            await signUp(page, PLAYERS[i]);
            if (CONFIRM_EMAIL) await confirmEmail(page, PLAYERS[i]);
        }
        for (const [i, page] of pages.entries()) await checkPlayPage(page, sockets[i], PLAYERS[i]);
        sockets.forEach((list) => { list.length = 0; });
        await formLobby(pages);
        const result = await playGame(pages);
        const gameSockets = sockets.map((list) => list.length);
        if (!gameSockets.every((n) => n === 1)) {
            throw new Error(`game pages opened ${gameSockets.join(',')} STOMP sockets, expected 1 each`);
        }
        if (leaks.length) throw new Error(`?user= seen: ${leaks.join(' | ')}`);
        console.log(JSON.stringify({ ok: true, players: PLAYERS, confirmedEmail: CONFIRM_EMAIL, ...result, gameSockets }, null, 2));
    } catch (error) {
        await Promise.all(pages.map((page, i) =>
            page.screenshot({ path: join(ARTIFACTS, `${PLAYERS[i]}.png`), fullPage: true }).catch(() => undefined)));
        console.error(`FAILED: ${error.message} (screenshots in ${ARTIFACTS})`);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

await main();
```

- [ ] **Step 3: Start the rig** — run procedure R steps R0–R5 (backend at the current `lukasDev`).

- [ ] **Step 4: Run the harness against trunk**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
PLAYWRIGHT_CORE_DIR=/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/pw/node_modules/playwright-core \
E2E_ARTIFACTS=/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/e2e-stage-a \
node e2e/gameplay.mjs | tee /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/e2e-stage-a.json
echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0` and JSON with `"ok": true`, `"played": 8`, two `uiBids` entries (`…: Pass`, `…: Call Herc`), `"gameSockets": [1, 1, 1, 1]`.

If it fails: read the screenshots and `backend.log`; follow superpowers:systematic-debugging. Fix the cause in the owning task's files **with a new failing unit test first**, re-run Steps 4. Never weaken an assertion of the harness to make it pass. If the cause is in the backend, stop and report it (the backend is read-only here).

- [ ] **Step 5: Lint gate** — procedure L (the `.mjs` must not add a parse error).

- [ ] **Step 6: Commit** (keep the rig running for Task 12)

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add e2e/gameplay.mjs
git commit -m "test(e2e): four-seat gameplay harness through the real SPA

Signs up four isolated browser seats, checks /play opens one STOMP socket,
forms a lobby, starts, bids (Pass, then Herc) and plays two tricks by
clicking, inside the 30 s turn timer; fails on any ?user= URL.
playwright-core is resolved from PLAYWRIGHT_CORE_DIR, outside the repo." -- e2e/gameplay.mjs
git show --stat HEAD
```

---

### Task 12: Stage A close-out — lint, suite, build, identity click-through (old plan Task 10, B6)

**Files:** none expected. A fix found here is made with its own failing test, in its own commit, listing exact paths.

**Interfaces:** consumes everything from Tasks 1–11. Produces the Stage A report.

- [ ] **Step 1: Static checks**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
npx tsc -b --pretty false; echo "tsc exit=$?"          # expect exit=0
npm test 2>&1 | tail -6                                 # expect every file passed
npm run build 2>&1 | tail -5; echo "build exit=$?"      # expect exit=0
```

Then procedure L: for every file touched in Tasks 1–11, no finding that is new or higher than in `lint-baseline.txt`.

- [ ] **Step 2: Give the rig an admin**

Check which admin property the trunk reads: `grep -n '^admin\.' /Users/lmiholic/IdeaProjects/stiglja-lanes/fe-run/src/main/resources/application.properties`.
- If it is `admin.usernames`: restart the backend (R6 for the backend only, then R4) with `ADMIN_ARG="--admin.usernames=e2eadmin"`, then sign up `e2eadmin` in the SPA, then restart once more with the same `ADMIN_ARG` (the grant runs at startup for existing accounts).
- If it is `admin.user-ids` (foundation C4 merged): sign up `e2eadmin` (password `e2e-password-123`) in the SPA, then

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"e2eadmin","password":"e2e-password-123"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token))')
ADMIN_ID=$(curl -s http://localhost:8080/user/me -H "Authorization: Bearer $TOKEN" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))')
echo "$ADMIN_ID"
```

and restart the backend (R6 backend part, then R4) with `ADMIN_ARG="--admin.user-ids=$ADMIN_ID"`.

- [ ] **Step 3: Click-through against the rig** (http://localhost:5173; drive it with an ad-hoc playwright-core script from the Task 11 install, or by hand in separate browser profiles). Record PASS/FAIL for each:
  1. Sign up `e2eana` → profile shows username, ELO, level, games; **own** profile shows the email under Account Information; no XP tile, no Last Seen tile.
  2. Change Password with a wrong current password → inline "Current password is incorrect"; still logged in (navigate to /friends and back).
  3. Change Password with a 7-character new password → "Password must be at least 8 characters and at most 72 bytes", no request sent.
  4. Change Password correctly → modal closes; log out; log in with the new password succeeds and the old one fails.
  5. Another user's profile (`/profile/<their id>`) → no email, no roles, no Account/deletion card.
  6. `/users` → searching by part of a username filters correctly.
  7. "Request account deletion" → "Confirm request" → "Deletion requested" shows and persists after reload.
  8. `/admin` as `e2eana` → Access Denied, and the sidebar has no Admin Panel link; as `e2eadmin` → dashboard loads (user list shows emails) and the sidebar shows Admin Panel.
  9. `/play` → in the network log exactly one websocket under `/ws/`; the CONNECT frame carries `Authorization: Bearer …` and no `login` header; no URL with `?user=`.
  10. Signing up with username ` bob ` (spaces) succeeds as `bob`.

- [ ] **Step 4: Tear down** — procedure R6.

- [ ] **Step 5: Report Stage A** — state what was verified (static checks, harness JSON from Task 11, each click-through item) and what was **not** (each skipped item, named, with the reason). List the files and commits of Tasks 1–11.

---

# Stage B — after lane-authz merges (C1, C3 consumers)

### Task 13: Lobby requests carry no actor; 403/409 shown in the lobby UI (C1 consumer)

**Files:**
- Modify: `src/types/lobby.ts`, `src/services/lobbyService.ts`, `src/services/lobbyService.test.ts`, `src/hooks/useLobby.ts`, `src/components/lobby/CreateLobbyForm.tsx`, `src/components/lobby/JoinLobbyModal.tsx`, `src/components/lobby/LobbyDetailsPopup.tsx`, `src/components/lobby/TeamManagment.tsx`, `src/components/lobby/TeamManagement.test.tsx`, `src/components/lobby/LobbyControls.tsx`
- Test: `src/components/lobby/CreateLobbyForm.test.tsx`, `src/components/lobby/LobbyDetailsPopup.test.tsx`, `src/components/lobby/LobbyControls.test.tsx`

**Interfaces:**
- Consumes (Phase 3 spec C1 table, pinned): `POST /lobbies` `{name, privateLobby, password?}` (caller becomes host); `POST /lobbies/join` `{lobbyId, password?}` → 404 / 403 wrong or missing password / 409 full; `POST /lobbies/switchTeam` `{lobbyId, targetTeam}` with `A|B|U` → 403 not a member / 409 team full / 400 bad team; `PATCH /lobbies/{id}/kick` `{usernameToKick}` (host only) → 403 / 409 target not in lobby; `PATCH /lobbies/{id}/leave` no body → 409 host must delete / 409 not a member; `DELETE /lobbies/{id}` and `POST /lobbies/{id}/start-match` host only → 403 / 409. Every error body is `{"error": message}`; `apiClient` already surfaces it as `ApiError.message`.
- Produces: `CreateLobbyDTO {name: string; privateLobby: boolean; password: string | null}`, `JoinLobbyRequestDTO {lobbyId: string; password: string | null}`, `KickPlayerRequestDTO {usernameToKick: string}`, `LobbyTeam = 'A' | 'B' | 'U'`, `TeamSwitchRequestDTO {lobbyId: string; targetTeam: LobbyTeam}`; `LeaveLobbyRequestDTO` removed; `lobbyService.leaveLobby(lobbyId)`, `useLobbies().leaveLobby(lobbyId)`; inline `role="alert"` messages in the popup, team panel and controls.

- [ ] **Step 1: Gate G-B** — run the G-B lines of procedure G. Expected: `G-B FriendshipDto present`, `0`, `0`. Otherwise stop.

- [ ] **Step 2: Write the failing tests**

In `src/components/lobby/TeamManagement.test.tsx` replace the two expectations

```tsx
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', userId: 'u1', targetTeam: 'B' })
```

```tsx
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', userId: 'u1', targetTeam: 'U' })
```

with

```tsx
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', targetTeam: 'B' })
```

```tsx
        expect(switchTeam).toHaveBeenCalledWith('l1', { lobbyId: 'l1', targetTeam: 'U' })
```

and add this test inside the `describe`:

```tsx
    test('a refused switch shows the server message', async () => {
        const user = userEvent.setup()
        switchTeam.mockRejectedValue(new ApiError({ status: 409, message: 'Team B is full' }))
        render(<TeamManagement lobby={lobby()} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: 'Join Team B' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Team B is full')
    })
```

with `import { ApiError } from '../../services/api'` added to its imports.

In `src/services/lobbyService.test.ts` replace the switch-team and kick/leave tests with:

```ts
    test('switch team uses POST /lobbies/switchTeam with the lobby id in the body', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await lobbyService.switchTeam('l1', { lobbyId: 'l1', targetTeam: 'B' })
        expect(post).toHaveBeenCalledWith('/lobbies/switchTeam', { lobbyId: 'l1', targetTeam: 'B' })
    })

    test('kick sends only the target; leave sends no body', async () => {
        const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
        await lobbyService.kickPlayer('l1', { usernameToKick: 'bob' })
        expect(patch).toHaveBeenCalledWith('/lobbies/l1/kick', { usernameToKick: 'bob' })
        await lobbyService.leaveLobby('l1')
        expect(patch.mock.calls[1]).toEqual(['/lobbies/l1/leave'])
    })
```

`src/components/lobby/CreateLobbyForm.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateLobbyForm } from './CreateLobbyForm'
import { useLobbies } from '../../hooks/useLobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const createLobby = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    createLobby.mockResolvedValue({})
    vi.mocked(useLobbies).mockReturnValue({ createLobby, isCreating: false } as never)
})

describe('CreateLobbyForm', () => {
    test('sends only name, privacy and password - the server makes the caller the host', async () => {
        const user = userEvent.setup()
        const onSuccess = vi.fn()
        render(<CreateLobbyForm onSuccess={onSuccess} onCancel={vi.fn()} />)
        await user.type(screen.getByLabelText('Lobby Name'), 'Friday')
        await user.click(screen.getByRole('button', { name: 'Create Lobby' }))
        expect(createLobby).toHaveBeenCalledWith({ name: 'Friday', privateLobby: false, password: null })
        expect(onSuccess).toHaveBeenCalled()
    })
})
```

`src/components/lobby/LobbyDetailsPopup.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyDetailsPopup } from './LobbyDetailsPopup'
import { useLobbies } from '../../hooks/useLobby'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const joinLobby = vi.fn()
const bob = { id: 'u2', username: 'bob' }
const privateLobby: LobbyDTO = {
    id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: bob,
    teamAPlayers: [bob], teamBPlayers: [], unassignedPlayers: [], privateLobby: true, password: null,
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useLobbies).mockReturnValue({ joinLobby, isJoining: false } as never)
})

async function joinWithPassword(password: string) {
    const user = userEvent.setup()
    render(<LobbyDetailsPopup lobby={privateLobby} isOpen onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Join Private Game' }))
    await user.type(screen.getByPlaceholderText('Game password...'), password)
    await user.click(screen.getByRole('button', { name: 'Join Game' }))
}

describe('LobbyDetailsPopup join', () => {
    test('joins with the lobby id and the password only - the caller joins themselves', async () => {
        joinLobby.mockResolvedValue({})
        await joinWithPassword('pw-1')
        expect(joinLobby).toHaveBeenCalledWith('l1', { lobbyId: 'l1', password: 'pw-1' })
    })

    test('a refused join shows the server message', async () => {
        joinLobby.mockRejectedValue(new ApiError({ status: 403, message: 'Invalid lobby password' }))
        await joinWithPassword('wrong')
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid lobby password')
    })
})
```

`src/components/lobby/LobbyControls.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyControls } from './LobbyControls'
import { useLobbies, useLobby } from '../../hooks/useLobby'
import { ApiError } from '../../services/api'
import type { LobbyDTO } from '../../types/lobby'

vi.mock('../../hooks/useLobby', () => ({ useLobbies: vi.fn(), useLobby: vi.fn() }))

const ana = { id: 'u1', username: 'ana' }
const bob = { id: 'u2', username: 'bob' }
const leaveLobby = vi.fn()
const kickPlayer = vi.fn()

function lobby(host: { id: string; username: string }): LobbyDTO {
    return {
        id: 'l1', name: 'Friday', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: host,
        teamAPlayers: [ana, bob], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(useLobbies).mockReturnValue({ leaveLobby, kickPlayer, isLeaving: false, isKicking: false } as never)
    vi.mocked(useLobby).mockReturnValue({ deleteLobby: vi.fn(), isDeleting: false } as never)
})

describe('LobbyControls', () => {
    test('leaving sends only the lobby id', async () => {
        leaveLobby.mockRejectedValue(new ApiError({ status: 409, message: 'Lobby host must delete the lobby instead of leaving.' }))
        render(<LobbyControls lobby={lobby(bob)} currentUser={ana} onUpdate={vi.fn()} />)
        await userEvent.setup().click(screen.getByRole('button', { name: /leave lobby/i }))
        expect(leaveLobby).toHaveBeenCalledWith('l1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Lobby host must delete the lobby instead of leaving.')
    })

    test('the host kicks by username only; a refusal is shown', async () => {
        const user = userEvent.setup()
        kickPlayer.mockRejectedValue(new ApiError({ status: 403, message: 'Only the lobby host can kick players.' }))
        render(<LobbyControls lobby={lobby(ana)} currentUser={ana} onUpdate={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: /kick player/i }))
        // Select renders its label without htmlFor, so query the only <select> on screen
        await user.selectOptions(screen.getByRole('combobox'), 'u2')
        await user.click(screen.getAllByRole('button', { name: /kick player/i }).at(-1)!)
        expect(kickPlayer).toHaveBeenCalledWith('l1', { usernameToKick: 'bob' })
        expect(await screen.findByRole('alert')).toHaveTextContent('Only the lobby host can kick players.')
    })
})
```


- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/components/lobby src/services/lobbyService.test.ts`
Expected: FAIL — bodies still carry `userId` / `requesterUsername` / `hostUser` / `id, username`; no alerts are rendered (errors only go to `console.error`).

- [ ] **Step 4: Replace the request types in `src/types/lobby.ts`** — keep `LobbyDTO` and `LobbyUpdateDTO` exactly; replace `CreateLobbyDTO`, `JoinLobbyRequestDTO`, `LeaveLobbyRequestDTO`, `KickPlayerRequestDTO` and `TeamSwitchRequestDTO` with:

```ts
/** POST /lobbies. The caller becomes the host; the server ignores any host field. */
export interface CreateLobbyDTO {
    name: string;
    privateLobby: boolean;
    password: string | null;
}

/** POST /lobbies/join. The caller joins themselves. */
export interface JoinLobbyRequestDTO {
    lobbyId: string;
    password: string | null;
}

/** PATCH /lobbies/{lobbyId}/kick, host only. */
export interface KickPlayerRequestDTO {
    usernameToKick: string;
}

/** A = team A, B = team B, U = unassigned (the backend's codes). */
export type LobbyTeam = 'A' | 'B' | 'U';

/** POST /lobbies/switchTeam. The caller moves themselves. */
export interface TeamSwitchRequestDTO {
    lobbyId: string;
    targetTeam: LobbyTeam;
}
```

(`LeaveLobbyRequestDTO` is gone: `PATCH /lobbies/{id}/leave` takes no body.)

- [ ] **Step 5: `src/services/lobbyService.ts`** — remove `LeaveLobbyRequestDTO,` from the type import list, and replace

```ts
    async leaveLobby(lobbyId: string, leaveData?: LeaveLobbyRequestDTO): Promise<Void> {
        return apiClient.patch<Void>(`/lobbies/${lobbyId}/leave`, leaveData);
    },
```

with

```ts
    async leaveLobby(lobbyId: string): Promise<Void> {
        return apiClient.patch<Void>(`/lobbies/${lobbyId}/leave`);
    },
```

- [ ] **Step 6: `src/hooks/useLobby.ts`** — remove `LeaveLobbyRequestDTO,` from the type import list; replace

```ts
    const leaveMutation = useMutation((data: { lobbyId: string; leaveData?: LeaveLobbyRequestDTO }) =>
        lobbyService.leaveLobby(data.lobbyId, data.leaveData)
    );
```

with

```ts
    const leaveMutation = useMutation((lobbyId: string) =>
        lobbyService.leaveLobby(lobbyId)
    );
```

and replace

```ts
    const leaveLobby = useCallback(async (lobbyId: string, leaveData?: LeaveLobbyRequestDTO) => {
        const result = await leaveMutation.mutate({ lobbyId, leaveData });
```

with

```ts
    const leaveLobby = useCallback(async (lobbyId: string) => {
        const result = await leaveMutation.mutate(lobbyId);
```

- [ ] **Step 7: `src/components/lobby/CreateLobbyForm.tsx`**

7a. Replace

```tsx
import { useAuth } from '../../hooks/useAuth';
import type { LobbyDTO } from '../../types/lobby';
```

with

```tsx
import type { CreateLobbyDTO } from '../../types/lobby';
```

7b. Delete the line `    const { user } = useAuth();`

7c. Replace

```tsx
            const lobbyData: LobbyDTO = {
                id: null,
                name: formData.name.trim(),
                gameMode: formData.gameMode,
                status: 'WAITING',
                createdAt: new Date().toISOString(),
                hostUser: user,
                teamAPlayers: [],
                teamBPlayers: [],
                unassignedPlayers: [],
                privateLobby: formData.privateLobby,
                password: formData.privateLobby ? formData.password : null
            };
```

with

```tsx
            // The caller becomes the host server-side; the server also fixes the mode to CASUAL.
            const lobbyData: CreateLobbyDTO = {
                name: formData.name.trim(),
                privateLobby: formData.privateLobby,
                password: formData.privateLobby ? formData.password : null
            };
```

(The Game Mode select stays on screen unchanged; the backend ignores the mode and creates CASUAL lobbies — flagged in the report, not changed here.)

- [ ] **Step 8: `src/components/lobby/JoinLobbyModal.tsx`** (unused, kept compiling) — replace

```tsx
            const joinData: JoinLobbyRequestDTO = {
                lobbyId: lobby.id,          // must be included
                userId: user.id,
                password: isPrivate ? password : null,
            };
```

with

```tsx
            const joinData: JoinLobbyRequestDTO = {
                lobbyId: lobby.id,
                password: isPrivate ? password : null,
            };
```

- [ ] **Step 9: `src/components/lobby/LobbyDetailsPopup.tsx`**

9a. Replace `    const [showPasswordInput, setShowPasswordInput] = useState(false);` with

```tsx
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
```

9b. Replace

```tsx
        try {
            await joinLobby(lobby.id, {
                lobbyId: lobby.id,
                userId: user.id,
                password: lobby.privateLobby ? password : null
            });
            onJoinSuccess?.();
            onClose();
        } catch (error) {
            console.error('Failed to join lobby:', error);
```

with

```tsx
        try {
            setJoinError(null);
            await joinLobby(lobby.id, {
                lobbyId: lobby.id,
                password: lobby.privateLobby ? password : null
            });
            onJoinSuccess?.();
            onClose();
        } catch (error) {
            console.error('Failed to join lobby:', error);
            setJoinError(error instanceof Error ? error.message : 'Failed to join lobby');
```

9c. Replace

```tsx
                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        onClick={onClose}
```

with

```tsx
                {joinError && (
                    <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                        {joinError}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        onClick={onClose}
```

- [ ] **Step 10: `src/components/lobby/TeamManagment.tsx`**

10a. Replace

```tsx
import type { LobbyDTO } from '../../types/lobby';
```

with

```tsx
import type { LobbyDTO, LobbyTeam } from '../../types/lobby';
```

10b. Replace

```tsx
    const { switchTeam, isSwitchingTeam } = useLobbies();

    const handleSwitchTeam = async (targetTeam: string) => {
        if (!currentUser?.id || !lobby.id) return;

        try {
            await switchTeam(lobby.id, {
                lobbyId: lobby.id,
                userId: currentUser.id,
                targetTeam
            });
            onUpdate();
        } catch (error) {
            console.error('Failed to switch team:', error);
        }
    };
```

with

```tsx
    const { switchTeam, isSwitchingTeam } = useLobbies();
    const [switchError, setSwitchError] = useState<string | null>(null);

    const handleSwitchTeam = async (targetTeam: LobbyTeam) => {
        if (!currentUser?.id || !lobby.id) return;

        try {
            setSwitchError(null);
            await switchTeam(lobby.id, {
                lobbyId: lobby.id,
                targetTeam
            });
            onUpdate();
        } catch (error) {
            console.error('Failed to switch team:', error);
            setSwitchError(error instanceof Error ? error.message : 'Failed to switch team');
        }
    };
```

10c. Replace `import React from 'react';` with `import React, { useState } from 'react';`

10d. Replace

```tsx
            <h3 className="text-lg font-semibold text-white mb-4">Team Management</h3>
```

with

```tsx
            <h3 className="text-lg font-semibold text-white mb-4">Team Management</h3>

            {switchError && (
                <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30 mb-4">
                    {switchError}
                </div>
            )}
```

- [ ] **Step 11: `src/components/lobby/LobbyControls.tsx`**

11a. Replace

```tsx
import type { LobbyDTO, LeaveLobbyRequestDTO, KickPlayerRequestDTO } from '../../types/lobby';
```

with

```tsx
import type { LobbyDTO, KickPlayerRequestDTO } from '../../types/lobby';
```

11b. Replace

```tsx
    const [playerToKick, setPlayerToKick] = useState('');
```

with

```tsx
    const [playerToKick, setPlayerToKick] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
```

11c. Replace

```tsx
        try {
            const leaveData: LeaveLobbyRequestDTO = {
                id: lobby.id,
                username: currentUser.username
            };

            await leaveLobby(lobby.id, leaveData);

            // Navigate back to lobby list
            window.location.href = '/lobbies';
        } catch (error) {
            console.error('Failed to leave lobby:', error);
        }
```

with

```tsx
        try {
            setActionError(null);
            await leaveLobby(lobby.id);

            // Navigate back to lobby list
            window.location.href = '/lobbies';
        } catch (error) {
            console.error('Failed to leave lobby:', error);
            setActionError(error instanceof Error ? error.message : 'Failed to leave lobby');
        }
```

11d. Replace

```tsx
        try {
            const kickData: KickPlayerRequestDTO = {
                lobbyId: lobby.id,
                usernameToKick: playerName || '',
                requesterUsername: currentUser.username
            };

            await kickPlayer(lobby.id, kickData);
            setShowKickModal(false);
            setPlayerToKick('');
            onUpdate();
        } catch (error) {
            console.error('Failed to kick player:', error);
        }
```

with

```tsx
        try {
            setActionError(null);
            const kickData: KickPlayerRequestDTO = {
                usernameToKick: playerName || ''
            };

            await kickPlayer(lobby.id, kickData);
            setShowKickModal(false);
            setPlayerToKick('');
            onUpdate();
        } catch (error) {
            console.error('Failed to kick player:', error);
            setShowKickModal(false);
            setActionError(error instanceof Error ? error.message : 'Failed to kick player');
        }
```

11e. Replace

```tsx
        try {
            await deleteLobby();
            // Navigate back to lobby list
            window.location.href = '/lobbies';
        } catch (error) {
            console.error('Failed to delete lobby:', error);
        }
```

with

```tsx
        try {
            setActionError(null);
            await deleteLobby();
            // Navigate back to lobby list
            window.location.href = '/lobbies';
        } catch (error) {
            console.error('Failed to delete lobby:', error);
            setActionError(error instanceof Error ? error.message : 'Failed to delete lobby');
        }
```

11f. Replace

```tsx
            <h3 className="text-lg font-semibold text-white mb-4">Lobby Controls</h3>
```

with

```tsx
            <h3 className="text-lg font-semibold text-white mb-4">Lobby Controls</h3>

            {actionError && (
                <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30 mb-4">
                    {actionError}
                </div>
            )}
```

- [ ] **Step 12: Run the tests and the suite** — `npx vitest run src/components/lobby src/services/lobbyService.test.ts` all pass; `npm test` all pass.

- [ ] **Step 13: Gates** — `npx tsc -b --pretty false; echo "exit=$?"` → `exit=0`; procedure L.

- [ ] **Step 14: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/types/lobby.ts src/services/lobbyService.ts src/services/lobbyService.test.ts src/hooks/useLobby.ts src/components/lobby/CreateLobbyForm.tsx src/components/lobby/CreateLobbyForm.test.tsx src/components/lobby/JoinLobbyModal.tsx src/components/lobby/LobbyDetailsPopup.tsx src/components/lobby/LobbyDetailsPopup.test.tsx src/components/lobby/TeamManagment.tsx src/components/lobby/TeamManagement.test.tsx src/components/lobby/LobbyControls.tsx src/components/lobby/LobbyControls.test.tsx
git commit -m "feat(lobby): requests carry no actor; show 403/409 refusals inline

Create, join, switch team, kick and leave send only what the server needs:
the actor is now the JWT principal. Refusals (wrong password, full team,
not the host, host may not leave) are shown where they happen.

Consumes Meawen/stiglja lane-authz C1." -- src/types/lobby.ts src/services/lobbyService.ts src/services/lobbyService.test.ts src/hooks/useLobby.ts src/components/lobby/CreateLobbyForm.tsx src/components/lobby/CreateLobbyForm.test.tsx src/components/lobby/JoinLobbyModal.tsx src/components/lobby/LobbyDetailsPopup.tsx src/components/lobby/LobbyDetailsPopup.test.tsx src/components/lobby/TeamManagment.tsx src/components/lobby/TeamManagement.test.tsx src/components/lobby/LobbyControls.tsx src/components/lobby/LobbyControls.test.tsx
git show --stat HEAD
```

---

### Task 14: Friend requests carry only the recipient; refusals are shown (C1/C3 consumer)

**Read-scoping check (C1, no code change needed):** every friendship read in the SPA uses the caller's own id — `FriendList` and `UserCard` call `useFriends(currentUser.id)` → `GET /friendship/getAllByUserId/{own id}`; `useAllFriendships`/`useFriendship` have no callers. So the new 403 for other users' ids is never hit. C3's `FriendshipDto {id, fromUser, toUser, status, createdAt}` with `UserSummaryDto` parties matches the existing `Friendship` type (`fromUser`/`toUser: User`, and `User` is already the `UserSummaryDto` shape), so reads need no change either.

**Files:**
- Modify: `src/types/friendship.ts`, `src/components/profile/UserCard.tsx`, `src/components/profile/FriendList.tsx`
- Test: `src/components/profile/UserCard.test.tsx`, `src/components/profile/FriendList.test.tsx`

**Interfaces:**
- Consumes (C1 table, pinned): `POST /friendship` `{toUserId}`, caller is the sender; accept/reject recipient only, cancel sender only, delete either party, else 403 `{"error": …}`.
- Produces: `CreateFriendshipDTO {toUserId: string}`; inline `role="alert"` in `UserCard` and `FriendList`.

- [ ] **Step 1: Gate G-B** — as in Task 13 Step 1 (skip if Task 13 ran in the same session).

- [ ] **Step 2: Write the failing tests**

`src/components/profile/UserCard.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserCard } from './UserCard'
import { useFriends } from '../../hooks/useFriends'
import { ApiError } from '../../services/api'

vi.mock('../../hooks/useFriends', () => ({ useFriends: vi.fn() }))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const sendFriendRequest = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFriends).mockReturnValue({
        friendships: [], sendFriendRequest, acceptFriendRequest: vi.fn(), rejectFriendRequest: vi.fn(),
        cancelFriendRequest: vi.fn(), removeFriend: vi.fn(), isSending: false, isAccepting: false,
        isRejecting: false, isCanceling: false, isRemoving: false,
    } as never)
})

describe('UserCard friend request', () => {
    test('sends only the recipient - the sender is the signed-in user', async () => {
        sendFriendRequest.mockResolvedValue({})
        render(<UserCard user={bob} currentUser={ana} onUpdate={vi.fn()} />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add Friend' }))
        expect(sendFriendRequest).toHaveBeenCalledWith({ toUserId: 'u2' })
    })

    test('a refusal is shown', async () => {
        sendFriendRequest.mockRejectedValue(new ApiError({ status: 403, message: 'Not allowed' }))
        render(<UserCard user={bob} currentUser={ana} onUpdate={vi.fn()} />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Add Friend' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    })
})
```

`src/components/profile/FriendList.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FriendsList } from './FriendList'
import { useFriends } from '../../hooks/useFriends'
import { ApiError } from '../../services/api'

vi.mock('../../hooks/useFriends', () => ({ useFriends: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' } }) }))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const acceptFriendRequest = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFriends).mockReturnValue({
        friendships: [{ id: 'f1', fromUser: bob, toUser: ana, status: 'PENDING', createdAt: null }],
        isLoading: false, error: null, acceptFriendRequest, rejectFriendRequest: vi.fn(),
        cancelFriendRequest: vi.fn(), removeFriend: vi.fn(), refetch: vi.fn(),
        isAccepting: false, isRejecting: false, isCanceling: false, isRemoving: false,
    } as never)
})

describe('FriendsList actions', () => {
    test('a refused accept is shown', async () => {
        const user = userEvent.setup()
        acceptFriendRequest.mockRejectedValue(new ApiError({ status: 403, message: 'Only the recipient may accept' }))
        render(<FriendsList />)
        await user.click(screen.getByRole('button', { name: /requests \(1\)/i }))
        await user.click(screen.getByRole('button', { name: 'Accept' }))
        expect(acceptFriendRequest).toHaveBeenCalledWith('f1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Only the recipient may accept')
    })
})
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/components/profile/UserCard.test.tsx src/components/profile/FriendList.test.tsx`
Expected: FAIL — `UserCard` sends `{fromUserId, toUserId, status}`; neither component renders an alert.

- [ ] **Step 4: `src/types/friendship.ts`** — replace

```ts
export interface CreateFriendshipDTO {
    fromUserId: string | null;
    toUserId: string | null;
    status: FriendshipStatus | null;
}
```

with

```ts
/** POST /friendship. The caller is the sender. */
export interface CreateFriendshipDTO {
    toUserId: string;
}
```

- [ ] **Step 5: `src/components/profile/UserCard.tsx`**

5a. Replace `import React, { useMemo, useCallback } from 'react';` with `import React, { useMemo, useCallback, useState } from 'react';`

5b. Replace

```tsx
    } = useFriends(currentUser?.id || undefined);
```

with

```tsx
    } = useFriends(currentUser?.id || undefined);
    const [actionError, setActionError] = useState<string | null>(null);
    const reportError = useCallback((error: unknown, fallback: string) => {
        setActionError(error instanceof Error ? error.message : fallback);
    }, []);
```

5c. Replace

```tsx
        try {
            await sendFriendRequest({
                fromUserId: currentUser.id,
                toUserId: user.id,
                status: 'PENDING'
            });
            onUpdate();
        } catch (error) {
            console.error('Failed to send friend request:', error);
        }
    }, [currentUser?.id, user.id, sendFriendRequest, onUpdate]);
```

with

```tsx
        try {
            setActionError(null);
            await sendFriendRequest({ toUserId: user.id });
            onUpdate();
        } catch (error) {
            console.error('Failed to send friend request:', error);
            reportError(error, 'Failed to send friend request');
        }
    }, [currentUser?.id, user.id, sendFriendRequest, onUpdate, reportError]);
```

5d. Report the other four failures too. Replace

```tsx
        } catch (error) {
            console.error('Failed to accept friend request:', error);
        }
    }, [friendshipStatus.friendship?.id, acceptFriendRequest, onUpdate]);
```

with

```tsx
        } catch (error) {
            console.error('Failed to accept friend request:', error);
            reportError(error, 'Failed to accept friend request');
        }
    }, [friendshipStatus.friendship?.id, acceptFriendRequest, onUpdate, reportError]);
```

replace

```tsx
        } catch (error) {
            console.error('Failed to reject friend request:', error);
        }
    }, [friendshipStatus.friendship?.id, rejectFriendRequest, onUpdate]);
```

with

```tsx
        } catch (error) {
            console.error('Failed to reject friend request:', error);
            reportError(error, 'Failed to reject friend request');
        }
    }, [friendshipStatus.friendship?.id, rejectFriendRequest, onUpdate, reportError]);
```

replace

```tsx
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
        }
    }, [friendshipStatus.friendship?.id, cancelFriendRequest, onUpdate]);
```

with

```tsx
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
            reportError(error, 'Failed to cancel friend request');
        }
    }, [friendshipStatus.friendship?.id, cancelFriendRequest, onUpdate, reportError]);
```

and replace

```tsx
        } catch (error) {
            console.error('Failed to remove friend:', error);
        }
    }, [friendshipStatus.friendship?.id, user.username, removeFriend, onUpdate]);
```

with

```tsx
        } catch (error) {
            console.error('Failed to remove friend:', error);
            reportError(error, 'Failed to remove friend');
        }
    }, [friendshipStatus.friendship?.id, user.username, removeFriend, onUpdate, reportError]);
```

5e. Replace

```tsx
                ) : null}
            </div>
        </div>
    );
});
```

with

```tsx
                ) : null}
            </div>

            {actionError && (
                <p role="alert" className="text-red-400 text-sm mt-2">{actionError}</p>
            )}
        </div>
    );
});
```

- [ ] **Step 6: `src/components/profile/FriendList.tsx`**

6a. Replace

```tsx
    const [searchTerm, setSearchTerm] = useState('');
```

with

```tsx
    const [searchTerm, setSearchTerm] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
```

6b. Replace the four handlers

```tsx
    const handleAccept = useCallback(async (friendshipId: string) => {
        try {
            await acceptFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to accept friend request:', error);
        }
    }, [acceptFriendRequest]);

    const handleReject = useCallback(async (friendshipId: string) => {
        try {
            await rejectFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to reject friend request:', error);
        }
    }, [rejectFriendRequest]);

    const handleCancel = useCallback(async (friendshipId: string) => {
        try {
            await cancelFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
        }
    }, [cancelFriendRequest]);
```

with

```tsx
    const handleAccept = useCallback(async (friendshipId: string) => {
        try {
            setActionError(null);
            await acceptFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to accept friend request:', error);
            setActionError(error instanceof Error ? error.message : 'Failed to accept friend request');
        }
    }, [acceptFriendRequest]);

    const handleReject = useCallback(async (friendshipId: string) => {
        try {
            setActionError(null);
            await rejectFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to reject friend request:', error);
            setActionError(error instanceof Error ? error.message : 'Failed to reject friend request');
        }
    }, [rejectFriendRequest]);

    const handleCancel = useCallback(async (friendshipId: string) => {
        try {
            setActionError(null);
            await cancelFriendRequest(friendshipId);
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
            setActionError(error instanceof Error ? error.message : 'Failed to cancel friend request');
        }
    }, [cancelFriendRequest]);
```

and in `handleRemove` replace

```tsx
        try {
            await removeFriend(friendshipId);
        } catch (error) {
            console.error('Failed to remove friend:', error);
        }
```

with

```tsx
        try {
            setActionError(null);
            await removeFriend(friendshipId);
        } catch (error) {
            console.error('Failed to remove friend:', error);
            setActionError(error instanceof Error ? error.message : 'Failed to remove friend');
        }
```

6c. Replace

```tsx
            {/* Search */}
            <div className="card">
                <Input
                    type="text"
                    placeholder="Search friends..."
```

with

```tsx
            {actionError && (
                <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {actionError}
                </div>
            )}

            {/* Search */}
            <div className="card">
                <Input
                    type="text"
                    placeholder="Search friends..."
```

- [ ] **Step 7: Run the tests and the suite** — both files pass; `npm test` all pass.

- [ ] **Step 8: Gates** — `npx tsc -b` exit 0; procedure L.

- [ ] **Step 9: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/types/friendship.ts src/components/profile/UserCard.tsx src/components/profile/UserCard.test.tsx src/components/profile/FriendList.tsx src/components/profile/FriendList.test.tsx
git commit -m "feat(friends): a friend request names only the recipient; show refusals

The sender is the JWT principal now; accept/reject/cancel/delete answer 403
to anyone but the right party, and that message is shown. Friendship reads
already use the caller's own id, and FriendshipDto matches the existing type.

Consumes Meawen/stiglja lane-authz C1 and C3." -- src/types/friendship.ts src/components/profile/UserCard.tsx src/components/profile/UserCard.test.tsx src/components/profile/FriendList.tsx src/components/profile/FriendList.test.tsx
git show --stat HEAD
```

---
# Stage C — after lane-email merges (D8)

All new routes are pinned by the Phase 4 spec §3. Two facts from the foundation/email planners shape this stage: (1) after lane-email, a request with a **present but invalid, revoked or stale** bearer token gets **401** with `WWW-Authenticate: Bearer error="invalid_token"` (an anonymous call stays 403) — so the SPA must never read 403 as "logged out", and a 401 that names the token must end the local session even on calls that keep the token on a wrong-password 401; (2) the 202 routes return no body.

### Task 15: D8 plumbing — types, `apiClient` (empty 202s, invalid-token 401s), auth and user services, rotated token on password change

**Files:**
- Modify: `src/types/user.ts`, `src/services/api.ts`, `src/services/api.test.ts`, `src/services/authService.ts`, `src/services/userService.ts`, `src/services/userService.test.ts`, `src/components/profile/ChangePasswordForm.tsx`, `src/components/profile/ChangePasswordForm.test.tsx`
- Test: `src/services/authService.test.ts`

**Interfaces:**
- Consumes (spec §3, pinned): `POST /api/auth/confirm-email {token}` → 204 | 400 `{"error":"This link is invalid or has expired"}` | 409 `{"error":"That email address is already in use"}` | 429; `POST /api/auth/forgot-password {email}` → always 202 | 400 | 429; `POST /api/auth/reset-password {token, newPassword}` → 204 (every session ends) | 400 (bad link, or field map) | 429; `POST /user/me/email {newEmail, currentPassword}` → 202 | 401 wrong password | 400 | 429; `POST /user/me/email/resend` → 202 | 409 `{"error":"Nothing to confirm"}` | 429; `POST /user/me/password` → **200 `JwtResponseDTO {token, user}`** (was 204); `GET /user/me` adds `pendingEmail` (nullable) and `emailVerified`; `email` may be null.
- Produces:
  - `UserDto` gains `pendingEmail: string | null; emailVerified: boolean`; new `ChangeEmailRequest { newEmail: string; currentPassword: string }`.
  - `ApiError` gains `invalidToken: boolean` (true for a 401 whose `WWW-Authenticate` contains `invalid_token`); such a 401 always clears the stored token.
  - `authService.confirmEmail(token: string): Promise<void>`, `authService.forgotPassword(email: string): Promise<void>`, `authService.resetPassword(token: string, newPassword: string): Promise<void>` (also clears the local session).
  - `userService.changePassword(req)` stores the returned token and calls `gameSocket.reconnect()`; `userService.changeEmail(req: ChangeEmailRequest): Promise<void>`; `userService.resendEmailConfirmation(): Promise<void>`.

- [ ] **Step 1: Gate G-C** — run the G-C lines of procedure G. Expected `2` and `3`. Otherwise stop.

- [ ] **Step 2: Write the failing tests**

In `src/services/api.test.ts`, inside `describe('apiClient error handling', ...)`, add:

```ts
    test('an empty 202 resolves to an empty object', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 202,
            statusText: 'Accepted',
            headers: { get: () => null },
            text: () => Promise.resolve(''),
            json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
        } as unknown as Response))
        await expect(apiClient.post('/api/auth/forgot-password', { email: 'ana@example.com' })).resolves.toEqual({})
    })

    test('a 401 that names the token ends the session even when the caller keeps the token on 401', async () => {
        const response = {
            ...fakeResponse(401, { error: 'Invalid or expired token' }),
            headers: { get: (name: string) => (name === 'WWW-Authenticate' ? 'Bearer error="invalid_token"' : null) },
        } as unknown as Response
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
        await expect(apiClient.post('/user/me/password', {}, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, invalidToken: true })
        expect(localStorage.getItem('authToken')).toBeNull()
    })
```

Create `src/services/authService.test.ts`:

```ts
import { describe, test, expect, vi, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { apiClient } from './api'
import { authService } from './authService'

const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    jsdomStorage.clear()
})

describe('authService email routes', () => {
    test('confirmEmail posts the token from the link', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.confirmEmail('tok-1')
        expect(post).toHaveBeenCalledWith('/api/auth/confirm-email', { token: 'tok-1' })
    })

    test('forgotPassword posts the address', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.forgotPassword('ana@example.com')
        expect(post).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'ana@example.com' })
    })

    test('resetPassword posts token and new password, then forgets the local session', async () => {
        vi.stubGlobal('localStorage', jsdomStorage)
        jsdomStorage.setItem('authToken', 'old-token')
        jsdomStorage.setItem('user', '{"id":"u1","username":"ana"}')
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await authService.resetPassword('tok-2', 'brand-new-pass')
        expect(post).toHaveBeenCalledWith('/api/auth/reset-password', { token: 'tok-2', newPassword: 'brand-new-pass' })
        expect(jsdomStorage.getItem('authToken')).toBeNull()
        expect(jsdomStorage.getItem('user')).toBeNull()
    })
})
```

In `src/services/userService.test.ts`:

(a) add, directly below the existing imports,

```ts
import { gameSocket } from './gameSocket'

vi.mock('./gameSocket', () => ({ gameSocket: { reconnect: vi.fn() } }))
```

(b) replace the test `'changePassword posts to /user/me/password and keeps the token on 401'` with:

```ts
    test('changePassword posts to /user/me/password and keeps the token on a wrong-password 401', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.changePassword({ currentPassword: 'old', newPassword: 'newpass1' })
        expect(post).toHaveBeenCalledWith(
            '/user/me/password',
            { currentPassword: 'old', newPassword: 'newpass1' },
            { keepTokenOn401: true },
        )
    })

    test('changePassword stores the rotated token and reopens the socket with it', async () => {
        vi.spyOn(apiClient, 'post').mockResolvedValue({ token: 'new-token', user: { id: 'u1', username: 'ana' } })
        const setToken = vi.spyOn(apiClient, 'setToken').mockImplementation(() => undefined)
        await userService.changePassword({ currentPassword: 'old', newPassword: 'newpass1' })
        expect(setToken).toHaveBeenCalledWith('new-token')
        expect(gameSocket.reconnect).toHaveBeenCalledTimes(1)
    })

    test('changeEmail posts the new address and keeps the token on a wrong-password 401', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.changeEmail({ newEmail: 'new@example.com', currentPassword: 'old' })
        expect(post).toHaveBeenCalledWith('/user/me/email', { newEmail: 'new@example.com', currentPassword: 'old' }, { keepTokenOn401: true })
    })

    test('resendEmailConfirmation posts to /user/me/email/resend', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.resendEmailConfirmation()
        expect(post).toHaveBeenCalledWith('/user/me/email/resend')
    })
```

In `src/components/profile/ChangePasswordForm.test.tsx` add inside the `describe`:

```tsx
    test('a 401 for a dead session shows the server message, not "incorrect password"', async () => {
        const user = userEvent.setup()
        changePassword.mockRejectedValue(new ApiError({ message: 'Invalid or expired token', status: 401, invalidToken: true }))
        setup()
        await user.type(screen.getByLabelText(/current password/i), 'whatever-1')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret-1')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret-1')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(await screen.findByText('Invalid or expired token')).toBeInTheDocument()
        expect(screen.queryByText('Current password is incorrect')).not.toBeInTheDocument()
    })
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/services src/components/profile/ChangePasswordForm.test.tsx`
Expected: FAIL — the empty 202 rejects (`response.json()` on an empty body); the invalid-token 401 keeps the token and has no `invalidToken`; `authService.confirmEmail` etc. are not functions; `changePassword` never stores a token; `changeEmail`/`resendEmailConfirmation` missing; ChangePasswordForm says "Current password is incorrect".

- [ ] **Step 4: `src/types/user.ts`** — replace

```ts
export interface UserDto {
    id: string | null;
    username: string | null;
    email: string | null;
    roles: Role[] | null;
    deletionRequested: boolean | null;
}
```

with

```ts
export interface UserDto {
    id: string | null;
    username: string | null;
    /** The confirmed (or legacy, unconfirmed) address; null when the account has none. */
    email: string | null;
    /** An address waiting for its confirmation link (signup or change of address). */
    pendingEmail: string | null;
    emailVerified: boolean;
    roles: Role[] | null;
    deletionRequested: boolean | null;
}

export interface ChangeEmailRequest {
    newEmail: string;
    currentPassword: string;
}
```

- [ ] **Step 5: `src/services/api.ts`**

5a. Replace

```ts
                // If it's a 401, clear the token as it might be expired
                if (response.status === 401 && !behavior.keepTokenOn401) {
                    this.clearToken();
                }

                throw new ApiError({
                    message: errorData.message || errorData.error || firstFieldMessage(errorData) || `HTTP ${response.status}: ${response.statusText}`,
                    status: response.status,
                });
```

with

```ts
                // A 401 that names the token itself (revoked, stale after a password
                // change in another tab, expired) ends the session even on calls that
                // keep the token on a wrong-password 401. An anonymous call is a 403,
                // never "logged out".
                const invalidToken = response.status === 401
                    && (response.headers.get('WWW-Authenticate') ?? '').includes('invalid_token');

                // If it's a 401, clear the token as it might be expired
                if (response.status === 401 && (!behavior.keepTokenOn401 || invalidToken)) {
                    this.clearToken();
                }

                throw new ApiError({
                    message: errorData.message || errorData.error || firstFieldMessage(errorData) || `HTTP ${response.status}: ${response.statusText}`,
                    status: response.status,
                    invalidToken,
                });
```

5b. Replace

```ts
            const data = await response.json();
```

with

```ts
            // 202 Accepted (the email routes) carries no body; do not depend on Content-Length.
            const text = await response.text();
            const data = text ? JSON.parse(text) : {};
```

5c. Replace

```ts
export class ApiError extends Error {
    status: number;

    constructor({ message, status }: { message: string; status?: number }) {
        super(message);
        this.name = 'ApiError';
        this.status = status || 0;
    }
}
```

with

```ts
export class ApiError extends Error {
    status: number;
    /** A 401 caused by the token itself (WWW-Authenticate: Bearer error="invalid_token"). */
    invalidToken: boolean;

    constructor({ message, status, invalidToken }: { message: string; status?: number; invalidToken?: boolean }) {
        super(message);
        this.name = 'ApiError';
        this.status = status || 0;
        this.invalidToken = invalidToken ?? false;
    }
}
```

- [ ] **Step 6: `src/services/authService.ts`** — replace

```ts
    // Helper method to check if user is authenticated
    isAuthenticated(): boolean {
```

with

```ts
    async confirmEmail(token: string): Promise<void> {
        await apiClient.post<void>('/api/auth/confirm-email', { token });
    },

    async forgotPassword(email: string): Promise<void> {
        await apiClient.post<void>('/api/auth/forgot-password', { email });
    },

    // A reset ends every session of the account, this browser's included.
    async resetPassword(token: string, newPassword: string): Promise<void> {
        await apiClient.post<void>('/api/auth/reset-password', { token, newPassword });
        apiClient.clearToken();
        localStorage.removeItem('user');
    },

    // Helper method to check if user is authenticated
    isAuthenticated(): boolean {
```

- [ ] **Step 7: `src/services/userService.ts`**

7a. Replace

```ts
import { apiClient } from './api';
import type {
    User,
    UserDto,
    ChangePasswordRequest,
```

with

```ts
import { apiClient } from './api';
import { gameSocket } from './gameSocket';
import type {
    User,
    UserDto,
    ChangePasswordRequest,
    ChangeEmailRequest,
    JwtResponseDTO,
```

7b. Replace

```ts
    async changePassword(request: ChangePasswordRequest): Promise<void> {
        await apiClient.post<void>('/user/me/password', request, { keepTokenOn401: true });
    },
```

with

```ts
    // 200 with a fresh token: the server ended every other session (and closes their
    // sockets); this tab continues on the new token, so store it and reopen the socket.
    async changePassword(request: ChangePasswordRequest): Promise<void> {
        const response = await apiClient.post<JwtResponseDTO>('/user/me/password', request, { keepTokenOn401: true });
        if (response?.token) {
            apiClient.setToken(response.token);
            gameSocket.reconnect();
        }
    },

    async changeEmail(request: ChangeEmailRequest): Promise<void> {
        await apiClient.post<void>('/user/me/email', request, { keepTokenOn401: true });
    },

    async resendEmailConfirmation(): Promise<void> {
        await apiClient.post<void>('/user/me/email/resend');
    },
```

- [ ] **Step 8: `src/components/profile/ChangePasswordForm.tsx`** — replace

```tsx
            if (error instanceof ApiError && error.status === 401) {
```

with

```tsx
            if (error instanceof ApiError && error.status === 401 && !error.invalidToken) {
```

- [ ] **Step 9: Run the tests and the suite** — `npx vitest run src/services src/components/profile/ChangePasswordForm.test.tsx` all pass; `npm test` all pass.

- [ ] **Step 10: Gates** — `npx tsc -b` exit 0; procedure L.

- [ ] **Step 11: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/types/user.ts src/services/api.ts src/services/api.test.ts src/services/authService.ts src/services/authService.test.ts src/services/userService.ts src/services/userService.test.ts src/components/profile/ChangePasswordForm.tsx src/components/profile/ChangePasswordForm.test.tsx
git commit -m "feat(auth): email-flow services; keep the rotated token after a password change

Adds confirm-email, forgot-password and reset-password calls, change of
address and resend. POST /user/me/password now returns a fresh token: it is
stored and the game socket reopens with it. A 401 whose WWW-Authenticate
names the token ends the local session even where a wrong-password 401
keeps it; empty 202 bodies no longer fail the request.

Consumes Meawen/stiglja lane-email (Phase 4 spec section 3)." -- src/types/user.ts src/services/api.ts src/services/api.test.ts src/services/authService.ts src/services/authService.test.ts src/services/userService.ts src/services/userService.test.ts src/components/profile/ChangePasswordForm.tsx src/components/profile/ChangePasswordForm.test.tsx
git show --stat HEAD
```

---

### Task 16: `/confirm-email?token=` page (D8)

**Decision:** confirming takes one click instead of happening on page load. The token is single-use: React StrictMode runs mount effects twice in development, and some mail scanners execute page scripts — either would spend the token before the reader sees the page.

**Files:**
- Create: `src/components/auth/ConfirmEmailPage.tsx`, `src/components/auth/ConfirmEmailPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `authService.confirmEmail(token)`, `authService.isAuthenticated()` (Task 15).
- Produces: public route `/confirm-email` (no auth wrapper: the link is often opened while signed in); button `Confirm email address`; success text `Your email address is confirmed.` (the e2e harness waits for both).

- [ ] **Step 1: Write the failing test** — create `src/components/auth/ConfirmEmailPage.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmEmailPage } from './ConfirmEmailPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'

vi.mock('../../services/authService', () => ({
    authService: { confirmEmail: vi.fn(), isAuthenticated: vi.fn(() => true) },
}))

function renderAt(url: string) {
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes><Route path="/confirm-email" element={<ConfirmEmailPage />} /></Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => vi.clearAllMocks())

describe('ConfirmEmailPage', () => {
    test('confirms on click, not on load', async () => {
        vi.mocked(authService.confirmEmail).mockResolvedValue(undefined)
        renderAt('/confirm-email?token=tok-1')
        expect(authService.confirmEmail).not.toHaveBeenCalled()
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(authService.confirmEmail).toHaveBeenCalledWith('tok-1')
        expect(await screen.findByText('Your email address is confirmed.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/dashboard')
    })

    test('a used or expired link shows the server message', async () => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status: 400, message: 'This link is invalid or has expired' }))
        renderAt('/confirm-email?token=old')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('This link is invalid or has expired')
    })

    test('an address taken in the meantime shows the conflict', async () => {
        vi.mocked(authService.confirmEmail).mockRejectedValue(new ApiError({ status: 409, message: 'That email address is already in use' }))
        renderAt('/confirm-email?token=tok-2')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email address' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('That email address is already in use')
    })

    test('a link without a token offers nothing to click', () => {
        renderAt('/confirm-email')
        expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        expect(screen.queryByRole('button', { name: 'Confirm email address' })).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 2: Run it and watch it fail** — `npx vitest run src/components/auth/ConfirmEmailPage.test.tsx` → FAIL, module not found.

- [ ] **Step 3: Create `src/components/auth/ConfirmEmailPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../common';
import { authService } from '../../services/authService';

type Outcome = { kind: 'idle' } | { kind: 'confirmed' } | { kind: 'failed'; message: string };

/**
 * /confirm-email?token=... - the link from the confirmation mail.
 * Confirming takes a click rather than happening on load: the token is
 * single-use, and StrictMode's double effects (or a mail scanner that runs
 * scripts) would otherwise spend it before the reader sees the page.
 */
export const ConfirmEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const signedIn = authService.isAuthenticated();

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await authService.confirmEmail(token);
            setOutcome({ kind: 'confirmed' });
        } catch (error) {
            setOutcome({
                kind: 'failed',
                message: error instanceof Error ? error.message : 'This link is invalid or has expired',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
            <div className="card max-w-md w-full text-center space-y-4">
                <h1 className="text-2xl font-bold text-white">Confirm your email address</h1>

                {!token ? (
                    <p role="alert" className="text-red-300">This link is invalid or has expired</p>
                ) : outcome.kind === 'confirmed' ? (
                    <>
                        <p className="text-emerald-200">Your email address is confirmed.</p>
                        <Link
                            to={signedIn ? '/dashboard' : '/login'}
                            className="text-yellow-500 hover:text-yellow-400 font-medium"
                        >
                            Continue
                        </Link>
                    </>
                ) : (
                    <>
                        {outcome.kind === 'failed' && (
                            <p role="alert" className="text-red-300">{outcome.message}</p>
                        )}
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={handleConfirm}
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                        >
                            Confirm email address
                        </Button>
                    </>
                )}

                {(!token || outcome.kind === 'failed') && (
                    <p className="text-sm text-slate-400">
                        {signedIn ? (
                            <>You can send a new link from <Link to="/profile" className="text-yellow-500 hover:text-yellow-400">your profile</Link>.</>
                        ) : (
                            <><Link to="/login" className="text-yellow-500 hover:text-yellow-400">Sign in</Link> to send a new link.</>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
};
```

- [ ] **Step 4: Route it in `src/App.tsx`**

4a. Below `import { AuthPage } from './components/auth/AuthPage';` add

```tsx
import { ConfirmEmailPage } from './components/auth/ConfirmEmailPage';
```

4b. Replace

```tsx
                    <Route path="/signup" element={
                        <PublicRoute>
                            <AuthPage initialMode="signup" redirectTo="/dashboard" />
                        </PublicRoute>
                    } />
```

with

```tsx
                    <Route path="/signup" element={
                        <PublicRoute>
                            <AuthPage initialMode="signup" redirectTo="/dashboard" />
                        </PublicRoute>
                    } />

                    {/* Email links: reachable signed in or out */}
                    <Route path="/confirm-email" element={<ConfirmEmailPage />} />
```

- [ ] **Step 5: Run the test and the suite** — 4 passed; `npm test` all pass.

- [ ] **Step 6: Gates** — `npx tsc -b` exit 0; procedure L.

- [ ] **Step 7: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/auth/ConfirmEmailPage.tsx src/components/auth/ConfirmEmailPage.test.tsx src/App.tsx
git commit -m "feat(auth): /confirm-email page for the confirmation link

Consumes Meawen/stiglja lane-email POST /api/auth/confirm-email." -- src/components/auth/ConfirmEmailPage.tsx src/components/auth/ConfirmEmailPage.test.tsx src/App.tsx
git show --stat HEAD
```

---

### Task 17: Forgot password and `/reset-password?token=` (D8)

**Files:**
- Create: `src/components/auth/ForgotPasswordPage.tsx`, `src/components/auth/ForgotPasswordPage.test.tsx`, `src/components/auth/ResetPasswordPage.tsx`, `src/components/auth/ResetPasswordPage.test.tsx`
- Modify: `src/components/auth/LoginForm.tsx`, `src/components/auth/LoginForm.test.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `authService.forgotPassword(email)`, `authService.resetPassword(token, newPassword)` (Task 15); `passwordRuleError` (Task 6).
- Produces: routes `/forgot-password`, `/reset-password` (no auth wrapper); a `Forgot password?` link on the login form. The forgot form always answers with the same sentence (the backend never reveals whether an address has an account).

- [ ] **Step 1: Write the failing tests**

`src/components/auth/ForgotPasswordPage.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'

vi.mock('../../services/authService', () => ({ authService: { forgotPassword: vi.fn() } }))

function renderPage() {
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('ForgotPasswordPage', () => {
    test('sends the address and answers the same way whether or not it has an account', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockResolvedValue(undefined)
        renderPage()
        await user.type(screen.getByLabelText('Email'), ' ana@example.com ')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(authService.forgotPassword).toHaveBeenCalledWith('ana@example.com')
        expect(await screen.findByText(/If that address has an account, we sent a link/)).toBeInTheDocument()
    })

    test('a malformed address is caught before sending', async () => {
        const user = userEvent.setup()
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'not-an-address')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(screen.getByRole('alert')).toHaveTextContent('Email is invalid')
        expect(authService.forgotPassword).not.toHaveBeenCalled()
    })

    test('a rate limit shows the server message', async () => {
        const user = userEvent.setup()
        vi.mocked(authService.forgotPassword).mockRejectedValue(new ApiError({ status: 429, message: 'Too many requests, try again later' }))
        renderPage()
        await user.type(screen.getByLabelText('Email'), 'ana@example.com')
        await user.click(screen.getByRole('button', { name: 'Send reset link' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests, try again later')
    })
})
```

`src/components/auth/ResetPasswordPage.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ResetPasswordPage } from './ResetPasswordPage'
import { authService } from '../../services/authService'
import { ApiError } from '../../services/api'

vi.mock('../../services/authService', () => ({ authService: { resetPassword: vi.fn() } }))

function renderAt(url: string) {
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /></Routes>
        </MemoryRouter>,
    )
}

async function submit(newPassword: string, confirm = newPassword) {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('New password'), newPassword)
    await user.type(screen.getByLabelText('Confirm new password'), confirm)
    await user.click(screen.getByRole('button', { name: 'Reset password' }))
}

beforeEach(() => vi.clearAllMocks())

describe('ResetPasswordPage', () => {
    test('a too-short password gets the backend rule message', async () => {
        renderAt('/reset-password?token=tok-2')
        await submit('short12')
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(authService.resetPassword).not.toHaveBeenCalled()
    })

    test('the two fields must match', async () => {
        renderAt('/reset-password?token=tok-2')
        await submit('brand-new-pass', 'brand-new-pas')
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    test('a valid reset sends token and password, then points to sign-in', async () => {
        vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
        renderAt('/reset-password?token=tok-2')
        await submit('brand-new-pass')
        expect(authService.resetPassword).toHaveBeenCalledWith('tok-2', 'brand-new-pass')
        expect(await screen.findByText('Your password has been reset. Sign in with your new password.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    })

    test('a used or expired link shows the server message', async () => {
        vi.mocked(authService.resetPassword).mockRejectedValue(new ApiError({ status: 400, message: 'This link is invalid or has expired' }))
        renderAt('/reset-password?token=old')
        await submit('brand-new-pass')
        expect(await screen.findByRole('alert')).toHaveTextContent('This link is invalid or has expired')
    })

    test('a link without a token offers a new one instead of a form', () => {
        renderAt('/reset-password')
        expect(screen.getByRole('alert')).toHaveTextContent('This link is invalid or has expired')
        expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
    })
})
```

In `src/components/auth/LoginForm.test.tsx` add inside the `describe`:

```tsx
    test('links to the forgot-password page', () => {
        render(<MemoryRouter><LoginForm onSuccess={vi.fn()} /></MemoryRouter>)
        expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    })
```

- [ ] **Step 2: Run them and watch them fail** — `npx vitest run src/components/auth` → FAIL: the two page modules are missing; no "Forgot password?" link.

- [ ] **Step 3: Create `src/components/auth/ForgotPasswordPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../common';
import { authService } from '../../services/authService';

export const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const address = email.trim();
        if (!/\S+@\S+\.\S+/.test(address)) {
            setError('Email is invalid');
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            await authService.forgotPassword(address);
            setSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send the link');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
            <div className="card max-w-md w-full space-y-6">
                <h1 className="text-2xl font-bold text-white text-center">Forgot your password?</h1>

                {sent ? (
                    // The same sentence whether or not the address has an account.
                    <p className="text-emerald-200 text-center">
                        If that address has an account, we sent a link to reset your password. The link works for 15 minutes.
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            fullWidth
                        />
                        {error && (
                            <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                                {error}
                            </div>
                        )}
                        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
                            Send reset link
                        </Button>
                    </form>
                )}

                <p className="text-center text-sm">
                    <Link to="/login" className="text-yellow-500 hover:text-yellow-400">Back to sign in</Link>
                </p>
            </div>
        </div>
    );
};
```

- [ ] **Step 4: Create `src/components/auth/ResetPasswordPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../common';
import { authService } from '../../services/authService';
import { passwordRuleError } from './credentialRules';

/** /reset-password?token=... - the link from the reset mail (valid 15 minutes, single use). */
export const ResetPasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [done, setDone] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};
        const ruleError = passwordRuleError(newPassword);
        if (ruleError) newErrors.newPassword = ruleError;
        if (confirmPassword !== newPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        setIsSubmitting(true);
        try {
            // also ends this browser's session: a reset logs out every session
            await authService.resetPassword(token, newPassword);
            setDone(true);
        } catch (error) {
            setErrors({ submit: error instanceof Error ? error.message : 'Could not reset the password' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
            <div className="card max-w-md w-full space-y-6">
                <h1 className="text-2xl font-bold text-white text-center">Choose a new password</h1>

                {!token ? (
                    <p role="alert" className="text-red-300 text-center">This link is invalid or has expired</p>
                ) : done ? (
                    <p className="text-emerald-200 text-center">Your password has been reset. Sign in with your new password.</p>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="New password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            error={errors.newPassword}
                            fullWidth
                        />
                        <Input
                            label="Confirm new password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={errors.confirmPassword}
                            fullWidth
                        />
                        {errors.submit && (
                            <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                                {errors.submit}
                            </div>
                        )}
                        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
                            Reset password
                        </Button>
                    </form>
                )}

                <p className="text-center text-sm">
                    {done ? (
                        <Link to="/login" className="text-yellow-500 hover:text-yellow-400">Sign in</Link>
                    ) : (
                        <Link to="/forgot-password" className="text-yellow-500 hover:text-yellow-400">Request a new link</Link>
                    )}
                </p>
            </div>
        </div>
    );
};
```

- [ ] **Step 5: `src/components/auth/LoginForm.tsx`**

5a. Replace `import React, { useState } from 'react';` with

```tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
```

5b. Replace

```tsx
            </form>

            {onSwitchToSignup && (
```

with

```tsx
            </form>

            <div className="text-center mt-4">
                <Link to="/forgot-password" className="text-sm text-yellow-500 hover:text-yellow-400">
                    Forgot password?
                </Link>
            </div>

            {onSwitchToSignup && (
```

- [ ] **Step 6: Routes in `src/App.tsx`**

6a. Below `import { ConfirmEmailPage } from './components/auth/ConfirmEmailPage';` add

```tsx
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
```

6b. Replace

```tsx
                    <Route path="/confirm-email" element={<ConfirmEmailPage />} />
```

with

```tsx
                    <Route path="/confirm-email" element={<ConfirmEmailPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
```

- [ ] **Step 7: Run the tests and the suite** — `npx vitest run src/components/auth` all pass; `npm test` all pass.

- [ ] **Step 8: Gates** — `npx tsc -b` exit 0; procedure L.

- [ ] **Step 9: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/auth/ForgotPasswordPage.tsx src/components/auth/ForgotPasswordPage.test.tsx src/components/auth/ResetPasswordPage.tsx src/components/auth/ResetPasswordPage.test.tsx src/components/auth/LoginForm.tsx src/components/auth/LoginForm.test.tsx src/App.tsx
git commit -m "feat(auth): forgot-password and reset-password pages

The forgot form answers the same way for every address. A reset applies
the 8-72 byte rule and forgets this browser's session, since a reset ends
all of them.

Consumes Meawen/stiglja lane-email forgot-password and reset-password." -- src/components/auth/ForgotPasswordPage.tsx src/components/auth/ForgotPasswordPage.test.tsx src/components/auth/ResetPasswordPage.tsx src/components/auth/ResetPasswordPage.test.tsx src/components/auth/LoginForm.tsx src/components/auth/LoginForm.test.tsx src/App.tsx
git show --stat HEAD
```

---

### Task 18: Change of email address on the profile, pending address and resend (D8)

**Files:**
- Create: `src/components/auth/ResendConfirmationButton.tsx`, `src/components/auth/ResendConfirmationButton.test.tsx`, `src/components/profile/ChangeEmailForm.tsx`, `src/components/profile/ChangeEmailForm.test.tsx`
- Modify: `src/components/profile/ProfileStats.tsx`, `src/components/profile/ProfileStats.test.tsx`, `src/components/profile/UserProfile.tsx`, `src/components/profile/UserProfile.test.tsx`

**Interfaces:**
- Consumes: `userService.changeEmail`, `userService.resendEmailConfirmation`, `UserDto.pendingEmail/emailVerified`, `ApiError.invalidToken` (Task 15).
- Produces: `<ResendConfirmationButton />` (no props; button `Resend confirmation email`, then a `role="status"` line); `<ChangeEmailForm currentEmail onSuccess(newEmail) onCancel />`; `ProfileStatsProps` gains `confirmAction?: React.ReactNode`. Task 19 reuses `ResendConfirmationButton` in the banner.

- [ ] **Step 1: Write the failing tests**

`src/components/auth/ResendConfirmationButton.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResendConfirmationButton } from './ResendConfirmationButton'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'

vi.mock('../../services/userService', () => ({ userService: { resendEmailConfirmation: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

describe('ResendConfirmationButton', () => {
    test('a sent link says where to look', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockResolvedValue(undefined)
        render(<ResendConfirmationButton />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Confirmation email sent. Check your inbox.')
    })

    test('nothing to confirm or too many requests shows the server message', async () => {
        vi.mocked(userService.resendEmailConfirmation).mockRejectedValue(new ApiError({ status: 409, message: 'Nothing to confirm' }))
        render(<ResendConfirmationButton />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Resend confirmation email' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Nothing to confirm')
    })
})
```

`src/components/profile/ChangeEmailForm.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangeEmailForm } from './ChangeEmailForm'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'

vi.mock('../../services/userService', () => ({ userService: { changeEmail: vi.fn() } }))

function setup() {
    const onSuccess = vi.fn()
    render(<ChangeEmailForm currentEmail="ana@example.com" onSuccess={onSuccess} onCancel={vi.fn()} />)
    return { onSuccess }
}

async function submit(newEmail: string, currentPassword: string) {
    const user = userEvent.setup()
    if (newEmail) await user.type(screen.getByLabelText('New email address'), newEmail)
    if (currentPassword) await user.type(screen.getByLabelText('Current password'), currentPassword)
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
}

beforeEach(() => vi.clearAllMocks())

describe('ChangeEmailForm', () => {
    test('both fields are required and the address must look like one', async () => {
        setup()
        await submit('', '')
        expect(screen.getByText('New email address is required')).toBeInTheDocument()
        expect(screen.getByText('Current password is required')).toBeInTheDocument()
        await submit('nope', 'long-enough-1')
        expect(screen.getByText('Email is invalid')).toBeInTheDocument()
        expect(userService.changeEmail).not.toHaveBeenCalled()
    })

    test('the current address is refused before sending', async () => {
        setup()
        await submit('ANA@example.com', 'long-enough-1')
        expect(screen.getByText('That is already your email address')).toBeInTheDocument()
        expect(userService.changeEmail).not.toHaveBeenCalled()
    })

    test('a valid change sends address and password and reports the new address', async () => {
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        const { onSuccess } = setup()
        await submit(' new@example.com ', 'long-enough-1')
        expect(userService.changeEmail).toHaveBeenCalledWith({ newEmail: 'new@example.com', currentPassword: 'long-enough-1' })
        expect(onSuccess).toHaveBeenCalledWith('new@example.com')
    })

    test('a wrong current password says so', async () => {
        vi.mocked(userService.changeEmail).mockRejectedValue(new ApiError({ status: 401, message: 'Invalid current password' }))
        setup()
        await submit('new@example.com', 'wrong-pass-1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect')
    })

    test('a dead session shows the server message instead', async () => {
        vi.mocked(userService.changeEmail).mockRejectedValue(new ApiError({ status: 401, message: 'Invalid or expired token', invalidToken: true }))
        setup()
        await submit('new@example.com', 'long-enough-1')
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired token')
    })
})
```

In `src/components/profile/ProfileStats.test.tsx`:

(a) replace the `me` fixture line with

```tsx
const me: UserDto = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: ['ROLE_ADMIN'], deletionRequested: false }
```

(b) add inside the `describe`:

```tsx
    test('a pending address waits for confirmation and offers the resend action', () => {
        render(<ProfileStats user={player} me={{ ...me, pendingEmail: 'new@example.com' }} confirmAction={<button>Resend confirmation email</button>} />)
        expect(screen.getByTestId('pending-email')).toHaveTextContent('Waiting for confirmation: new@example.com')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a legacy unconfirmed address is marked and can be confirmed', () => {
        render(<ProfileStats user={player} me={{ ...me, emailVerified: false }} confirmAction={<button>Resend confirmation email</button>} />)
        expect(screen.getByText('(not confirmed)')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a confirmed address with nothing pending offers no resend', () => {
        render(<ProfileStats user={player} me={me} confirmAction={<button>Resend confirmation email</button>} />)
        expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).not.toBeInTheDocument()
    })
```

In `src/components/profile/UserProfile.test.tsx`:

(a) replace

```tsx
vi.mock('../../services/userService', () => ({
    userService: { requestForget: vi.fn(), changePassword: vi.fn() },
}))
```

with

```tsx
vi.mock('../../services/userService', () => ({
    userService: { requestForget: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn(), resendEmailConfirmation: vi.fn() },
}))
```

(b) replace

```tsx
const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: null, deletionRequested: false }
```

with

```tsx
const meBase = { id: 'u1', username: 'ana', email: 'ana@example.com', pendingEmail: null, emailVerified: true, roles: null, deletionRequested: false }
```

(c) append at the end of the file:

```tsx
describe('UserProfile change of email', () => {
    test('a sent change tells where the link went and refreshes me', async () => {
        const user = userEvent.setup()
        vi.mocked(userService.changeEmail).mockResolvedValue(undefined)
        render(<UserProfile />)
        await user.click(screen.getByRole('button', { name: 'Change Email' }))
        await user.type(screen.getByLabelText('New email address'), 'new@example.com')
        await user.type(screen.getByLabelText('Current password'), 'long-enough-1')
        await user.click(screen.getByRole('button', { name: 'Send confirmation link' }))
        expect(userService.changeEmail).toHaveBeenCalledWith({ newEmail: 'new@example.com', currentPassword: 'long-enough-1' })
        expect(await screen.findByRole('status')).toHaveTextContent('We sent a confirmation link to new@example.com.')
        expect(refetchMe).toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run them and watch them fail** — `npx vitest run src/components/auth/ResendConfirmationButton.test.tsx src/components/profile` → FAIL: two modules missing; no pending line, no "(not confirmed)", no "Change Email" button.

- [ ] **Step 3: Create `src/components/auth/ResendConfirmationButton.tsx`**

```tsx
import React, { useState } from 'react';
import { Button } from '../common/Button';
// direct module import (not the ../../hooks barrel) keeps tests off the WebSocket hooks
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';

/** Re-sends the confirmation link for the pending (or legacy unconfirmed) address. */
export const ResendConfirmationButton: React.FC = () => {
    const [message, setMessage] = useState<string | null>(null);
    const resend = useMutation(() => userService.resendEmailConfirmation());

    const handleClick = async () => {
        setMessage(null);
        try {
            await resend.mutate();
            setMessage('Confirmation email sent. Check your inbox.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not send the email');
        }
    };

    return (
        <span className="inline-flex flex-wrap items-center gap-2">
            <Button
                variant="outline"
                size="small"
                onClick={handleClick}
                disabled={resend.isLoading}
                isLoading={resend.isLoading}
            >
                Resend confirmation email
            </Button>
            {message && <span role="status" className="text-sm text-emerald-200">{message}</span>}
        </span>
    );
};
```

- [ ] **Step 4: Create `src/components/profile/ChangeEmailForm.tsx`**

```tsx
import React, { useState } from 'react';
import { Button, Input } from '../common';
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { ApiError } from '../../services/api';
import type { ChangeEmailRequest } from '../../types/user';

export interface ChangeEmailFormProps {
    currentEmail: string | null;
    onSuccess: (newEmail: string) => void;
    onCancel: () => void;
}

export const ChangeEmailForm: React.FC<ChangeEmailFormProps> = ({ currentEmail, onSuccess, onCancel }) => {
    const [newEmail, setNewEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const changeEmailMutation = useMutation((request: ChangeEmailRequest) => userService.changeEmail(request));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const address = newEmail.trim();
        const newErrors: Record<string, string> = {};
        if (!address) {
            newErrors.newEmail = 'New email address is required';
        } else if (!/\S+@\S+\.\S+/.test(address)) {
            newErrors.newEmail = 'Email is invalid';
        } else if (currentEmail && address.toLowerCase() === currentEmail.toLowerCase()) {
            newErrors.newEmail = 'That is already your email address';
        }
        if (!currentPassword) {
            newErrors.currentPassword = 'Current password is required';
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setErrors({});
            await changeEmailMutation.mutate({ newEmail: address, currentPassword });
            onSuccess(address);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401 && !error.invalidToken) {
                setErrors({ submit: 'Current password is incorrect' });
            } else {
                setErrors({ submit: error instanceof Error ? error.message : 'Failed to change the email address' });
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Input
                label="New email address"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                error={errors.newEmail}
                placeholder="you@example.com"
            />
            <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={errors.currentPassword}
                placeholder="Enter current password..."
            />

            <p className="text-sm text-slate-400">
                We send a confirmation link to the new address. Your current address stays in use until you confirm.
            </p>

            {errors.submit && (
                <div role="alert" className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {errors.submit}
                </div>
            )}

            <div className="flex gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={changeEmailMutation.isLoading}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={changeEmailMutation.isLoading}
                    isLoading={changeEmailMutation.isLoading}
                    className="flex-1"
                >
                    Send confirmation link
                </Button>
            </div>
        </form>
    );
};
```

- [ ] **Step 5: `src/components/profile/ProfileStats.tsx`**

5a. Replace

```tsx
export interface ProfileStatsProps {
    user: User;
    me?: UserDto | null;
}

export const ProfileStats: React.FC<ProfileStatsProps> = ({ user, me }) => {
```

with

```tsx
export interface ProfileStatsProps {
    user: User;
    me?: UserDto | null;
    /** Rendered when there is an address to confirm (the profile passes the resend button). */
    confirmAction?: React.ReactNode;
}

export const ProfileStats: React.FC<ProfileStatsProps> = ({ user, me, confirmAction }) => {
```

5b. Replace

```tsx
                    {me && (
                        <div>
                            <span className="text-slate-400">Email:</span>
                            <div className="text-white font-medium">
                                {me.email || 'Not set'}
                            </div>
                        </div>
                    )}
```

with

```tsx
                    {me && (
                        <div>
                            <span className="text-slate-400">Email:</span>
                            <div className="text-white font-medium">
                                {me.email || 'Not set'}
                                {me.email && !me.emailVerified && (
                                    <span className="ml-2 text-xs text-amber-400">(not confirmed)</span>
                                )}
                            </div>
                            {me.pendingEmail && (
                                <div data-testid="pending-email" className="text-amber-300 text-sm mt-1">
                                    Waiting for confirmation: {me.pendingEmail}
                                </div>
                            )}
                            {(me.pendingEmail || (me.email && !me.emailVerified)) && confirmAction && (
                                <div className="mt-2">{confirmAction}</div>
                            )}
                        </div>
                    )}
```

- [ ] **Step 6: `src/components/profile/UserProfile.tsx`**

6a. Below `import { ChangePasswordForm } from './ChangePasswordForm';` add

```tsx
import { ChangeEmailForm } from './ChangeEmailForm';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';
```

6b. Replace

```tsx
    const [activeTab, setActiveTab] = useState<'stats' | 'profile'>('stats');
```

with

```tsx
    const [activeTab, setActiveTab] = useState<'stats' | 'profile'>('stats');
    const [showChangeEmail, setShowChangeEmail] = useState(false);
    const [emailNotice, setEmailNotice] = useState<string | null>(null);
```

6c. Replace

```tsx
                            {isOwnProfile && (
                                <Button
                                    onClick={() => setShowEditProfile(true)}
```

with

```tsx
                            {isOwnProfile && (
                                <div className="flex gap-2">
                                <Button
                                    onClick={() => setShowChangeEmail(true)}
                                    variant="outline"
                                    size="small"
                                    className="border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
                                >
                                    Change Email
                                </Button>
                                <Button
                                    onClick={() => setShowEditProfile(true)}
```

and replace

```tsx
                                    Change Password
                                </Button>
                            )}
```

with

```tsx
                                    Change Password
                                </Button>
                                </div>
                            )}
```

6d. Replace

```tsx
        <div className="space-y-6">
            {/* Profile Header */}
```

with

```tsx
        <div className="space-y-6">
            {emailNotice && (
                <div role="status" className="card border border-emerald-500/40 text-emerald-200 text-sm">
                    {emailNotice}
                </div>
            )}

            {/* Profile Header */}
```

6e. Replace

```tsx
                <ProfileStats user={displayUser} me={me ?? null} />
```

with

```tsx
                <ProfileStats user={displayUser} me={me ?? null} confirmAction={<ResendConfirmationButton />} />
```

6f. Replace

```tsx
                    <ChangePasswordForm
                        onSuccess={() => setShowEditProfile(false)}
                        onCancel={() => setShowEditProfile(false)}
                    />
                </Modal>
            )}
```

with

```tsx
                    <ChangePasswordForm
                        onSuccess={() => setShowEditProfile(false)}
                        onCancel={() => setShowEditProfile(false)}
                    />
                </Modal>
            )}

            {/* Change Email Modal */}
            {isOwnProfile && (
                <Modal
                    isOpen={showChangeEmail}
                    onClose={() => setShowChangeEmail(false)}
                    title="Change Email"
                >
                    <ChangeEmailForm
                        currentEmail={me?.email ?? null}
                        onSuccess={(newEmail) => {
                            setShowChangeEmail(false);
                            setEmailNotice(`We sent a confirmation link to ${newEmail}. Your current address stays in use until you confirm.`);
                            refetchMe();
                        }}
                        onCancel={() => setShowChangeEmail(false)}
                    />
                </Modal>
            )}
```

- [ ] **Step 7: Run the tests and the suite** — `npx vitest run src/components/auth/ResendConfirmationButton.test.tsx src/components/profile` all pass; `npm test` all pass.

- [ ] **Step 8: Gates** — `npx tsc -b` exit 0; procedure L.

- [ ] **Step 9: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/auth/ResendConfirmationButton.tsx src/components/auth/ResendConfirmationButton.test.tsx src/components/profile/ChangeEmailForm.tsx src/components/profile/ChangeEmailForm.test.tsx src/components/profile/ProfileStats.tsx src/components/profile/ProfileStats.test.tsx src/components/profile/UserProfile.tsx src/components/profile/UserProfile.test.tsx
git commit -m "feat(profile): change of email address with confirmation; show the pending address and resend

Email editing comes back only through the confirm-by-link flow: the old
address stays in force until the new one is confirmed.

Consumes Meawen/stiglja lane-email POST /user/me/email and /resend." -- src/components/auth/ResendConfirmationButton.tsx src/components/auth/ResendConfirmationButton.test.tsx src/components/profile/ChangeEmailForm.tsx src/components/profile/ChangeEmailForm.test.tsx src/components/profile/ProfileStats.tsx src/components/profile/ProfileStats.test.tsx src/components/profile/UserProfile.tsx src/components/profile/UserProfile.test.tsx
git show --stat HEAD
```

---

### Task 19: Unverified banner, ranked 403 explained, signup "check your inbox" (D8), and the Stage C runtime check

**Files:**
- Create: `src/components/layout/UnverifiedEmailBanner.tsx`, `src/components/layout/UnverifiedEmailBanner.test.tsx`, `src/components/game/PlayButton.test.tsx`
- Modify: `src/components/layout/AppLayout.tsx`, `src/components/game/PlayButton.tsx`, `src/components/auth/SignupForm.tsx`, `src/components/auth/SignupForm.test.tsx`

**Interfaces:**
- Consumes: `useMe(enabled)`, `useAuth().isAuthenticated`, `ResendConfirmationButton` (Task 18); `POST /ranked/queue` → 403 `{"error":"Verify your email to play ranked"}` (spec §3) surfaced by `useEnhancedRanked().joinError` (an `ApiError`).
- Produces: a banner on every `AppLayout` page for signed-in, unverified accounts; the signup form ends on a "Check your inbox" panel with a `Continue` button (the e2e harness clicks it).

- [ ] **Step 1: Write the failing tests**

`src/components/layout/UnverifiedEmailBanner.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner'
import { useMe } from '../../hooks/useUser'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }))
vi.mock('../../hooks/useUser', () => ({ useMe: vi.fn() }))
vi.mock('../../services/userService', () => ({ userService: { resendEmailConfirmation: vi.fn() } }))

const base = { id: 'u1', username: 'ana', email: null, pendingEmail: null, emailVerified: false, roles: null, deletionRequested: false }

function renderBanner(me: object | null) {
    vi.mocked(useMe).mockReturnValue({ data: me } as never)
    return render(<MemoryRouter><UnverifiedEmailBanner /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('UnverifiedEmailBanner', () => {
    test('a verified account sees nothing', () => {
        const { container } = renderBanner({ ...base, email: 'ana@example.com', emailVerified: true })
        expect(container).toBeEmptyDOMElement()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(true)
    })

    test('a pending address asks to check the inbox and offers a resend', () => {
        renderBanner({ ...base, pendingEmail: 'ana@example.com' })
        expect(screen.getByRole('region', { name: 'Email confirmation' })).toHaveTextContent('Check your inbox: confirm ana@example.com to play ranked.')
        expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument()
    })

    test('a legacy unconfirmed address is named too', () => {
        renderBanner({ ...base, email: 'old@example.com' })
        expect(screen.getByRole('region', { name: 'Email confirmation' })).toHaveTextContent('confirm old@example.com to play ranked.')
    })

    test('an account without any address is sent to its profile', () => {
        renderBanner(base)
        expect(screen.getByText(/Add an email address to play ranked/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Open your profile' })).toHaveAttribute('href', '/profile')
    })
})
```

`src/components/game/PlayButton.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayButton } from './PlayButton'
import { useEnhancedRanked } from '../../hooks/useEnhancedRanked'
import { ApiError } from '../../services/api'

vi.mock('../../hooks/useEnhancedRanked', () => ({ useEnhancedRanked: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }))

function ranked(joinError: ApiError | null) {
    vi.mocked(useEnhancedRanked).mockReturnValue({
        isInQueue: false, joinQueue: vi.fn(), leaveQueue: vi.fn(), isJoining: false, isLeaving: false,
        joinError, leaveError: null, isWebSocketConnected: true, isWebSocketConnecting: false, webSocketError: null,
    } as never)
}

beforeEach(() => vi.clearAllMocks())

describe('PlayButton', () => {
    test('a ranked 403 explains what to do', () => {
        ranked(new ApiError({ status: 403, message: 'Verify your email to play ranked' }))
        render(<PlayButton />)
        expect(screen.getByText(/Verify your email to play ranked/)).toHaveTextContent(
            'Verify your email to play ranked. Open the link we sent you (or resend it from the banner at the top), then try again.')
        expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument()
    })

    test('other failures keep the generic error line', () => {
        ranked(new ApiError({ status: 500, message: 'Internal Server Error' }))
        render(<PlayButton />)
        expect(screen.getByText('Error: Internal Server Error')).toBeInTheDocument()
    })
})
```

Replace the whole of `src/components/auth/SignupForm.test.tsx` with:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'

const auth = vi.hoisted(() => ({ signup: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ signup: auth.signup, isSignupLoading: false }),
}))

beforeEach(() => vi.clearAllMocks())

async function fill(username: string, password: string, confirm = password) {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<SignupForm onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('Username'), username)
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), password)
    await user.type(screen.getByLabelText('Confirm Password'), confirm)
    await user.click(screen.getByRole('button', { name: /create account/i }))
    return { user, onSuccess }
}

describe('SignupForm credential rules', () => {
    test('a 7-character password is refused with the backend message', async () => {
        await fill('ana', 'short12')
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a password over 72 bytes is refused', async () => {
        await fill('ana', 'ä'.repeat(37))
        expect(screen.getByText('Password must be at least 8 characters and at most 72 bytes')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a username outside the pattern is refused', async () => {
        await fill('ana.b', 'long-enough-1')
        expect(screen.getByText('Username must be 3-20 characters: letters, digits or underscore')).toBeInTheDocument()
        expect(auth.signup).not.toHaveBeenCalled()
    })

    test('a valid form sends the trimmed username', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        await fill('  ana  ', 'long-enough-1')
        expect(auth.signup).toHaveBeenCalledWith({ username: 'ana', email: 'ana@example.com', password: 'long-enough-1' })
    })
})

describe('SignupForm after success', () => {
    test('asks to check the inbox before continuing', async () => {
        auth.signup.mockResolvedValue({ token: 't', user: { id: 'u1', username: 'ana' }, message: null })
        const { user, onSuccess } = await fill('ana', 'long-enough-1')
        expect(await screen.findByText('Check your inbox')).toBeInTheDocument()
        expect(screen.getByText('ana@example.com')).toBeInTheDocument()
        expect(onSuccess).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onSuccess).toHaveBeenCalledTimes(1)
    })
})
```

- [ ] **Step 2: Run them and watch them fail** — `npx vitest run src/components/layout/UnverifiedEmailBanner.test.tsx src/components/game/PlayButton.test.tsx src/components/auth/SignupForm.test.tsx` → FAIL: banner module missing; PlayButton shows `Error: Verify your email to play ranked`; signup calls `onSuccess` immediately and shows no panel.

- [ ] **Step 3: Create `src/components/layout/UnverifiedEmailBanner.tsx`**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMe } from '../../hooks/useUser';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';

/** Unverified accounts may play casual, not ranked; say so on every page until confirmed. */
export const UnverifiedEmailBanner: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const { data: me } = useMe(isAuthenticated);

    if (!isAuthenticated || !me || me.emailVerified) return null;

    const address = me.pendingEmail ?? me.email;

    return (
        <div
            role="region"
            aria-label="Email confirmation"
            className="bg-amber-900/30 border-b border-amber-600/40 px-6 py-3 flex flex-wrap items-center gap-3 text-sm text-amber-100"
        >
            {address ? (
                <>
                    <span>Check your inbox: confirm {address} to play ranked.</span>
                    <ResendConfirmationButton />
                </>
            ) : (
                <span>
                    Add an email address to play ranked.{' '}
                    <Link to="/profile" className="underline text-amber-200 hover:text-white">Open your profile</Link>
                </span>
            )}
        </div>
    );
};
```

- [ ] **Step 4: `src/components/layout/AppLayout.tsx`**

4a. Below `import { Sidebar } from './Sidebar';` add `import { UnverifiedEmailBanner } from './UnverifiedEmailBanner';`

4b. Replace

```tsx
                <main className="flex-1 min-w-0">
                    <div className="py-8">
```

with

```tsx
                <main className="flex-1 min-w-0">
                    <UnverifiedEmailBanner />
                    <div className="py-8">
```

- [ ] **Step 5: `src/components/game/PlayButton.tsx`** — replace

```tsx
                    <span className="font-medium">Error: {joinError?.message || leaveError?.message}</span>
```

with

```tsx
                    {joinError?.status === 403 ? (
                        <span className="font-medium">
                            {joinError.message}. Open the link we sent you (or resend it from the banner at the top), then try again.
                        </span>
                    ) : (
                        <span className="font-medium">Error: {joinError?.message || leaveError?.message}</span>
                    )}
```

(A 403 from `POST /ranked/queue` is the unverified-account refusal; an expired or revoked session is a 401 since lane-email and never reaches this line as a 403.)

- [ ] **Step 6: `src/components/auth/SignupForm.tsx`**

6a. Replace

```tsx
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { signup, isSignupLoading } = useAuth();
```

with

```tsx
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);

    const { signup, isSignupLoading } = useAuth();
```

6b. Replace

```tsx
            console.log('Signup successful:', result);
            onSuccess?.();
```

with

```tsx
            console.log('Signup successful:', result);
            // The account works now; the address still needs its confirmation link.
            setCreatedEmail(formData.email.trim());
```

6c. Replace

```tsx
    return (
        <div className="card max-w-md mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
```

with

```tsx
    if (createdEmail) {
        return (
            <div className="card max-w-md mx-auto text-center space-y-4">
                <h2 className="text-2xl font-bold text-white">Check your inbox</h2>
                <p className="text-slate-300">
                    We sent a confirmation link to <strong>{createdEmail}</strong>. Confirm it to play ranked; casual games work right away.
                </p>
                <Button type="button" variant="primary" fullWidth onClick={() => onSuccess?.()}>
                    Continue
                </Button>
            </div>
        );
    }

    return (
        <div className="card max-w-md mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
```

(The panel says "we sent a link" for every signup: for an address that already has an account the backend mails its owner instead, and the response must look identical — spec §1.)

- [ ] **Step 7: Run the tests and the suite** — the three files pass; `npm test` all pass.

- [ ] **Step 8: Gates** — `npx tsc -b` exit 0; procedure L.

- [ ] **Step 9: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/components/layout/UnverifiedEmailBanner.tsx src/components/layout/UnverifiedEmailBanner.test.tsx src/components/layout/AppLayout.tsx src/components/game/PlayButton.tsx src/components/game/PlayButton.test.tsx src/components/auth/SignupForm.tsx src/components/auth/SignupForm.test.tsx
git commit -m "feat(auth): unverified-email banner, ranked refusal explained, check-your-inbox after signup

Unverified accounts play casual but not ranked; the banner names the
address to confirm and offers a resend, and the ranked button explains its
403.

Consumes Meawen/stiglja lane-email D2 (ranked gate) and GET /user/me fields." -- src/components/layout/UnverifiedEmailBanner.tsx src/components/layout/UnverifiedEmailBanner.test.tsx src/components/layout/AppLayout.tsx src/components/game/PlayButton.tsx src/components/game/PlayButton.test.tsx src/components/auth/SignupForm.tsx src/components/auth/SignupForm.test.tsx
git show --stat HEAD
```

- [ ] **Step 10: Stage C runtime check** — procedure R0–R5 (backend at `lukasDev` with lane-email merged; Mailpit at http://localhost:8025). Use separate browser contexts per account. Record PASS/FAIL for each:
  1. Sign up `e2ecara` → "Check your inbox" panel naming the address → Continue → dashboard shows the banner "Check your inbox: confirm … to play ranked." → Mailpit holds a confirmation mail → open its link → "Confirm email address" → "Your email address is confirmed." → after reload the banner is gone.
  2. A second, unconfirmed account on `/play` → Find Match → "Verify your email to play ranked. Open the link we sent you …".
  3. Banner "Resend confirmation email" → "Confirmation email sent. Check your inbox." and a new mail; repeat until the 4th within the hour → "Too many requests, try again later".
  4. Logged out → `/login` → "Forgot password?" → submit the confirmed account's address and an unknown address → both show the same sentence; only the real address receives a reset mail → open `/reset-password?token=…` → a 7-character password is refused → set `brand-new-pass` → "Your password has been reset…" → sign in with it works; the old password fails.
  5. Profile → Change Email → new address + current password → the notice names the new address; Account Information shows "Waiting for confirmation: <new>" with a resend button → confirm via Mailpit → the profile shows the new address; the old address received an "address changed" mail.
  6. Same account in contexts A and B, both on `/play`. Change the password in A → A stays signed in (`localStorage.authToken` changed) and its network log shows one new `/ws/…` websocket after the change; B's socket is closed by the server, and B's next navigation that calls the API (e.g. `/profile`) gets a 401 and B ends up signed out.

  Then procedure R6. Report each item; name any skipped one and why.

---
# Stage D — after lane-debt merges, including its stage 2 (E5, E7 consumers)

Two E5 frontend items were already done in Stage A because they need no backend change and the same lines were being rewritten: the game types read `PlayerPublicInfo {id, cardsLeft}` (Task 7; valid against both the old `{username, id, cardsLeft}` and the new shape), STOMP bodies carry no `playerId` (Task 7), and the dead `Header`/`UserDropdown`/`MainLayout` were deleted (Task 10). Task 20 verifies them and does the rest.

### Task 20: No more `/api/api/auth` in development; root test scripts out of the repo; E5 verification

**Root cause of the double prefix (read in code):** in development `apiClient` prefixes every path with `/api`, and the Vite proxy strips a leading `/api` before forwarding to :8080. The backend's own auth routes live under `/api/auth/**`, so `authService` must call `/api/auth/login`, which travels as `/api/api/auth/login`. Production (`VITE_API_BASE_URL`, no proxy) is unaffected. The dev prefix only exists to keep API paths such as `/user`, `/matches` and `/admin` apart from SPA routes of the same name, so it can be any non-colliding word: it becomes `/backend`.

**Files:**
- Modify: `vite.config.ts`, `src/services/api.ts`, `src/services/api.test.ts`
- Delete (tracked, `git rm`): `test-defensive-fix.js`, `test-response-structure-fix.js`
- Outside the repo: the main checkout's 35 untracked root scripts move to the Trash.

**Interfaces:**
- Consumes: nothing new from the backend.
- Produces: dev requests go to `/backend/<backend path>`; the proxy forwards `<backend path>` unchanged. Note for the orchestrator: `stiglja/CONSTELLATION.md`'s "Base-URL rule" paragraph describes the old `/api` prefix and becomes stale (backend repo, not edited here).

- [ ] **Step 1: Gate G-D** — run the G-D lines of procedure G. Expected `0` and the `findAll` signature with page/size/q. Otherwise stop.

- [ ] **Step 2: Verify the E5 items done earlier**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
grep -n "playerId" src/hooks/useGameWebSocket.ts                                   # expect no output
grep -n -A3 "interface PlayerPublicInfo" src/types/game.ts                          # expect id and cardsLeft only
grep -rn -e "\.cardCount" -e "\.handSize" src --include='*.tsx' --include='*.ts' | grep -v MockGameBoard   # expect no output
ls src/components/layout                                                             # expect no Header/MainLayout/UserDropdown
```

- [ ] **Step 3: Write the failing test** — in `src/services/api.test.ts`, inside `describe('apiClient error handling', ...)`, add:

```ts
    test('development requests use the /backend proxy prefix, so /api/auth paths are not doubled', async () => {
        const fetchMock = vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Bad credentials' }))
        vi.stubGlobal('fetch', fetchMock)
        await expect(apiClient.post('/api/auth/login', {})).rejects.toBeInstanceOf(ApiError)
        expect(fetchMock.mock.calls[0][0]).toBe('/backend/api/auth/login')
    })
```

Run `npx vitest run src/services/api.test.ts` → FAIL: `expected '/api/api/auth/login' to be '/backend/api/auth/login'`.

- [ ] **Step 4: Implement**

4a. `src/services/api.ts` — replace

```ts
const API_BASE_URL = import.meta.env.DEV
    ? '/api'  // Use Vite proxy in development
    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080');
```

with

```ts
const API_BASE_URL = import.meta.env.DEV
    ? '/backend'  // Vite proxy prefix in development (vite.config.ts strips it); not /api, which the backend's own /api/auth routes use
    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080');
```

4b. `vite.config.ts` — replace

```ts
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
```

with

```ts
      '/backend': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, '')
      },
```

4c. Check that nothing else in `src` relies on the old dev prefix: `grep -rn "'/api" src | grep -v "/api/auth"` → expect no output.

- [ ] **Step 5: Run the test and the suite** — `npx vitest run src/services/api.test.ts` passes; `npm test` all pass; `npx tsc -b` exit 0; procedure L.

- [ ] **Step 6: Commit the prefix fix**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/services/api.ts src/services/api.test.ts vite.config.ts
git commit -m "fix(dev): proxy the API under /backend so /api/auth paths are not doubled

The dev proxy stripped a leading /api, so the backend's own /api/auth routes
had to be requested as /api/api/auth. Production is unchanged." -- src/services/api.ts src/services/api.test.ts vite.config.ts
git show --stat HEAD
```

- [ ] **Step 7: Remove the two tracked root test scripts** (ad-hoc Node scripts, not part of any suite; history keeps them)

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git rm test-defensive-fix.js test-response-structure-fix.js
git commit -m "chore: remove ad-hoc root test scripts" -- test-defensive-fix.js test-response-structure-fix.js
git show --stat HEAD
```

- [ ] **Step 8: Move the main checkout's untracked root test scripts to the Trash (never `rm`)** — they are not in git, so the Trash is their only recovery path. The expected 35 are: `test-animation-optimization.cjs`, `test-arena-theme.cjs`, `test-arena-transitions.cjs`, `test-backend-final-score-issue.cjs`, `test-card-clumping-fix.cjs`, `test-challenge-button-fix.cjs`, `test-challenge-implementation.cjs`, `test-combined-animations.cjs`, `test-consistent-card-positioning.cjs`, `test-enhanced-animations.cjs`, `test-final-animation-fixes.cjs`, `test-final-score-fix.cjs`, `test-final-score-parsing.cjs`, `test-fix.js`, `test-hundreds-wheat.cjs`, `test-layout-consolidation.cjs`, `test-massive-wheat.cjs`, `test-match-details-legal-moves.cjs`, `test-match-details-ui-improvements.cjs`, `test-match-history.js`, `test-overlap-fix.cjs`, `test-partner-card-positioning.cjs`, `test-pik-icon-fix.cjs`, `test-player-name-positioning.cjs`, `test-player-positioning-fix.cjs`, `test-score-parsing.cjs`, `test-seasonal-animations.cjs`, `test-suit-icons-enhancement.cjs`, `test-trick-counter-fix.cjs`, `test-trick-jumping-fix.cjs`, `test-trick-size-and-name-positioning.cjs`, `test-trump-bidding-fix.js`, `test-trump-bidding.js`, `test-wheat-usememo.cjs`, `test-winner-visibility.cjs`.

```bash
cd /Users/lmiholic/IdeaProjects/Belatro_FrontEnd_LukasSoloRewrite
LIST=/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/trashed-test-scripts.txt
git ls-files --others --exclude-standard -- 'test-*.cjs' 'test-*.js' > "$LIST"
wc -l < "$LIST"                                   # expect 35 (the tracked two are NOT in this list)
DEST="$HOME/.Trash/belatro-fe-test-scripts-2026-10-01"
if ! { mkdir -p "$DEST" 2>/dev/null && touch "$DEST/.probe" 2>/dev/null && rm "$DEST/.probe"; }; then
  DEST=/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/trashed-test-scripts-2026-10-01
  mkdir -p "$DEST"
  echo "~/.Trash is not writable from this shell (macOS privacy); parked the scripts in $DEST instead"
fi
while IFS= read -r f; do mv -n -- "$f" "$DEST/"; done < "$LIST"
ls "$DEST" | wc -l                                # expect 35
git status --short -- 'test-*'                    # expect no '??' lines (the two tracked scripts disappear when this branch reaches the main checkout)
```

Report the destination actually used. Leave every other untracked file in the main checkout alone (`Backendlogs.txt`, `CHALLENGE_IMPLEMENTATION.md`, `GamesocketGuide.*`, the `.docx`/`.pdf`, `Websocketwebconssoledebug.txt`, `src/hooks/.editorconfig`, the plan copy).

---

### Task 21: Players list pages and searches on the server (E7 consumer)

**Reconciliation with the old plan's Task 7:** its client-side `userMatchesSearch` was never built (Task 10 removed only the dead email term); search now moves to the server's `q`, so no client-side predicate remains. The ELO/Level sort buttons keep sorting the rows of the current page only (the server sorts by username) — flagged in the report, not changed.

**Files:**
- Modify: `src/types/common.ts`, `src/services/userService.ts`, `src/services/userService.test.ts`, `src/hooks/useUser.ts`, `src/hooks/index.ts`, `src/components/profile/UserList.tsx`, `src/components/admin/AdminStats.tsx`
- Test: `src/components/profile/UserList.test.tsx`, `src/components/admin/AdminStats.test.tsx`

**Interfaces:**
- Consumes (debt spec E7 + lane-debt plan, pinned): `GET /user/findAll?page&size&q` → Spring Data `Page<UserSummaryDto>` serialized flat: `content`, `totalElements`, `totalPages`, `number`, `size`, …; `page<0` → 0, `size<1` → 20, `size>100` → 100 (clamped, not rejected); sorted by username ascending; `q` = case-insensitive substring of username.
- Produces: `Page<T>` in `src/types/common.ts`; `userService.getUsersPage({page, size, q?}): Promise<Page<User>>` (replaces `getAllUsers`); `useUsersPage(page: number, q: string)` and `USERS_PAGE_SIZE = 20` in `src/hooks/useUser.ts` (replace `useAllUsers`); `AdminStats` "Total Matches" counts `GET /matches` instead of summing `gamesPlayed` over all users (which `/user/findAll` no longer returns in one call, and which counted each match four times).

- [ ] **Step 1: Gate G-D** — as in Task 20 Step 1 (skip if run in the same session).

- [ ] **Step 2: Write the failing tests**

In `src/services/userService.test.ts` add inside the `describe`:

```ts
    test('getUsersPage asks the server for one page, with the search term only when given', async () => {
        const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ content: [] })
        await userService.getUsersPage({ page: 2, size: 20, q: 'ana b' })
        expect(get).toHaveBeenCalledWith('/user/findAll?page=2&size=20&q=ana+b')
        await userService.getUsersPage({ page: 0, size: 20, q: '' })
        expect(get).toHaveBeenLastCalledWith('/user/findAll?page=0&size=20')
    })

    test('the unpaged list call is gone', () => {
        expect((userService as Record<string, unknown>).getAllUsers).toBeUndefined()
    })
```

`src/components/profile/UserList.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserList } from './UserList'
import { useUsersPage, useUser } from '../../hooks/useUser'

vi.mock('../../hooks/useUser', () => ({ useUsersPage: vi.fn(), useUser: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ana' }, isAuthenticated: true }) }))
vi.mock('./UserCard', () => ({
    UserCard: ({ user }: { user: { username: string } }) => <div data-testid="user-card">{user.username}</div>,
}))

const ana = { id: 'u1', username: 'ana', eloRating: 1300, level: 2, gamesPlayed: 10 }
const bob = { id: 'u2', username: 'bob', eloRating: 1250, level: 1, gamesPlayed: 3 }
const cy = { id: 'u3', username: 'cy', eloRating: 1400, level: 4, gamesPlayed: 30 }

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({ user: ana, isLoading: false, error: null, refetch: vi.fn() } as never)
    vi.mocked(useUsersPage).mockImplementation((page: number) => ({
        data: { content: [ana, bob, cy], totalElements: 41, totalPages: 3, number: page, size: 20 },
        isLoading: false, error: null, refetch: vi.fn(),
    }) as never)
})

describe('UserList (server-side paging and search)', () => {
    test("shows the server's page without me, and the server's total", () => {
        render(<UserList />)
        expect(screen.getAllByTestId('user-card').map((el) => el.textContent)).toEqual(['bob', 'cy'])
        expect(screen.getByText('41 users found')).toBeInTheDocument()
        expect(useUsersPage).toHaveBeenCalledWith(0, '')
    })

    test('typing searches on the server after a pause', async () => {
        render(<UserList />)
        await userEvent.setup().type(screen.getByPlaceholderText('Search users by username...'), 'bo')
        await waitFor(() => expect(useUsersPage).toHaveBeenLastCalledWith(0, 'bo'))
    })

    test('Next asks the server for the next page', async () => {
        render(<UserList />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }))
        expect(useUsersPage).toHaveBeenLastCalledWith(1, '')
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    })
})
```

`src/components/admin/AdminStats.test.tsx`:

```tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminStats } from './AdminStats'

vi.mock('../../hooks/useMatch', () => ({
    useAllMatches: () => ({ matches: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], isLoading: false }),
}))
vi.mock('../../hooks/useAdmin', () => ({
    useAdmin: () => ({ users: [{ id: 'u1', deletionRequested: true }, { id: 'u2', deletionRequested: false }], isLoading: false }),
}))
vi.mock('../../hooks/useLobby', () => ({ useLobbies: () => ({ lobbies: [], isLoading: false }) }))

describe('AdminStats', () => {
    test('Total Matches counts the matches themselves', () => {
        render(<AdminStats />)
        const tile = screen.getByText('Total Matches').parentElement!
        expect(tile).toHaveTextContent('3')
        expect(screen.getByText('Total Users').parentElement!).toHaveTextContent('2')
    })
})
```

- [ ] **Step 3: Run them and watch them fail** — `npx vitest run src/services/userService.test.ts src/components/profile/UserList.test.tsx src/components/admin/AdminStats.test.tsx` → FAIL: `getUsersPage` is not a function and `getAllUsers` still exists; `useUsersPage` is never called (UserList calls `useAllUsers`); AdminStats imports `useAllUsers` (undefined from the mocked module).

- [ ] **Step 4: `src/types/common.ts`** — add after `export interface ApiResponse<T> { … }`:

```ts
/** A Spring Data page as the backend serializes it (e.g. GET /user/findAll). */
export interface Page<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    /** zero-based page index */
    number: number;
    size: number;
}
```

- [ ] **Step 5: `src/services/userService.ts`**

5a. In the type import list replace `    PaginationParams,` with

```ts
    PaginationParams,
    Page,
```

5b. Replace

```ts
    async getAllUsers(): Promise<User[]> {
        return apiClient.get<User[]>('/user/findAll');
    },
```

with

```ts
    // The server pages, sorts by username and filters on q (case-insensitive substring).
    async getUsersPage(params: { page: number; size: number; q?: string }): Promise<Page<User>> {
        const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
        if (params.q) query.set('q', params.q);
        return apiClient.get<Page<User>>(`/user/findAll?${query.toString()}`);
    },
```

- [ ] **Step 6: `src/hooks/useUser.ts`** — replace

```ts
export function useAllUsers() {
    const apiFunction = useMemo(() => () => userService.getAllUsers(), []);

    return useApi(apiFunction, {
        staleTime: 180000, // Cache for 3 minutes - leaderboard doesn't need constant updates
        immediate: true
    });
}
```

with

```ts
/** Page size of the players list; the backend clamps it to 1..100. */
export const USERS_PAGE_SIZE = 20;

export function useUsersPage(page: number, q: string) {
    const apiFunction = useMemo(
        () => () => userService.getUsersPage({ page, size: USERS_PAGE_SIZE, q }),
        [page, q]
    );

    // staleTime 0: useApi caches per hook instance, not per page, so a cached
    // page 0 would otherwise be served for page 1.
    return useApi(apiFunction, {
        immediate: true,
        dependencies: [page, q],
        staleTime: 0,
    });
}
```

- [ ] **Step 7: `src/hooks/index.ts`** — replace

```ts
export { useUser, useAllUsers, useUserHistory, useUserHistorySummary, useMe } from './useUser';
```

with

```ts
export { useUser, useUsersPage, useUserHistory, useUserHistorySummary, useMe } from './useUser';
```

- [ ] **Step 8: `src/components/profile/UserList.tsx`**

8a. Replace

```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { UserCard } from './UserCard';
import { Loading, Button, Input } from '../common';
import { useAllUsers, useUser } from '../../hooks/useUser';
```

with

```tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { UserCard } from './UserCard';
import { Loading, Button, Input } from '../common';
import { useUsersPage, useUser } from '../../hooks/useUser';
```

8b. Below the imports (before `export interface UserListProps`) add

```tsx
// The server searches; wait for a pause in typing before asking it.
const SEARCH_DEBOUNCE_MS = 300;

```

8c. Replace

```tsx
    const { data: users, isLoading, error, refetch } = useAllUsers();
```

with

```tsx
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState('');
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQuery(searchTerm.trim());
            setPage(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    const { data: usersPage, isLoading, error, refetch } = useUsersPage(page, query);
    const users = usersPage?.content;
    const totalUsers = usersPage?.totalElements ?? 0;
```

8d. Remove the client-side search (the server applies `q`) — replace

```tsx
                // Search filter with null safety
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const username = user.username?.toLowerCase() || '';
                    return username.includes(term);
                }

                return true;
```

with

```tsx
                return true;
```

and replace the memo's dependency list `}, [users, authUser?.id, searchTerm, sortBy, showOnlyOnline]);` with `}, [users, authUser?.id, sortBy, showOnlyOnline]);`

8e. Replace

```tsx
                        {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
```

with

```tsx
                        {totalUsers} {totalUsers === 1 ? 'user' : 'users'} found
```

8f. Add paging controls — replace the end of the component

```tsx
                    ))}
                </div>
            )}
        </div>
    );
};
```

with

```tsx
                    ))}
                </div>
            )}

            {usersPage && usersPage.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                    <Button
                        variant="outline"
                        size="small"
                        disabled={usersPage.number <= 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                        Previous
                    </Button>
                    <span className="text-slate-400 text-sm">
                        Page {usersPage.number + 1} of {usersPage.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="small"
                        disabled={usersPage.number + 1 >= usersPage.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
};
```

- [ ] **Step 9: `src/components/admin/AdminStats.tsx`**

9a. Replace `import { useAllUsers } from '../../hooks/useUser';` with `import { useAllMatches } from '../../hooks/useMatch';`

9b. Replace `    const { data: allUsers, isLoading: allUsersLoading } = useAllUsers();` with `    const { matches, isLoading: matchesLoading } = useAllMatches();`

9c. Replace `    if (allUsersLoading || adminUsersLoading || lobbiesLoading) {` with `    if (matchesLoading || adminUsersLoading || lobbiesLoading) {`

9d. Replace `    // Use allUsers for game stats, adminUsers for admin-specific stats` with `    // matches for game stats, adminUsers for admin-specific stats`

9e. Replace

```tsx
    const totalMatches = allUsers?.reduce((sum, user) => sum + (user.gamesPlayed || 0), 0) || 0;
```

with

```tsx
    // Count the matches themselves: summing gamesPlayed over users counted each match four
    // times, and /user/findAll is paged now.
    const totalMatches = Array.isArray(matches) ? matches.length : 0;
```

- [ ] **Step 10: Run the tests and the suite** — the three files pass; `npm test` all pass; `npx tsc -b` exit 0 (it also proves nothing else calls `useAllUsers`/`getAllUsers`); procedure L.

- [ ] **Step 11: Commit**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
git add src/types/common.ts src/services/userService.ts src/services/userService.test.ts src/hooks/useUser.ts src/hooks/index.ts src/components/profile/UserList.tsx src/components/profile/UserList.test.tsx src/components/admin/AdminStats.tsx src/components/admin/AdminStats.test.tsx
git commit -m "feat(users): page and search the players list on the server

GET /user/findAll is paged now (page, size, q; sorted by username). The
list asks for one page at a time, searches with q after a short pause, and
the admin match count reads the matches instead of summing gamesPlayed.

Consumes Meawen/stiglja lane-debt E7." -- src/types/common.ts src/services/userService.ts src/services/userService.test.ts src/hooks/useUser.ts src/hooks/index.ts src/components/profile/UserList.tsx src/components/profile/UserList.test.tsx src/components/admin/AdminStats.tsx src/components/admin/AdminStats.test.tsx
git show --stat HEAD
```

---

# Stage E — after all backend lanes have merged

### Task 22: Gameplay end-to-end against the merged backend (B9), and the final checks

**Files:** none expected (fixes found here get their own failing test, task-style commit, explicit paths).

**Interfaces:** consumes everything; produces the B9 evidence for the orchestrator's close-out (B10).

- [ ] **Step 1: All gates** — run procedure G completely; G-B, G-C and G-D must all pass.

- [ ] **Step 2: Static checks on the final branch**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
npx tsc -b --pretty false; echo "tsc exit=$?"        # expect 0
npm test 2>&1 | tail -6                               # expect every file passed
npm run build 2>&1 | tail -5; echo "build exit=$?"    # expect 0
```

Then procedure L against the Task 1 baseline (no new or increased finding in any file this plan touched).

- [ ] **Step 3: Rig at the merged trunk** — procedure R0–R5 (R3 re-checks out `lukasDev`, which now contains every lane). The backend was just started, so the signup rate-limit counters are fresh.

- [ ] **Step 4: Run the harness with email confirmation**

```bash
cd /Users/lmiholic/IdeaProjects/stiglja-lanes/frontend
PLAYWRIGHT_CORE_DIR=/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/pw/node_modules/playwright-core \
E2E_CONFIRM_EMAIL=1 \
E2E_ARTIFACTS=/Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/e2e-stage-e \
node e2e/gameplay.mjs | tee /Users/lmiholic/IdeaProjects/stiglja-lanes/logs/frontend/e2e-stage-e.json
echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`; JSON with `"ok": true`, `"confirmedEmail": true`, `"played": 8`, `uiBids` = one `Pass` and one `Call Herc`, `"gameSockets": [1, 1, 1, 1]`. The run also proved: sign-up with the inbox panel, confirmation through `/confirm-email`, exactly one STOMP socket on `/play` per tab, no `?user=` anywhere, the lobby flow with the actor-free C1 bodies, and the `{id, cardsLeft}` seats after E5. (The 10-minute ranked-queue expiry from E7 is not exercised: the harness never queues for ranked.)

On failure: screenshots and `backend.log` first, then superpowers:systematic-debugging; fix with a failing unit test first; never weaken the harness. A backend cause is reported, not fixed here. Re-running needs a backend restart (signup limit 5/hour per IP).

- [ ] **Step 5: Spot checks the harness does not cover** (same rig; record PASS/FAIL):
  1. `/users`: the list shows "N users found" from the server, Next/Previous page through it, typing part of a username narrows the list after a short pause.
  2. In the network log of a game tab, one public-view frame shows seats as `{"id": …, "cardsLeft": …}` with no `username` key (E5 on the wire).
  3. `/admin` as a non-admin → Access Denied.
  4. `/reset-password` without a token → "This link is invalid or has expired" and a "Request a new link" link.

- [ ] **Step 6: Tear down** — procedure R6.

- [ ] **Step 7: Report** — the harness JSON, each spot check, the commit list of the whole branch (`git log --oneline 88f8a3f..HEAD`), and what was **not** verified (name each item and why — at least: the 600 s ranked-queue expiry, ranked matchmaking with four verified accounts, the Trash destination if the fallback was used).

---

## Self-Review

**Spec and roadmap coverage**

| Item | Where |
|---|---|
| B1 profile me-data, no email on others' profiles | Task 2 (+ Task 18 pending address) |
| B2 request account deletion | Task 3 |
| B3 username-only search | Task 10 (dead email term), then server-side in Task 21; the old plan's Task 7 predicate is deliberately not built |
| B4 admin gating from `/user/me` | Task 4 (AuthGuard, AdminDashboard = live gate, Sidebar link) |
| B5 `?user=` / `X-Player-Name` gone, committed | Task 5; regression test in Task 7 (`stompConfig`) |
| B6 tsc, lint, suite, end-to-end | Task 10 (tsc to zero), Task 12, Task 22 |
| B7 one STOMP connection per tab | Task 7 (`gameSocket` owner, PlayPage test), Tasks 11 and 22 (harness counts sockets per tab) |
| B8 game page finished | Task 7 (protocol), Task 8 (table + route), Task 9 (lobby → game), Task 11 (runtime proof) |
| B9 four-seat gameplay vs merged backend | Task 22 (harness from Task 11) |
| B10 PR | orchestrator close-out (not a task) |
| C1 lobby bodies without actor, 403/409 in the UI | Task 13 |
| C1/C3 friend request `{toUserId}`, scoped reads, FriendshipDto | Task 14 |
| C5 password 8–72 bytes, username pattern, trimmed usernames | Task 6 (+ Task 17 reset page) |
| D8 confirm page, forgot/reset, change email + pending + resend, banner, ranked 403, rotated token + reconnect, `UserDto` fields, signup "check your inbox" | Tasks 15–19 |
| E5 `PlayerPublicInfo {id, cardsLeft}`, STOMP `playerId`, dead layout files, `/api/api`, root scripts | Task 7, Task 7, Task 10, Task 20, Task 20 |
| E7 server-side paging and search | Task 21 |

**Deliberate deviations from the stage list in the brief** (each needs no backend change and avoids editing the same lines twice): the E5 game-type and STOMP-body items moved into Task 7 and the dead layout files into Task 10 (Stage A). Task 20 only verifies them. The gameplay harness is written in Stage A (Task 11) so B8 is proven at runtime immediately; Stage E re-runs it with email confirmation as B9.

**Placeholder scan:** every code step carries the full code or an exact before/after edit; no "TBD", "similar to Task N" or "add error handling".

**Type and name consistency (checked across tasks):** `GameCard {boja, rank}`, `Boja`, `PlayerPublicInfo {id, cardsLeft}`, `PublicGameView`, `PrivateGameView` (Task 7) are what Tasks 8 and 11 use; `useBelatroGame` returns `{publicView, privateView, isConnected, connectionError, error, actions: {bidTrump, passBid, play, challenge}}` (Task 7) = what `GamePageConnected` destructures (Task 8); `gameSocket.reconnect()` (Task 7) = what `userService.changePassword` calls (Task 15); `passwordRuleError` (Task 6) = what `ResetPasswordPage` imports (Task 17); `ResendConfirmationButton` (Task 18) = what the banner renders (Task 19); `ApiError.invalidToken` (Task 15) = what `ChangePasswordForm` (Task 15) and `ChangeEmailForm` (Task 18) check; `lobbyService.leaveLobby(lobbyId)` and `useLobbies().leaveLobby(lobbyId)` (Task 13) = what `LobbyControls` calls; `useUsersPage(page, q)` (Task 21) = what `UserList` calls; the harness's selectors match the DOM produced in Tasks 8, 9, 16 and 19.

**Assumptions no spec pins (verified in code where stated):**
1. Casual lobby starts push nothing over STOMP; members find the match via `GET /lobbies/{id}` (status `CLOSED`) and `GET /matches/getmatchbylobbyid/{lobbyId}`, which answers 404 until the match is stored (code + foundation planner). Assumes lane-authz leaves `GET /lobbies/{id}` readable by members.
2. `@SubscribeMapping` on `/topic/games/{id}` and `/queue/games/{id}` never fires (not `/app` destinations), so the page asks `/app/games/{id}/refresh` until its private view arrives (code). Assumes `refresh` keeps working for participants after the hardening lanes.
3. Illegal cards and out-of-turn bids are silently ignored (no error frame); `/user/queue/errors` carries plain text only for non-participants (code).
4. STOMP JSON uses the primary ObjectMapper with default typing off, so payloads are plain JSON (code: `JacksonHttpConfig`); `Trick` serializes `plays` as a player→card map (derived from its getters, not observed on the wire).
5. `MAIL_*`/`APP_BASE_URL` env names are pinned by the email spec; that lane-email's SMTP settings accept Mailpit on :1025 without STARTTLS and with any credentials is assumed (its own tests use Mailpit).
6. 202 responses have empty bodies; the SPA no longer depends on `Content-Length`.
7. `/user/findAll` serializes `Page` flat (`content`, `totalPages`, `number`, `totalElements`, `size`) — stated by the debt spec and the lane-debt planner.
8. Changing the password closes this tab's socket too (all sessions of the user, spec §4); the SPA reconnects regardless.

**Risks / follow-ups for the report:** the animated `RealisticGameBoard` is still not live (demo only); no UI for declaring bela (`declareBela` is always false) and no feedback for an ignored illegal card; the public view has no current-player field, so only "Your turn" is shown; the lobby's Game Mode select is now inert (server forces CASUAL); ELO/Level sorting covers one page only after E7; `useApi` caches per hook instance rather than per key (pre-existing; worked around with `staleTime: 0` for the paged list, still present in `useUserHistory`); `~/.Trash` may not be writable from the agent's shell (fallback directory); the untracked copy of this plan in the main checkout must be moved before `identity-pii-frontend` is fast-forwarded there; `stiglja/CONSTELLATION.md`'s base-URL section is stale after Task 20.
