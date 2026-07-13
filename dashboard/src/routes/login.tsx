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
