# Dashboard Design-System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard a shared, reusable component foundation (shadcn/ui primitives + a `getFormDataObject`-based form convention) and restyle the existing login screen on top of it, so every future screen is built the same way.

**Architecture:** shadcn/ui primitives generated as editable source in `src/components/ui/` (not a black-box dependency) — CSS-variable-driven theming via Tailwind, so a styling change in one primitive propagates to every screen using it. Forms use uncontrolled inputs + a `FormData`-extraction utility instead of per-field `useState` or a form library.

**Tech Stack:** React 18.3.1, Tailwind CSS 3.4.10 (both staying as already installed — no version upgrade), shadcn/ui (new-york style, Slate base color, CSS variables), Radix UI primitives (`@radix-ui/react-slot`, `@radix-ui/react-label`), `class-variance-authority`, `tailwindcss-animate`, Vitest + jsdom (new — for `form-utils.ts` unit tests only, dashboard has no other test suite).

## Global Constraints

- Cherry-pick conventions only — keep classes-hub's existing folder/route structure (`features/<name>/api.ts`, `_authed` layout, direct-to-Lambda calls). Do not restructure to match the Dukandaari reference project.
- JWT stays in `localStorage` (`dashboard/src/lib/auth.ts`) — no change to auth storage.
- No aggregator/"ops" Lambda — dashboard keeps calling `identity` directly through the existing Vite `/api/v1` proxy.
- Stay on React 18.3.1 / Tailwind 3.4.10 — do not upgrade.
- shadcn/ui config: style **new-york**, base color **Slate**, CSS variables **enabled**.
- Forms: uncontrolled inputs + `getFormDataObject` (`src/lib/form-utils.ts`), never per-field `useState` for form fields (UI-only state like loading/open-closed/selected-IDs may still use `useState`).
- Kebab-case filenames throughout.
- No new feature screens in this round (courses/tests/timetable/etc. come later).

---

## Task 1: shadcn/ui design tokens + core primitives

**Files:**
- Create: `dashboard/components.json`
- Create: `dashboard/src/lib/utils.ts`
- Modify: `dashboard/tailwind.config.js`
- Modify: `dashboard/src/styles/globals.css`
- Modify: `dashboard/package.json`
- Create: `dashboard/src/components/ui/button.tsx`
- Create: `dashboard/src/components/ui/input.tsx`
- Create: `dashboard/src/components/ui/label.tsx`
- Create: `dashboard/src/components/ui/card.tsx`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` (from `@/lib/utils`); `Button` (with `variant`/`size`/`asChild` props), `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter` (all from `@/components/ui/*`).

- [ ] **Step 1: Write `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2: Write `src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Update `tailwind.config.js`** to the shadcn Slate/new-york token set

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

- [ ] **Step 4: Update `src/styles/globals.css`** to add the Slate CSS variables

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 5: Add the new dependencies to `package.json`**

Add to `dependencies`: `"class-variance-authority": "^0.7.0"`, `"@radix-ui/react-slot": "^1.1.0"`, `"@radix-ui/react-label": "^2.1.0"`.
Add to `devDependencies`: `"tailwindcss-animate": "^1.0.7"`.
(`clsx` and `tailwind-merge` are already dependencies from Task 7 of the login-slice plan — do not re-add.)

- [ ] **Step 6: Write the four UI primitives**

`dashboard/src/components/ui/button.tsx`:
```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

`dashboard/src/components/ui/input.tsx`:
```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

`dashboard/src/components/ui/label.tsx`:
```tsx
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />);
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

`dashboard/src/components/ui/card.tsx`:
```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border bg-card text-card-foreground shadow', className)} {...props} />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

- [ ] **Step 7: Install and verify**

Run (from `dashboard/`): `npm install`
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add dashboard/components.json dashboard/src/lib/utils.ts dashboard/tailwind.config.js dashboard/src/styles/globals.css dashboard/package.json dashboard/package-lock.json dashboard/src/components/ui
git commit -m "feat(dashboard): add shadcn/ui design tokens and core primitives (Button, Input, Label, Card)"
```

---

## Task 2: `getFormDataObject` form utility (TDD)

**Files:**
- Create: `dashboard/vitest.config.ts`
- Modify: `dashboard/package.json`
- Create: `dashboard/src/lib/form-utils.ts`
- Test: `dashboard/src/lib/form-utils.test.ts`

**Interfaces:**
- Produces: `type FormDataObject = Record<string, unknown>`; `getFormDataObject(e: React.FormEvent<HTMLFormElement>): FormDataObject`.

- [ ] **Step 1: Add Vitest + jsdom to `package.json`**

Add to `devDependencies`: `"vitest": "^2.0.5"`, `"jsdom": "^25.0.0"`.
Add to `scripts`: `"test": "vitest run"`.

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

- [ ] **Step 3: Write the failing tests**

`dashboard/src/lib/form-utils.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { FormEvent } from 'react';
import { getFormDataObject } from './form-utils';

function buildFormEvent(fields: Array<{ name: string; value: string }>): FormEvent<HTMLFormElement> {
  const form = document.createElement('form');
  for (const { name, value } of fields) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  return { currentTarget: form } as unknown as FormEvent<HTMLFormElement>;
}

describe('getFormDataObject', () => {
  it('extracts flat string fields, trimmed', () => {
    const event = buildFormEvent([
      { name: 'email', value: '  test@example.com  ' },
      { name: 'password', value: 'secret' },
    ]);
    expect(getFormDataObject(event)).toEqual({ email: 'test@example.com', password: 'secret' });
  });

  it('coerces empty/whitespace-only values to null', () => {
    const event = buildFormEvent([{ name: 'notes', value: '   ' }]);
    expect(getFormDataObject(event)).toEqual({ notes: null });
  });

  it('collects array-keyed fields (name[]) into arrays', () => {
    const event = buildFormEvent([
      { name: 'tags[]', value: 'a' },
      { name: 'tags[]', value: 'b' },
    ]);
    expect(getFormDataObject(event)).toEqual({ tags: ['a', 'b'] });
  });

  it('builds nested objects from dotted keys', () => {
    const event = buildFormEvent([
      { name: 'address.city', value: 'Pune' },
      { name: 'address.zip', value: '411001' },
    ]);
    expect(getFormDataObject(event)).toEqual({ address: { city: 'Pune', zip: '411001' } });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run (from `dashboard/`): `npx vitest run src/lib/form-utils.test.ts`
Expected: FAIL — `Cannot find module './form-utils'`.

- [ ] **Step 5: Write the implementation**

`dashboard/src/lib/form-utils.ts`:
```ts
export type FormDataObject = Record<string, unknown>;

export function getFormDataObject(e: React.FormEvent<HTMLFormElement>): FormDataObject {
  const form = e.currentTarget;
  const raw = new FormData(form);
  const result: FormDataObject = {};

  for (const [rawKey, value] of raw.entries()) {
    if (value instanceof File && value.name === '') continue;

    const coerced = typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

    const arrayMatch = rawKey.match(/^(.+)\[\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1];
      if (!Array.isArray(result[key])) result[key] = [];
      (result[key] as unknown[]).push(coerced);
      continue;
    }

    if (rawKey.includes('.')) {
      const parts = rawKey.split('.');
      let cursor = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
          cursor[parts[i]] = {};
        }
        cursor = cursor[parts[i]] as FormDataObject;
      }
      cursor[parts[parts.length - 1]] = coerced;
      continue;
    }

    result[rawKey] = coerced;
  }

  return result;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run (from `dashboard/`): `npm install && npx vitest run src/lib/form-utils.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add dashboard/vitest.config.ts dashboard/package.json dashboard/package-lock.json dashboard/src/lib/form-utils.ts dashboard/src/lib/form-utils.test.ts
git commit -m "feat(dashboard): add getFormDataObject form utility with tests"
```

---

## Task 3: Restyle the login screen with shadcn + `getFormDataObject`

**Files:**
- Modify: `dashboard/src/routes/login.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardContent` (Task 1); `getFormDataObject` (Task 2); existing `useLogin` (`@/features/auth/api`), `getSession` (`@/lib/auth`) — unchanged.

- [ ] **Step 1: Rewrite `dashboard/src/routes/login.tsx`**

```tsx
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { type FormEvent } from 'react';
import { useLogin } from '@/features/auth/api';
import { getSession } from '@/lib/auth';
import { getFormDataObject } from '@/lib/form-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (getSession()) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});

function deviceId(): string {
  const key = 'classeshub_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { email, password } = getFormDataObject(e) as { email: string; password: string };
    login.mutate({ email, password, deviceId: deviceId() }, { onSuccess: () => navigate({ to: '/' }) });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Classes Hub</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {login.isError && <p className="text-sm text-destructive">Invalid email or password.</p>}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `dashboard/`): `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/routes/login.tsx
git commit -m "feat(dashboard): restyle login screen with shadcn components and getFormDataObject"
```

---

## Task 4: `dashboard/CLAUDE.md`

**Files:**
- Create: `dashboard/CLAUDE.md`

- [ ] **Step 1: Write `dashboard/CLAUDE.md`**

```markdown
# Dashboard (React) — Rules

Stack: Vite + React 18 + TypeScript + TanStack Router (file-based) + TanStack
Query + Tailwind CSS v3 + shadcn/ui. Used by admin/teacher accounts (students
use the Flutter app only — see `app/CLAUDE.md`).

## Components

- **shadcn/ui primitives** live in `src/components/ui/` as editable source
  (generated once, then owned by this repo — not a black-box dependency).
  Change a primitive's styling there and every screen using it updates.
  Add new primitives the same way, following the style already set up in
  `components.json` (new-york, Slate base color, CSS variables).
- **Placement rule**: a component used by exactly one route lives in that
  route's `-components/` folder; the moment a second route needs it, move it
  to `src/components/`.
- **Never call `fetch` or the API client directly from a component or route.**
  All data access goes through `features/<name>/api.ts` (TanStack Query hooks)
  + `features/<name>/types.ts`, one folder per backend feature.

## Forms

- Use `getFormDataObject` (`src/lib/form-utils.ts`) — uncontrolled inputs with
  `name` attributes, values extracted from `FormData` on submit. Do NOT create
  per-field `useState` for form fields, and do not introduce a form library
  (react-hook-form etc.).
- `useState` is fine for UI-only state: loading flags, open/closed, selected
  IDs, a debounced search-input value before it hits a URL param.
- Exception: complex inputs that can't be a plain HTML input (file uploads,
  map pickers, tag/chip selectors) may use `useState`.

## Filters

- Filters (search, status, page, date range, etc.) live in the URL via a
  route's `validateSearch` (zod schema) — never in `useState`. Changing a
  filter navigates with updated search params and resets `page` to `1`.

## Auth

`lib/auth.ts` stores the JWT in `localStorage` and decodes it client-side for
UI purposes only — the backend re-verifies every call via the authorizer
Lambda. A 401 clears the token and redirects to `/login` (`lib/api.ts`). The
`/_authed` pathless layout guards every authed screen via `beforeLoad`.

## Naming

Kebab-case filenames throughout (e.g. `login-form.tsx`, not `LoginForm.tsx`).
PascalCase for component/function names inside files, as usual for React.

## Process

- Never run `git commit` or `git push` without the user explicitly asking for
  it in that message — permission from an earlier message doesn't carry
  forward.
- Run `/code-review` and address its findings before pushing any dashboard
  change (in addition to the push rule above, not a replacement for it).
- No new dependency without checking its vulnerability/maintenance history
  first.

## Security

- Never `dangerouslySetInnerHTML`. Validate/sanitize all user input.
- File uploads: validate type and size client-side before uploading.
- No secrets/tokens hardcoded anywhere — env vars only (`VITE_*`, read via
  `import.meta.env`).

## Docs

Update this file in the same change as any change to these conventions.
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/CLAUDE.md
git commit -m "docs(dashboard): add CLAUDE.md documenting design-system and process conventions"
```

---

## Task 5: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck and build**

Run (from `dashboard/`): `npm run typecheck && npm run build`
Expected: both clean, no errors.

- [ ] **Step 2: Start the backend if not already running**

Run (from `backend/`): `export $(cat .env | xargs) && npm run seed` (reseeds demo users), then start `npm run dev` in the background (port 3000) if it isn't already running (`lsof -nP -iTCP:3000 -sTCP:LISTEN`).

- [ ] **Step 3: Start the dashboard and verify login through the proxy**

Run (from `dashboard/`): start `npm run dev` in the background (port 5173) if not already running.
Run:
```bash
curl -s -X POST http://localhost:5173/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@classeshub.test","password":"password123","deviceId":"verify-restyle"}'
```
Expected: `{"token":"..."}`.

- [ ] **Step 4: Manual browser check**

Open `http://localhost:5173/login` — confirm the shadcn-styled card/form renders (rounded card, labeled inputs, dark button), log in as `admin@classeshub.test` / `password123`, confirm it redirects to `/` and shows the landing page. Navigate back to `/login` while still logged in — confirm it redirects straight to `/` (the `beforeLoad` guard).

No commit for this task (verification only).
