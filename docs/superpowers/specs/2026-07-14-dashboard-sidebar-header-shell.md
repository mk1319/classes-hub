# Dashboard sidebar + header shell

## Context

The dashboard currently has only two screens: `/login` and a bare landing page
at `/` showing "Logged in as {role} (user #{id})" with a logout button. There
is no persistent navigation — every future feature screen (courses, tests,
timetable, resources, syllabus, announcements, staff) needs a way to be
reached. This spec adds that shell: a grouped, role-visible sidebar and a
minimal header, built on the shadcn/ui design-system foundation from the
previous round. No feature screens are built here — every destination gets a
placeholder page, ready for you to fill in one at a time per your stated plan.

## Decisions

Confirmed with the project owner, in order:

1. **Role-based visibility, not a permission-key registry.** Each nav item
   simply declares which of the two dashboard roles (`admin`, `teacher`) can
   see it. No per-feature permission keys, no toggle-per-role admin UI — that
   infrastructure isn't needed anywhere else in classes-hub yet.
2. **Full navigation now, placeholder destination pages.** The sidebar shows
   every V1 feature group from day one; each route renders a simple "Coming
   soon" page until built. This gives a complete view of the app's shape
   immediately, rather than growing the nav one item at a time.
3. **Header: page title + user menu, nothing else.** No search bar, no
   notification bell — nothing exists yet to back those features.
4. **Add `name` to the JWT claims** so the header can show a real name, not
   just role + user ID. Small backend addition (`SessionClaims` gains `name`,
   `login()` includes it) — no other auth behavior changes.
5. **New shadcn primitives**: `DropdownMenu` (user menu), `Avatar` (initials),
   `Separator` (between sidebar groups) — plus `lucide-react` for nav icons.
6. **Desktop-first — no mobile responsive collapse/hamburger in this round.**

## Layout architecture

A new `AppShell` component composes `Sidebar` + `Header` around page content,
and plugs into the *existing* `_authed.tsx` pathless layout (which already
guards every authed route with a `beforeLoad` session check):

```
_authed.tsx (existing auth guard, unchanged)
  └── AppShell (new) — src/components/layout/app-shell.tsx
        ├── Sidebar (new) — src/components/layout/sidebar.tsx
        ├── Header (new) — src/components/layout/header.tsx
        └── Outlet (the actual page — Courses, Tests, etc.)
```

Every authed route automatically gets the shell with zero per-page changes.

`Sidebar` and `Header` both read from one shared source of truth,
`src/lib/nav-config.ts` — an array of nav groups, each with items carrying
`label`, `to` (route path), an `icon` (lucide-react component), and `roles`
(which of `admin`/`teacher` can see it). The sidebar renders this grouped and
role-filtered; the header derives the current page's title by matching the
active route against this same config. No duplicated label/route strings
between the two.

## Navigation groups and items

Based on `plan/03-features-v1.md`'s V1 feature scope:

| Group | Item | Route | Visible to |
|---|---|---|---|
| — | Dashboard | `/` | admin, teacher |
| Academics | Courses | `/courses` | admin, teacher |
| Academics | Timetable | `/timetable` | admin, teacher |
| Academics | Syllabus | `/syllabus` | admin, teacher |
| Tests | Question Bank | `/questions` | admin, teacher |
| Tests | Tests | `/tests` | admin, teacher |
| Content | Resources | `/resources` | admin, teacher |
| Communication | Announcements | `/announcements` | admin, teacher |
| Management | Staff & Students | `/staff` | admin only |

Every route above except `/` (which already exists as the landing page) gets
a new placeholder route rendering just a heading and "Coming soon," through
the new shell.

## Header

- **Left**: the current page's title, looked up from `nav-config.ts` by
  matching the active route (e.g. viewing `/courses` shows "Courses").
- **Right**: a user menu — an `Avatar` showing the user's initials (derived
  from `name`), the user's `name` and `role` as text, a chevron. Clicking
  opens a `DropdownMenu` with a single item, "Log out" (reuses the existing
  `useLogout()` hook — no duplicate logout control anywhere else in the
  shell).

### JWT `name` claim

- `backend/packages/shared/src/jwt.ts`: `SessionClaims` gains `name: string`.
- `backend/identity/src/login.ts`: the `SELECT` that looks up the user by
  email already has access to `users.name` — add it to the selected columns
  and pass it into `signSessionToken(...)`.
- `dashboard/src/lib/auth.ts`: `SessionClaims` type gains the matching
  `name: string` field (decoded from the JWT payload, same as `role`/`userId`
  today — no new decoding logic needed, just the extra field).
- No change to token expiry, single-active-session logic, or any other auth
  behavior.

## New shadcn primitives + icons

Added the same way as the previous round's `Button`/`Input`/`Label`/`Card`
(editable source in `src/components/ui/`, matching the existing new-york/Slate
config in `components.json`):

- **`DropdownMenu`** (`@radix-ui/react-dropdown-menu`) — the header's user
  menu.
- **`Avatar`** (`@radix-ui/react-avatar`) — initials circle in the user menu.
- **`Separator`** (`@radix-ui/react-separator`) — visual divider between
  sidebar groups.
- **`lucide-react`** (new dependency, not a shadcn primitive) — one icon per
  nav group/item: `Home` (Dashboard), `GraduationCap` (Academics),
  `ClipboardList` (Tests), `FolderOpen` (Content), `Megaphone`
  (Communication), `Users` (Management).

## Scope

In scope:
- `AppShell`, `Sidebar`, `Header` components (`src/components/layout/`)
- `src/lib/nav-config.ts`
- The JWT `name` claim addition (backend + dashboard)
- 8 new placeholder routes (Courses, Timetable, Syllabus, Question Bank,
  Tests, Resources, Announcements, Staff & Students)
- 3 new shadcn primitives (DropdownMenu, Avatar, Separator) + `lucide-react`

Explicitly out of scope:
- Any real feature content for the placeholder pages — picked up directly by
  the project owner, one at a time
- Mobile-responsive sidebar collapse/hamburger menu
- Granular per-feature permission keys / a permission-toggle admin UI
- Any change to token expiry, single-active-session enforcement, or the
  existing login/logout flow beyond adding the `name` claim
