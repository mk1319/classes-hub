import { createFileRoute, Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/layout/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUser, useUserSessions } from '@/features/users/api';
import type { SessionRecord } from '@/features/users/types';

export const Route = createFileRoute('/_authed/students/$studentId')({ component: PersonDetail });

function PersonDetail() {
  const { studentId } = Route.useParams();
  const id = Number(studentId);
  const { data: user } = useUser(id);
  const { data: sessions, isLoading } = useUserSessions(id);

  const columns: Column<SessionRecord>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (s) => (s.is_active ? <Badge tone="success">active</Badge> : <Badge>ended</Badge>),
      sortValue: (s) => (s.is_active ? 1 : 0),
    },
    { key: 'device', header: 'Device', render: (s) => s.device_model ?? s.device_id, sortValue: (s) => s.device_model ?? '' },
    { key: 'os', header: 'OS', render: (s) => s.os_version ?? '—' },
    { key: 'app', header: 'App', render: (s) => s.app_version ?? '—' },
    { key: 'ip', header: 'IP', render: (s) => s.ip_address ?? '—' },
    { key: 'when', header: 'When', render: (s) => new Date(s.created_at).toLocaleString(), sortValue: (s) => s.created_at },
  ];

  return (
    <div>
      <PageHeader
        title={user?.name ?? 'Person'}
        description={user ? `${user.email} · ${user.role}` : undefined}
        action={
          <Link to="/students">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Login &amp; device history</CardTitle>
          <CardDescription>
            One active session at a time — a new login signs the previous device out (anti-fraud).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={sessions}
            isLoading={isLoading}
            getRowKey={(s) => s.id}
            emptyMessage="No logins recorded yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
