import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { currentClaims } from '@/lib/auth';

// Pathless layout route: every authed screen lives under it, so the auth guard
// and the app shell (sidebar/topbar) are declared exactly once.
export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    if (!currentClaims()) throw redirect({ to: '/login' });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
