import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { clearToken, currentClaims, isStaff, isSuperAdmin } from '@/lib/auth';
import { useTheme } from './theme';

interface NavItem {
  to: string;
  label: string;
  show: (role: string) => boolean;
}

// Nav mirrors the backend features. Super-admin sees Tenants; staff see the rest.
const NAV: NavItem[] = [
  { to: '/', label: 'Overview', show: () => true },
  { to: '/tenants', label: 'Tenants', show: isSuperAdmin },
  { to: '/students', label: 'People', show: isStaff },
  { to: '/courses', label: 'Courses', show: isStaff },
  { to: '/tests', label: 'Tests', show: isStaff },
  { to: '/timetable', label: 'Timetable', show: isStaff },
  { to: '/resources', label: 'Resources', show: isStaff },
  { to: '/syllabus', label: 'Syllabus', show: isStaff },
  { to: '/notifications', label: 'Announcements', show: isStaff },
];

export function AppShell({ children }: { children: ReactNode }) {
  const claims = currentClaims();
  const role = claims?.role ?? '';
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const items = NAV.filter((i) => i.show(role));

  function signOut() {
    clearToken();
    navigate({ to: '/login' });
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 px-5">
          <div className="h-6 w-6 rounded bg-primary" />
          <span className="font-semibold">Classes Hub</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-bg hover:text-ink [&.active]:bg-primary/10 [&.active]:text-primary"
              activeOptions={{ exact: i.to === '/' }}
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <span className="text-sm text-muted">
            {isSuperAdmin(role) ? 'Super Admin' : role ? role[0].toUpperCase() + role.slice(1) : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>
        <main className={cn('flex-1 overflow-auto p-6')}>{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
