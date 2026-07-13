# Dashboard Sidebar + Header Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, role-visible, grouped sidebar and a minimal header to the dashboard, wired into the existing `_authed` layout, with placeholder pages for every V1 feature route.

**Architecture:** A new `AppShell` (Sidebar + Header + page content) plugs into the existing `_authed.tsx` guard layout, so every authed route gets it automatically. `Sidebar` and `Header` both read from one shared `nav-config.ts` — the single source of truth for nav labels, routes, icons, and role visibility — so no label/route string is duplicated between the two.

**Tech Stack:** React 18, TanStack Router (file-based), Tailwind v3 + shadcn/ui (new-york/Slate, matching the existing design-system foundation), `lucide-react` (new), 3 new shadcn primitives (`DropdownMenu`, `Avatar`, `Separator`).

## Global Constraints

- Role-based nav visibility only (`admin` | `teacher`) — no per-feature permission-key registry.
- Full navigation now: every V1 feature group is in the sidebar from day one, each linking to a real route that renders a shared "Coming soon" placeholder until built.
- Header contains only a page title (left) and a user menu (right) — no search, no notifications.
- JWT `SessionClaims` gains `name: string` (backend `signSessionToken`/`login()` + dashboard's decoded claims type) — no other change to token expiry or session logic.
- New shadcn primitives added the same way as the previous round (editable source in `src/components/ui/`, matching `components.json`'s existing new-york/Slate/CSS-variables config).
- Desktop-first — no mobile responsive collapse/hamburger in this round.
- No duplicated code: one shared placeholder-page component for all 8 new routes; `nav-config.ts` is the single source of truth consumed by both `Sidebar` and `Header`.

---

## Task 1: Add `name` to JWT claims (backend)

**Files:**
- Modify: `backend/packages/shared/src/jwt.ts`
- Modify: `backend/packages/shared/src/jwt.test.ts`
- Modify: `backend/identity/src/login.ts`
- Modify: `backend/identity/tests/login.test.ts`
- Modify: `backend/authorizer/tests/handler.test.ts`

**Interfaces:**
- Produces: `SessionClaims { userId: number; role: string; sessionId: number; name: string }` (from `@classes-hub/shared`); `signSessionToken(claims: SessionClaims): string` (same signature, `name` now required); `login(input: LoginInput): Promise<LoginResult>` (unchanged signature — `name` is now included in the signed token internally).

- [ ] **Step 1: Update the JWT round-trip test to expect `name`**

In `backend/packages/shared/src/jwt.test.ts`, replace the `'round-trips claims through sign and verify'` test:

```ts
  it('round-trips claims through sign and verify', () => {
    const token = signSessionToken({ userId: 1, role: 'admin', sessionId: 2, name: 'Asha Admin' });
    const claims = verifySessionToken(token);
    expect(claims.userId).toBe(1);
    expect(claims.role).toBe('admin');
    expect(claims.sessionId).toBe(2);
    expect(claims.name).toBe('Asha Admin');
  });
```

Leave the other two tests in that file (`'rejects a token signed with a different secret'`, `'rejects a token signed with a different algorithm'`) unchanged — they call `jwtLib.sign` directly, not `signSessionToken`, and only assert `.toThrow()`.

- [ ] **Step 2: Run typecheck to verify it fails**

Run (from `backend/packages/shared`): `npx tsc --noEmit`
Expected: FAIL — `Object literal may only specify known properties, and 'name' does not exist in type 'SessionClaims'` at `src/jwt.test.ts` (the interface doesn't have `name` yet).

- [ ] **Step 3: Add `name` to `SessionClaims`**

In `backend/packages/shared/src/jwt.ts`, change:
```ts
export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
}
```
to:
```ts
export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
  name: string;
}
```

- [ ] **Step 4: Include `name` in `login()`**

In `backend/identity/src/login.ts`, change line 79 from:
```ts
    'SELECT id, role, password_hash FROM users WHERE email = $1',
```
to:
```ts
    'SELECT id, role, name, password_hash FROM users WHERE email = $1',
```

And change line 93 from:
```ts
  const token = signSessionToken({ userId: user.id, role: user.role, sessionId });
```
to:
```ts
  const token = signSessionToken({ userId: user.id, role: user.role, sessionId, name: user.name });
```

- [ ] **Step 5: Update the other tests that construct `SessionClaims`/JWTs directly**

In `backend/identity/tests/login.test.ts`, in the `'returns a valid JWT for correct credentials'` test, add a `name` assertion (the seeded user in `beforeEach` has `name: 'Test Teacher'`):
```ts
  it('returns a valid JWT for correct credentials', async () => {
    const result = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const claims = verifySessionToken(result.token);
    expect(claims.userId).toBe(userId);
    expect(claims.role).toBe('teacher');
    expect(claims.name).toBe('Test Teacher');
  });
```

In `backend/authorizer/tests/handler.test.ts`, both `signSessionToken({ userId, role: 'admin', sessionId })` calls need a `name` field added (the seeded user in `beforeEach` has `name: 'Admin'`). Change:
```ts
    const token = signSessionToken({ userId, role: 'admin', sessionId });
```
(both occurrences, in `'allows a valid token with an active session'` and `'rejects a token whose session has been deactivated'`) to:
```ts
    const token = signSessionToken({ userId, role: 'admin', sessionId, name: 'Admin' });
```

- [ ] **Step 6: Run typecheck to verify it passes**

Run:
```bash
cd backend/packages/shared && npx tsc --noEmit
cd ../../identity && npx tsc --noEmit
cd ../authorizer && npx tsc --noEmit
```
Expected: all three clean, no errors.

- [ ] **Step 7: Run the full backend test suite**

Run (from `backend/`): `export $(cat .env | xargs) && npm test`
Expected: all suites pass (shared/jwt, identity/login, identity/handler, authorizer/handler) — same test counts as before, with the strengthened assertions passing.

- [ ] **Step 8: Commit**

```bash
git add backend/packages/shared/src/jwt.ts backend/packages/shared/src/jwt.test.ts backend/identity/src/login.ts backend/identity/tests/login.test.ts backend/authorizer/tests/handler.test.ts
git commit -m "feat(backend): add name to JWT session claims"
```

---

## Task 2: Nav config + new shadcn primitives

**Files:**
- Create: `dashboard/src/lib/nav-config.ts`
- Modify: `dashboard/package.json`
- Create: `dashboard/src/components/ui/dropdown-menu.tsx`
- Create: `dashboard/src/components/ui/avatar.tsx`
- Create: `dashboard/src/components/ui/separator.tsx`

**Interfaces:**
- Produces: `DashboardRole = 'admin' | 'teacher'`; `NavItem { label: string; to: string; roles: DashboardRole[] }`; `NavGroup { label: string | null; icon: LucideIcon; items: NavItem[] }`; `NAV_GROUPS: NavGroup[]`; `findNavItemByPath(pathname: string): NavItem | undefined`; `visibleNavGroups(role: DashboardRole): NavGroup[]`; shadcn `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` (+ related sub-components), `Avatar`/`AvatarImage`/`AvatarFallback`, `Separator`.

- [ ] **Step 1: Write `nav-config.ts`**

```ts
import type { LucideIcon } from 'lucide-react';
import { Home, GraduationCap, ClipboardList, FolderOpen, Megaphone, Users } from 'lucide-react';

export type DashboardRole = 'admin' | 'teacher';

export interface NavItem {
  label: string;
  to: string;
  roles: DashboardRole[];
}

export interface NavGroup {
  label: string | null;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    icon: Home,
    items: [{ label: 'Dashboard', to: '/', roles: ['admin', 'teacher'] }],
  },
  {
    label: 'Academics',
    icon: GraduationCap,
    items: [
      { label: 'Courses', to: '/courses', roles: ['admin', 'teacher'] },
      { label: 'Timetable', to: '/timetable', roles: ['admin', 'teacher'] },
      { label: 'Syllabus', to: '/syllabus', roles: ['admin', 'teacher'] },
    ],
  },
  {
    label: 'Tests',
    icon: ClipboardList,
    items: [
      { label: 'Question Bank', to: '/questions', roles: ['admin', 'teacher'] },
      { label: 'Tests', to: '/tests', roles: ['admin', 'teacher'] },
    ],
  },
  {
    label: 'Content',
    icon: FolderOpen,
    items: [{ label: 'Resources', to: '/resources', roles: ['admin', 'teacher'] }],
  },
  {
    label: 'Communication',
    icon: Megaphone,
    items: [{ label: 'Announcements', to: '/announcements', roles: ['admin', 'teacher'] }],
  },
  {
    label: 'Management',
    icon: Users,
    items: [{ label: 'Staff & Students', to: '/staff', roles: ['admin'] }],
  },
];

export function findNavItemByPath(pathname: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    const match = group.items.find((item) => item.to === pathname);
    if (match) return match;
  }
  return undefined;
}

export function visibleNavGroups(role: DashboardRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
```

- [ ] **Step 2: Add new dependencies to `package.json`**

Add to `dependencies`: `"@radix-ui/react-dropdown-menu": "^2.1.1"`, `"@radix-ui/react-avatar": "^1.1.0"`, `"@radix-ui/react-separator": "^1.1.0"`, `"lucide-react": "^0.427.0"`. Do not remove or alter any existing entries.

- [ ] **Step 3: Write the three new UI primitives**

`dashboard/src/components/ui/dropdown-menu.tsx`:
```tsx
import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg',
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />;
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
```

`dashboard/src/components/ui/avatar.tsx`:
```tsx
import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
```

`dashboard/src/components/ui/separator.tsx`:
```tsx
import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';

import { cn } from '@/lib/utils';

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
```

- [ ] **Step 4: Install and verify**

Run (from `dashboard/`): `npm install`
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/nav-config.ts dashboard/package.json dashboard/package-lock.json dashboard/src/components/ui/dropdown-menu.tsx dashboard/src/components/ui/avatar.tsx dashboard/src/components/ui/separator.tsx
git commit -m "feat(dashboard): add nav config and DropdownMenu/Avatar/Separator primitives"
```

---

## Task 3: Placeholder routes for every V1 feature

**Files:**
- Create: `dashboard/src/components/coming-soon-page.tsx`
- Create: `dashboard/src/routes/_authed/courses.tsx`
- Create: `dashboard/src/routes/_authed/timetable.tsx`
- Create: `dashboard/src/routes/_authed/syllabus.tsx`
- Create: `dashboard/src/routes/_authed/questions.tsx`
- Create: `dashboard/src/routes/_authed/tests.tsx`
- Create: `dashboard/src/routes/_authed/resources.tsx`
- Create: `dashboard/src/routes/_authed/announcements.tsx`
- Create: `dashboard/src/routes/_authed/staff.tsx`

**Interfaces:**
- Produces: `ComingSoonPage({ title: string }): JSX.Element`; 8 new routes registered at `/courses`, `/timetable`, `/syllabus`, `/questions`, `/tests`, `/resources`, `/announcements`, `/staff`.

This is done ahead of the Sidebar/Header tasks specifically so those routes exist in the generated route tree before anything links to them.

- [ ] **Step 1: Write the shared placeholder component**

`dashboard/src/components/coming-soon-page.tsx`:
```tsx
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 2: Write the 8 route files**

`dashboard/src/routes/_authed/courses.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/courses')({
  component: () => <ComingSoonPage title="Courses" />,
});
```

`dashboard/src/routes/_authed/timetable.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/timetable')({
  component: () => <ComingSoonPage title="Timetable" />,
});
```

`dashboard/src/routes/_authed/syllabus.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/syllabus')({
  component: () => <ComingSoonPage title="Syllabus" />,
});
```

`dashboard/src/routes/_authed/questions.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/questions')({
  component: () => <ComingSoonPage title="Question Bank" />,
});
```

`dashboard/src/routes/_authed/tests.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/tests')({
  component: () => <ComingSoonPage title="Tests" />,
});
```

`dashboard/src/routes/_authed/resources.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/resources')({
  component: () => <ComingSoonPage title="Resources" />,
});
```

`dashboard/src/routes/_authed/announcements.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/announcements')({
  component: () => <ComingSoonPage title="Announcements" />,
});
```

`dashboard/src/routes/_authed/staff.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/staff')({
  component: () => <ComingSoonPage title="Staff & Students" />,
});
```

- [ ] **Step 3: Regenerate the route tree and verify**

Run (from `dashboard/`): `npx vite build`
Expected: succeeds, and `src/routeTree.gen.ts` (gitignored, regenerated automatically by the TanStack Router Vite plugin) now includes all 8 new routes plus the existing ones.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/coming-soon-page.tsx dashboard/src/routes/_authed/courses.tsx dashboard/src/routes/_authed/timetable.tsx dashboard/src/routes/_authed/syllabus.tsx dashboard/src/routes/_authed/questions.tsx dashboard/src/routes/_authed/tests.tsx dashboard/src/routes/_authed/resources.tsx dashboard/src/routes/_authed/announcements.tsx dashboard/src/routes/_authed/staff.tsx
git commit -m "feat(dashboard): add placeholder routes for every V1 feature"
```

---

## Task 4: Sidebar component

**Files:**
- Create: `dashboard/src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `visibleNavGroups`, `NavGroup` (Task 2, `@/lib/nav-config`); `Separator` (Task 2, `@/components/ui/separator`); `getSession` (`@/lib/auth`); `cn` (`@/lib/utils`); TanStack Router's `Link`/`useRouterState`. Routes from Task 3 must already exist for `Link to` to typecheck.
- Produces: `Sidebar(): JSX.Element` (no props — reads the session internally).

- [ ] **Step 1: Write `sidebar.tsx`**

```tsx
import { Link, useRouterState } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { getSession } from '@/lib/auth';
import { visibleNavGroups } from '@/lib/nav-config';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const session = getSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = visibleNavGroups(session?.role === 'admin' ? 'admin' : 'teacher');

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold text-foreground">Classes Hub</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        {groups.map((group, index) => (
          <div key={group.label ?? 'root'}>
            {index > 0 && <Separator className="mb-4" />}
            {group.label && (
              <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                    pathname === item.to && 'bg-accent text-accent-foreground'
                  )}
                >
                  {!group.label && <group.icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `dashboard/`): `npm run typecheck`
Expected: no errors. (If `to={item.to}` raises a type error because `NavItem.to` is a plain `string` rather than a literal union of registered routes, this is a TanStack Router generic-inference edge case — report it as a concern rather than guessing at a fix, since resolving it may need a project-wide typing decision.)

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/layout/sidebar.tsx
git commit -m "feat(dashboard): add role-visible grouped sidebar"
```

---

## Task 5: Header component

**Files:**
- Modify: `dashboard/src/lib/auth.ts`
- Create: `dashboard/src/components/layout/header.tsx`

**Interfaces:**
- Consumes: `findNavItemByPath` (Task 2, `@/lib/nav-config`); `Avatar`/`AvatarFallback` (Task 2, `@/components/ui/avatar`); `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` (Task 2, `@/components/ui/dropdown-menu`); `useLogout` (`@/features/auth/api`); `getSession` (`@/lib/auth`, modified by this task).
- Produces: `Header(): JSX.Element`; `SessionClaims` (dashboard) gains `name: string`.

- [ ] **Step 1: Add `name` to the dashboard's `SessionClaims`**

In `dashboard/src/lib/auth.ts`, change:
```ts
export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
  exp: number;
}
```
to:
```ts
export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
  name: string;
  exp: number;
}
```

- [ ] **Step 2: Write `header.tsx`**

```tsx
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useLogout } from '@/features/auth/api';
import { getSession } from '@/lib/auth';
import { findNavItemByPath } from '@/lib/nav-config';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function Header() {
  const navigate = useNavigate();
  const logout = useLogout();
  const session = getSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = findNavItemByPath(pathname)?.label ?? 'Dashboard';

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) });
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{session ? initials(session.name) : '?'}</AvatarFallback>
          </Avatar>
          <span className="text-foreground">
            {session?.name} <span className="text-muted-foreground">({session?.role})</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 3: Typecheck**

Run (from `dashboard/`): `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/auth.ts dashboard/src/components/layout/header.tsx
git commit -m "feat(dashboard): add header with page title and user menu"
```

---

## Task 6: AppShell + wire into `_authed`

**Files:**
- Create: `dashboard/src/components/layout/app-shell.tsx`
- Modify: `dashboard/src/routes/_authed.tsx`

**Interfaces:**
- Consumes: `Sidebar` (Task 4), `Header` (Task 5).
- Produces: `AppShell({ children: ReactNode }): JSX.Element`.

- [ ] **Step 1: Write `app-shell.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `AppShell` into `_authed.tsx`**

Replace the full content of `dashboard/src/routes/_authed.tsx`:
```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
```

- [ ] **Step 3: Typecheck and build**

Run (from `dashboard/`): `npm run typecheck && npm run build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/layout/app-shell.tsx dashboard/src/routes/_authed.tsx
git commit -m "feat(dashboard): wire AppShell into the authed layout"
```

---

## Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck and build**

Run (from `dashboard/`): `npm run typecheck && npm run build`
Expected: both clean.

- [ ] **Step 2: Run the dashboard's test suite**

Run (from `dashboard/`): `npm run test`
Expected: all existing tests still pass (`form-utils.test.ts`).

- [ ] **Step 3: Start/confirm the backend and dashboard are running**

Check `lsof -nP -iTCP:3000 -sTCP:LISTEN` / `lsof -nP -iTCP:5173 -sTCP:LISTEN`. If either isn't running, start it (backend: `cd backend && export $(cat .env | xargs) && npm run seed && npm run dev` in the background; dashboard: `cd dashboard && npm run dev` in the background).

- [ ] **Step 4: Verify the JWT now includes `name`**

```bash
TOKEN=$(curl -s -X POST http://localhost:5173/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@classeshub.test","password":"password123","deviceId":"verify-shell"}' \
  | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).token))")
node -e "console.log(JSON.parse(Buffer.from('$TOKEN'.split('.')[1], 'base64').toString()))"
```
Expected: printed object includes `name: 'Admin User'` (the seeded admin's name), along with `userId`, `role: 'admin'`, `sessionId`.

- [ ] **Step 5: Manual browser check**

Open `http://localhost:5173`, log in as `admin@classeshub.test` / `password123`. Confirm: the sidebar shows all 6 groups (including "Management" with "Staff & Students", since this user is admin); clicking each nav item navigates to its "Coming soon" placeholder and the header's title updates to match; the header's user menu shows "Admin User (admin)" with initials "AU"; clicking the user menu and "Log out" returns to `/login`.

Log in as `teacher@classeshub.test` / `password123`. Confirm: the sidebar does NOT show the "Management" group (teacher isn't allowed to see "Staff & Students") — every other group is visible.

No commit for this task (verification only).
