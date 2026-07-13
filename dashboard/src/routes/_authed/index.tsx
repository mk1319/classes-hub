import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { getSession } from '@/lib/auth';
import { useLogout } from '@/features/auth/api';

export const Route = createFileRoute('/_authed/')({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const logout = useLogout();
  const session = getSession();

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <p className="text-slate-900">
        Logged in as <span className="font-semibold">{session?.role}</span> (user #{session?.userId})
      </p>
      <button onClick={handleLogout} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white">
        Log out
      </button>
    </div>
  );
}
