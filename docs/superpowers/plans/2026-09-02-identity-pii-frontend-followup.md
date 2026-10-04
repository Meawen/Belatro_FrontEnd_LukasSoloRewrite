# Identity/PII Frontend Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the frontend in line with the hardened backend identity/PII contract: replace the vulnerable Edit Profile screen with a Change Password modal, adopt `GET /user/me`, narrow the `User` type to the real wire contract, fix admin gating, add self-service deletion request, and remove dead impersonation-era WS parameters.

**Architecture:** Repo-conventional layers: `apiClient` (fetch wrapper) → `userService` → hooks (`useApi`/`useMutation` style) → components. New `useMe()` hook distributes `/user/me` data; no auth context is introduced. TDD with vitest + Testing Library, scoped strictly to the changed surface.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, react-router 7; new devDeps: vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom.

**Spec:** `docs/superpowers/specs/2026-08-25-identity-pii-frontend-followup-design.md` (committed as `a8c1cbc` on branch `identity-pii-frontend`). Read it first — it carries the backend contract table and the decisions.

**Working repo:** `/Users/lmiholic/IdeaProjects/Belatro_FrontEnd_LukasSoloRewrite`, branch `identity-pii-frontend`. All paths below are relative to this repo. **The session may be rooted in the backend repo — always `cd` into the frontend repo (or use absolute paths) for every command.**

## Global Constraints

- **Never `git add -A` / `git add .`** — the working tree carries the user's uncommitted game WIP (`src/App.tsx`, `src/MockComponents/RealisticGameBoard.tsx`, `src/hooks/useBelatroGame.ts`, `src/components/game/*`, `src/hooks/useGameWebSocket.ts`, several lobby/match files, plus files pre-staged in the index). Stage only the explicit paths each task lists. After each commit, run `git show --stat HEAD` and verify ONLY the listed paths are in it.
- **`git commit` commits the whole index.** Because the user has files pre-staged, always commit with pathspecs: `git commit -m "..." -- <path1> <path2>`.
- **Backend repo (`/Users/lmiholic/IdeaProjects/Belatro/belatro-backend`) is read-only.** If a backend change seems needed, stop and report.
- **`useGameWebSocket.ts`:** the `Authorization: Bearer` connect header and the `login` connect header must not change (the backend consumes both). Never reintroduce `?user=` — it was the impersonation hole. This file is uncommitted user WIP: **edit it but never commit it** (Task 9).
- New password minimum length is **6 characters** (mirrors `SignupForm`).
- Backend error bodies are `{"error": "..."}`; success on password change and request-forget is body-less (204 / 202).
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- TypeScript baseline may already be red from user WIP — compare against the baseline captured in Task 1; fix only errors our changes introduce (plus the stale-field reads this plan targets).

## File structure (what exists / what changes)

| File | Action | Responsibility after this plan |
|---|---|---|
| `vitest.config.ts`, `src/test/setup.ts` | create | test runner config + jest-dom setup |
| `src/services/api.ts` | modify | + `errorData.error` parsing; + per-request `keepTokenOn401` |
| `src/types/user.ts` | modify | `User` = real `UserSummaryDto` shape; drop `UserUpdateDTO`; add `ChangePasswordRequest` |
| `src/services/userService.ts` | modify | drop `updateUser`/`deleteUser`; add `getMe`/`changePassword`; repoint `requestForget` |
| `src/hooks/useUser.ts` | modify | drop update/delete mutations; add `useMe(enabled)` |
| `src/hooks/index.ts` | modify | export `useMe` |
| `src/components/profile/ChangePasswordForm.tsx` | create | the new modal body |
| `src/components/profile/EditProfile.tsx` | **delete** | — |
| `src/components/profile/UserProfile.tsx` | modify | modal swap, me-data, deletion request, drop stale tiles |
| `src/components/profile/ProfileStats.tsx` | modify | me-data prop; drop XP/lastLogin UI |
| `src/components/profile/userSearch.ts` | create | pure search predicate |
| `src/components/profile/UserList.tsx` | modify | username-only search |
| `src/components/profile/index.ts` | modify | barrel swap |
| `src/components/auth/AuthGuard.tsx` | modify | admin check via `useMe` |
| `src/components/admin/AdminDashboard.tsx` | modify | admin check via `useMe` |
| `src/hooks/useGameWebSocket.ts` | modify, **no commit** | remove `?user=` + `X-Player-Name` only |

---

### Task 1: Test infrastructure + plan/baseline bookkeeping

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/test/smoke.test.tsx`, `docs/superpowers/plans/2026-09-02-identity-pii-frontend-followup.md`
- Modify: `package.json` (test script + devDeps), `package-lock.json` (generated)

**Interfaces:**
- Produces: `npm test` runs vitest (jsdom, globals on, jest-dom matchers loaded). All later tasks rely on it.

- [ ] **Step 1: Copy this plan into the repo** at `docs/superpowers/plans/2026-09-02-identity-pii-frontend-followup.md` (verbatim).

- [ ] **Step 2: Capture the TypeScript baseline** (errors that pre-date this work, if any):

```bash
cd /Users/lmiholic/IdeaProjects/Belatro_FrontEnd_LukasSoloRewrite
npx tsc -b --pretty false > /tmp/belatro-fe-tsc-baseline.txt 2>&1; echo "exit=$?"
```

Record the error list (may be empty). Later tasks compare against this file, not against zero.

- [ ] **Step 3: Install test devDependencies**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

If npm reports a peer conflict between vitest and vite@7, install the newest vitest major that lists `vite@^7` as a peer (check with `npm info vitest peerDependencies`).

- [ ] **Step 4: Add the test script** to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 5: Create `vitest.config.ts`** (deliberately standalone — does not import `vite.config.ts`, so the proxy/sockjs settings stay out of tests):

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 6: Create `src/test/setup.ts`**:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 7: Create `src/test/smoke.test.tsx`** to prove the runner + jsdom + RTL wiring:

```tsx
import { render, screen } from '@testing-library/react'

test('vitest + jsdom + RTL are wired', () => {
    render(<div>belatro-test-infra</div>)
    expect(screen.getByText('belatro-test-infra')).toBeInTheDocument()
})
```

- [ ] **Step 8: Run it**: `npm test` → expect 1 passed.

- [ ] **Step 9: Commit (explicit paths only)**:

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts src/test/smoke.test.tsx docs/superpowers/plans/2026-09-02-identity-pii-frontend-followup.md
git commit -m "test: add vitest + testing-library infrastructure

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- package.json package-lock.json vitest.config.ts src/test/setup.ts src/test/smoke.test.tsx docs/superpowers/plans/2026-09-02-identity-pii-frontend-followup.md
git show --stat HEAD   # verify ONLY these 6 paths
```

---

### Task 2: apiClient — `{"error"}` bodies and `keepTokenOn401`

**Files:**
- Modify: `src/services/api.ts` (request/post methods, lines ~39-117)
- Test: `src/services/api.test.ts`

**Interfaces:**
- Produces: `apiClient.post<T>(endpoint, data?, behavior?: { keepTokenOn401?: boolean })`; `request` gains the same optional third param. Error messages now come from `errorData.message || errorData.error || fallback`. Task 3's `changePassword` relies on `keepTokenOn401`.

- [ ] **Step 1: Write failing tests** in `src/services/api.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiClient, ApiError } from './api'

function fakeResponse(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: `status-${status}`,
        headers: { get: () => null },
        json: () => Promise.resolve(body),
    } as unknown as Response
}

describe('apiClient error handling', () => {
    beforeEach(() => localStorage.setItem('authToken', 'tok-123'))
    afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

    test('surfaces the backend {"error"} body as the ApiError message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(409, { error: 'Username or email is already taken' })))
        await expect(apiClient.get('/x')).rejects.toMatchObject({
            name: 'ApiError', status: 409, message: 'Username or email is already taken',
        })
    })

    test('prefers "message" over "error" when both exist', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(400, { message: 'from-message', error: 'from-error' })))
        await expect(apiClient.get('/x')).rejects.toMatchObject({ message: 'from-message' })
    })

    test('401 clears the token by default', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'nope' })))
        await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError)
        expect(localStorage.getItem('authToken')).toBeNull()
    })

    test('401 keeps the token when keepTokenOn401 is set', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { error: 'Invalid current password' })))
        await expect(apiClient.post('/user/me/password', { a: 1 }, { keepTokenOn401: true }))
            .rejects.toMatchObject({ status: 401, message: 'Invalid current password' })
        expect(localStorage.getItem('authToken')).toBe('tok-123')
    })
})
```

- [ ] **Step 2: Run** `npm test -- src/services/api.test.ts` → expect FAIL (post takes 2 args today; `error` field not surfaced; 3rd test may pass — that's fine, it pins existing behaviour).

- [ ] **Step 3: Implement.** In `src/services/api.ts`:

`request` signature (line ~39):

```ts
async request<T>(
    endpoint: string,
    options: RequestInit = {},
    behavior: { keepTokenOn401?: boolean } = {}
): Promise<T> {
```

In the `!response.ok` branch replace the 401 handling and message line:

```ts
// If it's a 401, clear the token as it might be expired
if (response.status === 401 && !behavior.keepTokenOn401) {
    this.clearToken();
}

throw new ApiError({
    message: errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`,
    status: response.status,
});
```

`post` (line ~112):

```ts
async post<T>(endpoint: string, data?: any, behavior?: { keepTokenOn401?: boolean }): Promise<T> {
    return this.request<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    }, behavior);
}
```

Leave `get`/`put`/`patch`/`delete` and the console.log noise untouched (surgical change).

- [ ] **Step 4: Run** `npm test -- src/services/api.test.ts` → all 4 PASS.

- [ ] **Step 5: Commit**:

```bash
git add src/services/api.ts src/services/api.test.ts
git commit -m "fix(api): surface {\"error\"} bodies and allow keeping the token on 401

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/services/api.ts src/services/api.test.ts
git show --stat HEAD
```

---

### Task 3: Types + userService + hooks aligned to the hardened contract

**Files:**
- Modify: `src/types/user.ts`, `src/types/index.ts` (only if it names exports individually), `src/services/userService.ts`, `src/hooks/useUser.ts`, `src/hooks/index.ts`
- Test: `src/services/userService.test.ts`

**Interfaces:**
- Consumes: `apiClient.post(endpoint, data?, { keepTokenOn401 })` from Task 2.
- Produces (later tasks use these exact names):
  - `User` = `{id, username, eloRating, level, gamesPlayed}` (all `| null`)
  - `UserDto` unchanged; `ChangePasswordRequest = {currentPassword: string; newPassword: string}`
  - `userService.getMe(): Promise<UserDto>`; `userService.changePassword(req: ChangePasswordRequest): Promise<void>`; `userService.requestForget(): Promise<void>` (no id arg)
  - `useMe(enabled?: boolean)` → the `useApi` result object (`{data, isLoading, error, refetch, ...}`)
- **Known state:** `npx tsc -b` WILL be broken after this task (EditProfile/UserProfile/ProfileStats/UserList still read removed fields). That is intended — Tasks 4–8 fix each site; Task 10 verifies the sweep is complete. `npm test` must stay green.

- [ ] **Step 1: Write failing tests** in `src/services/userService.test.ts`:

```ts
import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient } from './api'
import { userService } from './userService'

afterEach(() => vi.restoreAllMocks())

describe('userService hardened contract', () => {
    test('getMe calls GET /user/me', async () => {
        const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ id: '1' })
        await userService.getMe()
        expect(get).toHaveBeenCalledWith('/user/me')
    })

    test('changePassword posts to /user/me/password and keeps the token on 401', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.changePassword({ currentPassword: 'old', newPassword: 'newpass' })
        expect(post).toHaveBeenCalledWith(
            '/user/me/password',
            { currentPassword: 'old', newPassword: 'newpass' },
            { keepTokenOn401: true },
        )
    })

    test('requestForget posts to /user/me/request-forget with no id', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
        await userService.requestForget()
        expect(post).toHaveBeenCalledWith('/user/me/request-forget')
    })

    test('the removed write endpoints are gone from the service', () => {
        expect((userService as Record<string, unknown>).updateUser).toBeUndefined()
        expect((userService as Record<string, unknown>).deleteUser).toBeUndefined()
    })
})
```

- [ ] **Step 2: Run** `npm test -- src/services/userService.test.ts` → FAIL (getMe/changePassword undefined, etc.).

- [ ] **Step 3: Rewrite `src/types/user.ts`.** Final content of the changed interfaces (keep `UserSimpleDTO`, `UserDto`, `PlayerMatchSummaryDTO`, `PlayerMatchHistoryDTO` exactly as they are; keep the `Role, Instant` import):

```ts
export interface User {
    id: string | null;
    username: string | null;
    eloRating: number | null;
    level: number | null;
    gamesPlayed: number | null;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}
```

Delete `UserUpdateDTO` entirely, and delete the removed `User` fields (`email`, `passwordHashed`, `expPoints`, `lastLogin`, `roles`, `deletionRequested`). Check `src/types/index.ts`: if it re-exports `* from './user'`, no change; if it names `UserUpdateDTO`, remove that name and add `ChangePasswordRequest`.

- [ ] **Step 4: Rewrite `src/services/userService.ts` methods.** Delete `updateUser` and `deleteUser`. Replace `requestForget` and add the two new methods:

```ts
async getMe(): Promise<UserDto> {
    return apiClient.get<UserDto>('/user/me');
},

async changePassword(request: ChangePasswordRequest): Promise<void> {
    await apiClient.post<void>('/user/me/password', request, { keepTokenOn401: true });
},

async requestForget(): Promise<void> {
    await apiClient.post<void>('/user/me/request-forget');
},
```

Fix the type imports at the top: drop `UserUpdateDTO` and `Void` if now unused; add `UserDto`, `ChangePasswordRequest`.

- [ ] **Step 5: Update `src/hooks/useUser.ts`.** Inside `useUser`: delete `updateMutation`, `deleteMutation`, `updateUser`, `deleteUser` and their entries in the return object (keep `user`, `isLoading`, `error`, `refetch`). Drop the now-unused `useMutation`, `useCallback`, and `UserUpdateDTO` imports. Add at the bottom of the file:

```ts
export function useMe(enabled: boolean = true) {
    const apiFunction = useMemo(() => () => userService.getMe(), []);
    return useApi(apiFunction, {
        immediate: enabled,
        dependencies: [enabled],
        staleTime: 60000,
    });
}
```

(Read `src/hooks/useApi.ts` before wiring: `immediate` must be honored on dependency changes too — i.e. flipping `enabled` from false→true triggers the fetch, and `enabled: false` must never fetch. If `useApi` only reads `immediate` on mount, guard inside the api function instead: `if (!enabled) return Promise.reject(...)` is NOT acceptable — instead pass `immediate: enabled` AND verify behaviour in Task 8's AuthGuard tests, adjusting `useMe` if they fail.)

- [ ] **Step 6: Export it** — in `src/hooks/index.ts` line 3: `export { useUser, useAllUsers, useUserHistory, useUserHistorySummary, useMe } from './useUser';`

- [ ] **Step 7: Run** `npm test` → userService tests PASS, api + smoke tests still PASS. (`tsc` is expectedly broken — do not chase it.)

- [ ] **Step 8: Commit**:

```bash
git add src/types/user.ts src/services/userService.ts src/services/userService.test.ts src/hooks/useUser.ts src/hooks/index.ts
# plus src/types/index.ts ONLY if edited
git commit -m "feat(user): align types, service and hooks with the hardened backend contract

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/types/user.ts src/services/userService.ts src/services/userService.test.ts src/hooks/useUser.ts src/hooks/index.ts
git show --stat HEAD
```

---

### Task 4: ChangePasswordForm replaces EditProfile

**Files:**
- Create: `src/components/profile/ChangePasswordForm.tsx`
- Delete: `src/components/profile/EditProfile.tsx`
- Modify: `src/components/profile/index.ts`, `src/components/profile/UserProfile.tsx` (modal block ~lines 127-139 and 241-257 only)
- Test: `src/components/profile/ChangePasswordForm.test.tsx`

**Interfaces:**
- Consumes: `userService.changePassword`, `ChangePasswordRequest`, `useMutation` (from `../../hooks/useApi` directly), `ApiError` (from `../../services/api`), `Button, Input` (from `../common`).
- Produces: `<ChangePasswordForm onSuccess={() => void} onCancel={() => void} />` — no `user` prop.

- [ ] **Step 1: Write failing tests** in `src/components/profile/ChangePasswordForm.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangePasswordForm } from './ChangePasswordForm'
import { userService } from '../../services/userService'
import { ApiError } from '../../services/api'

vi.mock('../../services/userService', () => ({
    userService: { changePassword: vi.fn() },
}))
const changePassword = vi.mocked(userService.changePassword)

function setup() {
    const onSuccess = vi.fn()
    const onCancel = vi.fn()
    render(<ChangePasswordForm onSuccess={onSuccess} onCancel={onCancel} />)
    return { onSuccess, onCancel }
}

beforeEach(() => vi.clearAllMocks())

describe('ChangePasswordForm', () => {
    test('validates required fields, length and confirmation', async () => {
        const user = userEvent.setup()
        const { onSuccess } = setup()
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(screen.getByText('Current password is required')).toBeInTheDocument()
        expect(screen.getByText('New password is required')).toBeInTheDocument()

        await user.type(screen.getByLabelText(/current password/i), 'old-secret')
        await user.type(screen.getByLabelText(/^new password/i), 'short')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()

        await user.type(screen.getByLabelText(/^new password/i), '-enough')
        await user.type(screen.getByLabelText(/confirm new password/i), 'different')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()

        expect(changePassword).not.toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
    })

    test('submits current and new password, then calls onSuccess', async () => {
        const user = userEvent.setup()
        changePassword.mockResolvedValue(undefined)
        const { onSuccess } = setup()
        await user.type(screen.getByLabelText(/current password/i), 'old-secret')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'old-secret', newPassword: 'new-secret' })
        expect(onSuccess).toHaveBeenCalled()
    })

    test('a 401 shows "Current password is incorrect" and does not close', async () => {
        const user = userEvent.setup()
        changePassword.mockRejectedValue(new ApiError({ message: 'Invalid current password', status: 401 }))
        const { onSuccess } = setup()
        await user.type(screen.getByLabelText(/current password/i), 'wrong')
        await user.type(screen.getByLabelText(/^new password/i), 'new-secret')
        await user.type(screen.getByLabelText(/confirm new password/i), 'new-secret')
        await user.click(screen.getByRole('button', { name: /change password/i }))
        expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
        expect(onSuccess).not.toHaveBeenCalled()
    })
})
```

Note: `getByLabelText` requires the common `Input` to associate label↔input. Read `src/components/common/Input.tsx` first; if it doesn't render an htmlFor/id pair, query by placeholder instead (`getByPlaceholderText('Enter current password...')` etc.) and keep the placeholders below in sync.

- [ ] **Step 2: Run** `npm test -- ChangePasswordForm` → FAIL (module doesn't exist).

- [ ] **Step 3: Create `src/components/profile/ChangePasswordForm.tsx`** (styling copied from EditProfile's form so the modal looks unchanged):

```tsx
import React, { useState } from 'react';
import { Button, Input } from '../common';
// direct module import (not the ../../hooks barrel): keeps component tests from
// loading every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { ApiError } from '../../services/api';
import type { ChangePasswordRequest } from '../../types/user';

export interface ChangePasswordFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

interface ChangePasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onSuccess, onCancel }) => {
    const [formData, setFormData] = useState<ChangePasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const changePasswordMutation = useMutation((request: ChangePasswordRequest) =>
        userService.changePassword(request)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        if (!formData.currentPassword) {
            newErrors.currentPassword = 'Current password is required';
        }
        if (!formData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (formData.newPassword.length < 6) {
            newErrors.newPassword = 'Password must be at least 6 characters';
        }
        if (formData.confirmPassword !== formData.newPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            await changePasswordMutation.mutate({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            });
            onSuccess();
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                setErrors({ submit: 'Current password is incorrect' });
            } else {
                setErrors({
                    submit: error instanceof Error ? error.message : 'Failed to change password'
                });
            }
        }
    };

    const handleChange = (field: keyof ChangePasswordFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Input
                label="Current Password"
                type="password"
                value={formData.currentPassword}
                onChange={(e) => handleChange('currentPassword', e.target.value)}
                error={errors.currentPassword}
                placeholder="Enter current password..."
                required
            />
            <Input
                label="New Password"
                type="password"
                value={formData.newPassword}
                onChange={(e) => handleChange('newPassword', e.target.value)}
                error={errors.newPassword}
                placeholder="Enter new password..."
                required
            />
            <Input
                label="Confirm New Password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                placeholder="Repeat new password..."
                required
            />

            {errors.submit && (
                <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {errors.submit}
                </div>
            )}

            <div className="flex gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={changePasswordMutation.isLoading}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={changePasswordMutation.isLoading}
                    isLoading={changePasswordMutation.isLoading}
                    className="flex-1"
                >
                    Change Password
                </Button>
            </div>
        </form>
    );
};
```

- [ ] **Step 4: Swap it into `UserProfile.tsx`:**
  - Import: `import { ChangePasswordForm } from './ChangePasswordForm';` (drop the `EditProfile` import).
  - Header button (~line 137): text `Edit Profile` → `Change Password` (keep the svg/styling).
  - Modal block (~lines 241-257): `title="Edit Profile"` → `title="Change Password"`, and the body becomes:

```tsx
<ChangePasswordForm
    onSuccess={() => setShowEditProfile(false)}
    onCancel={() => setShowEditProfile(false)}
/>
```

(The `refetch()` call is dropped — a password change alters no displayed data. Renaming the `showEditProfile` state is optional; if renamed, use `showChangePassword` consistently.)

- [ ] **Step 5: Delete `src/components/profile/EditProfile.tsx`** and update the barrel `src/components/profile/index.ts` line 2 to `export { ChangePasswordForm } from './ChangePasswordForm';`

- [ ] **Step 6: Run** `npm test` → ChangePasswordForm tests PASS, all prior tests PASS.

- [ ] **Step 7: Commit**:

```bash
git add src/components/profile/ChangePasswordForm.tsx src/components/profile/ChangePasswordForm.test.tsx src/components/profile/index.ts src/components/profile/UserProfile.tsx
git rm src/components/profile/EditProfile.tsx
git commit -m "feat(profile): replace Edit Profile with a Change Password modal

The old form was the client side of the PUT /user/{id} mass-assignment
hole; username is now immutable and email has no write path.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/components/profile/ChangePasswordForm.tsx src/components/profile/ChangePasswordForm.test.tsx src/components/profile/index.ts src/components/profile/UserProfile.tsx src/components/profile/EditProfile.tsx
git show --stat HEAD
```

---

### Task 5: Me-data in UserProfile + ProfileStats rewrite

**Files:**
- Modify: `src/components/profile/UserProfile.tsx`, `src/components/profile/ProfileStats.tsx`
- Test: `src/components/profile/ProfileStats.test.tsx`

**Interfaces:**
- Consumes: `useMe(enabled)` from Task 3 (returns `{data, isLoading, error, refetch}`), `UserDto`.
- Produces: `ProfileStatsProps = { user: User; me?: UserDto | null }` (the `isOwnProfile` prop is removed — it was declared but never used). Task 6 reuses `me`/`refetch` in UserProfile.

- [ ] **Step 1: Write failing tests** in `src/components/profile/ProfileStats.test.tsx`:

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileStats } from './ProfileStats'
import type { User, UserDto } from '../../types/user'

const player: User = { id: 'u1', username: 'ana', eloRating: 1450, level: 3, gamesPlayed: 42 }
const me: UserDto = { id: 'u1', username: 'ana', email: 'ana@example.com', roles: ['ROLE_ADMIN'], deletionRequested: false }

describe('ProfileStats', () => {
    test('someone else\'s profile shows stats but no email or roles', () => {
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
})
```

(If `Role` in `src/types/common.ts` is not a plain string union, adjust the `roles: ['ROLE_ADMIN']` literal to match its shape.)

- [ ] **Step 2: Run** `npm test -- ProfileStats` → FAIL (prop shape mismatch; email always rendered from `user`).

- [ ] **Step 3: Rewrite `ProfileStats.tsx`:**
  - Props: `export interface ProfileStatsProps { user: User; me?: UserDto | null }`, destructure `({ user, me })`; import `UserDto` type.
  - Delete `const expPoints = user.expPoints || 0;`.
  - Delete the "Experience Points" stat tile and change that grid to `lg:grid-cols-3`.
  - Delete the entire "Level Progress" (`Experience Progress`) card, plus the now-unused helpers `getExpRequiredForNextLevel` and `getLevelProgress`.
  - Account Information card: email block becomes conditional on `me` and reads `me.email`; delete the `user.lastLogin` block; the roles block becomes conditional on `me?.roles` and maps over `me.roles`.

- [ ] **Step 4: Update `UserProfile.tsx`:**
  - Import `useMe` alongside `useUser`; after `isOwnProfile` is computed (move the `const isOwnProfile = ...` line up, directly under the `useAuth()` call, so it precedes the hooks that need it):

```tsx
const { data: me, refetch: refetchMe } = useMe(isOwnProfile);
```

  - Delete the XP subtext (`{displayUser.expPoints || 0} XP`, ~line 167).
  - Delete the whole "Last Seen" tile (~lines 183-196) and change that grid to `md:grid-cols-3`.
  - Header roles block (~lines 200-214): replace both `displayUser.roles` reads with `me?.roles` (renders only on own profile, where `me` exists).
  - ProfileStats call: `<ProfileStats user={displayUser} me={me ?? null} />`.

- [ ] **Step 5: Run** `npm test` → all PASS.

- [ ] **Step 6: Commit**:

```bash
git add src/components/profile/UserProfile.tsx src/components/profile/ProfileStats.tsx src/components/profile/ProfileStats.test.tsx
git commit -m "feat(profile): source email and roles from GET /user/me; drop fields the API no longer returns

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/components/profile/UserProfile.tsx src/components/profile/ProfileStats.tsx src/components/profile/ProfileStats.test.tsx
git show --stat HEAD
```

---

### Task 6: Request-account-deletion action

**Files:**
- Modify: `src/components/profile/UserProfile.tsx`
- Test: `src/components/profile/UserProfile.test.tsx`

**Interfaces:**
- Consumes: `useMe` (already wired in Task 5, incl. `refetchMe`), `userService.requestForget()`, `useMutation`.
- Produces: own-profile-only "Account" card with request → confirm → requested states.

- [ ] **Step 1: Write failing tests** in `src/components/profile/UserProfile.test.tsx` (mock every hook UserProfile imports, by its real module path):

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
        expect(refetchMe).toHaveBeenCalled()
    })

    test('an already-flagged account shows the requested state instead of the button', () => {
        vi.mocked(useMe).mockReturnValue({ data: { ...meBase, deletionRequested: true }, isLoading: false, error: null, refetch: refetchMe } as never)
        render(<UserProfile />)
        expect(screen.getByText(/deletion requested/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })

    test('someone else\'s profile has no deletion section', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false, error: null, refetch: refetchMe } as never)
        render(<UserProfile userId="u2" />)
        expect(screen.queryByRole('button', { name: /request account deletion/i })).not.toBeInTheDocument()
    })
})
```

(UserProfile's `useUser` return no longer includes `isUpdating` etc. after Task 3, so these mock shapes are complete. The `as never` casts sidestep exact hook-result typing in mocks.)

- [ ] **Step 2: Run** `npm test -- UserProfile` → FAIL (no such UI yet).

- [ ] **Step 3: Implement in `UserProfile.tsx`.** Add state + mutation near the other hooks:

```tsx
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

(imports: `useMutation` from `'../../hooks/useApi'` — the direct module, not the barrel, so the UserProfile test doesn't load unrelated hook modules; `userService` from `'../../services/userService'`.)

Render after the `{activeTab === 'stats' && ...}` block:

```tsx
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

- [ ] **Step 4: Run** `npm test` → all PASS.

- [ ] **Step 5: Commit**:

```bash
git add src/components/profile/UserProfile.tsx src/components/profile/UserProfile.test.tsx
git commit -m "feat(profile): self-service account deletion request via POST /user/me/request-forget

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/components/profile/UserProfile.tsx src/components/profile/UserProfile.test.tsx
git show --stat HEAD
```

---

### Task 7: Username-only search in UserList

**Files:**
- Create: `src/components/profile/userSearch.ts` (separate module — `eslint-plugin-react-refresh` dislikes non-component exports from component files)
- Modify: `src/components/profile/UserList.tsx` (filter block, lines ~49-55)
- Test: `src/components/profile/userSearch.test.ts`

**Interfaces:**
- Produces: `userMatchesSearch(user: User, term: string): boolean`

- [ ] **Step 1: Write failing tests** in `src/components/profile/userSearch.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { userMatchesSearch } from './userSearch'
import type { User } from '../../types/user'

const ana: User = { id: '1', username: 'AnaBelot', eloRating: null, level: null, gamesPlayed: null }

describe('userMatchesSearch', () => {
    test('matches username case-insensitively', () => {
        expect(userMatchesSearch(ana, 'anab')).toBe(true)
        expect(userMatchesSearch(ana, 'BELOT')).toBe(true)
    })
    test('empty term matches everyone', () => {
        expect(userMatchesSearch(ana, '')).toBe(true)
    })
    test('does not match on anything but username', () => {
        expect(userMatchesSearch(ana, 'ana@example.com')).toBe(false)
        expect(userMatchesSearch({ ...ana, username: null }, 'ana')).toBe(false)
    })
})
```

- [ ] **Step 2: Run** `npm test -- userSearch` → FAIL (module missing).

- [ ] **Step 3: Create `src/components/profile/userSearch.ts`:**

```ts
import type { User } from '../../types/user';

export function userMatchesSearch(user: User, term: string): boolean {
    if (!term) return true;
    return (user.username ?? '').toLowerCase().includes(term.toLowerCase());
}
```

- [ ] **Step 4: Use it in `UserList.tsx`.** Replace the search-filter block (lines ~49-55):

```ts
// Search filter with null safety
if (searchTerm) {
    return userMatchesSearch(user, searchTerm);
}
```

with `import { userMatchesSearch } from './userSearch';` at the top. Also remove the `useUser(authUser?.id...)` `currentUserFull` wiring ONLY if tsc later flags it (Task 10 decides; it reads no removed fields per exploration, so likely untouched).

- [ ] **Step 5: Run** `npm test` → all PASS.

- [ ] **Step 6: Commit**:

```bash
git add src/components/profile/userSearch.ts src/components/profile/userSearch.test.ts src/components/profile/UserList.tsx
git commit -m "fix(users): search by username only; email is no longer served by /user/findAll

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/components/profile/userSearch.ts src/components/profile/userSearch.test.ts src/components/profile/UserList.tsx
git show --stat HEAD
```

---

### Task 8: Admin gating from /user/me

**Files:**
- Modify: `src/components/auth/AuthGuard.tsx`, `src/components/admin/AdminDashboard.tsx`
- Test: `src/components/auth/AuthGuard.test.tsx`

**Interfaces:**
- Consumes: `useMe(enabled)` from the `../../hooks` barrel.
- Produces: `requireAdmin` paths and AdminDashboard gate on `me.roles` containing `'ROLE_ADMIN'`. (Note: the `/admin` route in `App.tsx` wraps only `ProtectedRoute`; **AdminDashboard's own check is the live gate** — both are fixed for consistency. `App.tsx` is user WIP: do not edit it.)

- [ ] **Step 1: Write failing tests** in `src/components/auth/AuthGuard.test.tsx`:

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
        vi.mocked(useMe).mockReturnValue({ data: { roles: ['ROLE_ADMIN'] }, isLoading: false } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.getByText('secret')).toBeInTheDocument()
    })

    test('non-admin is denied', () => {
        vi.mocked(useMe).mockReturnValue({ data: { roles: [] }, isLoading: false } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.queryByText('secret')).not.toBeInTheDocument()
        expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    })

    test('shows loading while /user/me resolves', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: true } as never)
        render(<AuthGuard requireAdmin><div>secret</div></AuthGuard>)
        expect(screen.queryByText('secret')).not.toBeInTheDocument()
    })

    test('non-admin routes never consult /user/me', () => {
        vi.mocked(useMe).mockReturnValue({ data: null, isLoading: false } as never)
        render(<AuthGuard><div>plain</div></AuthGuard>)
        expect(screen.getByText('plain')).toBeInTheDocument()
        expect(vi.mocked(useMe)).toHaveBeenCalledWith(false)
    })
})
```

(Mocking the `../../hooks` barrel: `AuthGuard` imports `useAuth` from it and will import `useMe` from it too. The `Loading` component comes from `../common` and stays real.)

- [ ] **Step 2: Run** `npm test -- AuthGuard` → FAIL (roles read from auth user, which the test doesn't provide).

- [ ] **Step 3: Rewrite `AuthGuard.tsx`'s gate:**

```tsx
import { useAuth, useMe } from '../../hooks';
...
const { isLoading, isAuthenticated } = useAuth();
const { data: me, isLoading: isMeLoading } = useMe(requireAdmin && isAuthenticated);
```

Replace the `requireAdmin` block (old line 33) with:

```tsx
if (requireAdmin) {
    if (isMeLoading || !me) {
        return <Loading size="large" text="Checking permissions..." fullScreen />;
    }
    if (!me.roles?.some(role => role === 'ROLE_ADMIN')) {
        return (
            /* keep the existing Access Denied card exactly as-is */
        );
    }
}
```

Remove the now-unused `user` from the `useAuth()` destructure. If the loading test fails because `useApi` doesn't honor `immediate` flipping false→true on dependency change, fix `useMe` in `src/hooks/useUser.ts` (not `useApi` — don't widen the blast radius) so `enabled` gates the fetch correctly, and re-run all tests.

- [ ] **Step 4: Rewrite `AdminDashboard.tsx`'s check:**

```tsx
import { useMe } from '../../hooks';
...
const { data: me, isLoading } = useMe();
const isAdmin = me?.roles?.includes('ROLE_ADMIN') ?? false;

if (isLoading) {
    return <Loading size="large" text="Checking permissions..." />;
}
if (!isAdmin) { /* keep the existing Access Denied card */ }
```

Add the `Loading` import from `'../common'`; drop the `useAuth` import (no longer used).

- [ ] **Step 5: Run** `npm test` → all PASS.

- [ ] **Step 6: Commit**:

```bash
git add src/components/auth/AuthGuard.tsx src/components/auth/AuthGuard.test.tsx src/components/admin/AdminDashboard.tsx
git commit -m "fix(admin): gate on roles from GET /user/me; the auth-context user never had roles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/components/auth/AuthGuard.tsx src/components/auth/AuthGuard.test.tsx src/components/admin/AdminDashboard.tsx
git show --stat HEAD
```

---

### Task 9: WebSocket tidy — edit only, DO NOT COMMIT

`src/hooks/useGameWebSocket.ts` is heavily-rewritten **uncommitted user WIP** (~700 changed lines). Committing it would sweep that WIP into our history, so this task edits the file and leaves it uncommitted — the user will commit it with their own work.

**Files:**
- Modify (no commit): `src/hooks/useGameWebSocket.ts`

- [ ] **Step 1: Remove the dead `?user=`** — in the `webSocketFactory` (line ~156), replace:

```ts
const base = optionsRef.current.wsPath || '/ws';
const wsUrl = user?.username ? `${base}?user=${encodeURIComponent(user.username)}` : base;
const sock = new SockJS(wsUrl);
```

with:

```ts
const base = optionsRef.current.wsPath || '/ws';
const sock = new SockJS(base);
```

- [ ] **Step 2: Remove the dead `X-Player-Name` header** — in `connectHeaders` (line ~163), delete ONLY the line `headers['X-Player-Name'] = user.username;`. **Keep** `headers['login']`, `headers['Authorization']`, and `headers['auth-token']` exactly as they are — `login` and `Authorization` are consumed by the backend's CONNECT handling.

- [ ] **Step 3: Verify the file still compiles in isolation**: `npx tsc -b --pretty false 2>&1 | grep useGameWebSocket` → expect no output (other files' errors are handled in Task 10).

- [ ] **Step 4: Do NOT commit.** Run `git status --short src/hooks/useGameWebSocket.ts` → must still show ` M`. State in the task report that this file was edited but deliberately left uncommitted.

---

### Task 10: tsc sweep, lint, full suite, end-to-end verification

**Files:**
- Possibly modify (minimal type-level fixes only): `src/components/layout/UserDropdown.tsx`, `src/components/layout/MainLayout.tsx`, `src/components/layout/Header.tsx`, `src/components/profile/UserCard.tsx`, `src/components/profile/FriendList.tsx`, `src/components/profile/UserList.tsx` — whatever `tsc` flags for reading fields removed from `User`.

- [ ] **Step 1: Run the type check**: `npx tsc -b --pretty false > /tmp/belatro-fe-tsc-after.txt 2>&1; echo "exit=$?"` then diff against `/tmp/belatro-fe-tsc-baseline.txt`. Fix only NEW errors. Expected stragglers are reads of removed `User` fields in the dead-but-compiled layout components (`UserDropdown.tsx:64` email, `MainLayout.tsx:31` roles, possibly `Header.tsx`): make the **minimal** edit (delete the offending expression/element), do not delete files, do not refactor. If a file with new errors is part of the user's uncommitted WIP (check `git status`), fix the error but do not commit that file — list it in the report instead.

- [ ] **Step 2: Run lint**: `npm run lint` — fix new warnings/errors in files this plan touched; leave pre-existing ones elsewhere.

- [ ] **Step 3: Run the full suite**: `npm test` → everything green.

- [ ] **Step 4: Commit the sweep** (only non-WIP files you actually edited in this task; example):

```bash
git add src/components/layout/UserDropdown.tsx src/components/layout/MainLayout.tsx
git commit -m "chore: drop reads of User fields the API no longer returns (tsc sweep)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/components/layout/UserDropdown.tsx src/components/layout/MainLayout.tsx
git show --stat HEAD
```

- [ ] **Step 5: Manual end-to-end click-through** against the hardened backend. Start the backend (`cd /Users/lmiholic/IdeaProjects/Belatro/belatro-backend && JAVA_HOME=$(/usr/libexec/java_home -v 23) ./gradlew bootRun` — branch `lukasDev`, needs `.env` and Docker for Mongo/Redis) and the frontend (`npm run dev`). Walk the checklist — with browser automation if available, otherwise hand it to the user:
  1. Log in → profile shows username, ELO, level, games; **own** profile shows email under Account Information.
  2. "Change Password" → wrong current password → inline "Current password is incorrect", still logged in (navigate somewhere to confirm).
  3. Change password with the correct current one → 204, modal closes → log out, log back in with the new password.
  4. Someone else's profile (`/profile/:userId`) → no email, no roles, no deletion section.
  5. `/users` search by username works.
  6. "Request account deletion" → confirm → "Deletion requested" state persists on refresh.
  7. `/admin` as a non-admin → Access Denied; as an `ADMIN_USERNAMES` admin → dashboard loads and user list shows emails.
  8. Start/join a game → WebSocket connects (JWT CONNECT auth), no `?user=` in the SockJS URL (check the network tab).

- [ ] **Step 6: Report.** State plainly: what was verified (tests, tsc diff vs baseline, lint, click-through results) and what was **not** (anything skipped in step 5 — name each), that `useGameWebSocket.ts` (and any step-1 WIP files) were edited but left uncommitted, and that the dead layout components were minimally patched, not revived.

---

## Verification summary (Definition of Done)

1. `npm test` green (infra smoke, api, userService, ChangePasswordForm, ProfileStats, UserProfile, userSearch, AuthGuard).
2. `npx tsc -b` introduces no new errors vs the Task 1 baseline.
3. `npm run lint` introduces no new findings in touched files.
4. Manual click-through checklist executed; every skipped item named in the final report.
5. Every commit contains only its listed paths (`git show --stat` checked each time); user WIP untouched and uncommitted.
6. `git log` shows one commit per task (Tasks 1–8, 10) on `identity-pii-frontend`.

## Out of scope (do not touch)

Dead components beyond minimal type fixes (`Header`/`UserDropdown`/`MainLayout`), root `test-*.cjs` scripts, the dev `/api/api/auth` double-prefix quirk, `playerId` in STOMP bodies, email editing (backend Spec 2), the backend repo, and the user's uncommitted game WIP.
