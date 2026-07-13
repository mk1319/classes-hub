import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '@/lib/auth';

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => <Outlet />,
});
