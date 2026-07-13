import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useLogin } from '@/features/auth/api';
import { getSession } from '@/lib/auth';

export const Route = createFileRoute('/login')({
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (getSession()) {
    navigate({ to: '/' });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password, deviceId: deviceId() }, { onSuccess: () => navigate({ to: '/' }) });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Classes Hub</h1>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {login.isError && <p className="mb-3 text-sm text-red-600">Invalid email or password.</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {login.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
