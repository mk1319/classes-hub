import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBulkImport, useCreateUser, useUsers } from '@/features/users/api';
import type { Role, User } from '@/features/users/types';

export const Route = createFileRoute('/_authed/students')({ component: PeoplePage });

function PeoplePage() {
  const [role, setRole] = useState<Role | ''>('');
  const { data, isLoading } = useUsers(role || undefined);
  const navigate = useNavigate();
  const [panel, setPanel] = useState<'none' | 'create' | 'import'>('none');

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name', render: (u) => <span className="font-medium">{u.name}</span>, sortValue: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => u.email, sortValue: (u) => u.email },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <Badge tone={u.role === 'teacher' ? 'primary' : 'neutral'}>{u.role}</Badge>,
      sortValue: (u) => u.role,
    },
    { key: 'created', header: 'Added', render: (u) => new Date(u.created_at).toLocaleDateString(), sortValue: (u) => u.created_at },
  ];

  return (
    <div>
      <PageHeader
        title="People"
        description="Teachers and students. Click a row for device/login history."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPanel(panel === 'import' ? 'none' : 'import')}>
              Bulk import
            </Button>
            <Button onClick={() => setPanel(panel === 'create' ? 'none' : 'create')}>New person</Button>
          </div>
        }
      />
      {panel === 'create' && <CreatePersonForm onDone={() => setPanel('none')} />}
      {panel === 'import' && <BulkImportForm onDone={() => setPanel('none')} />}

      <div className="mb-3 flex items-center gap-2">
        <Label>Filter by role</Label>
        <Select value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
          <option value="">All</option>
          <option value="teacher">Teachers</option>
          <option value="student">Students</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        getRowKey={(u) => u.id}
        onRowClick={(u) => navigate({ to: '/students/$studentId', params: { studentId: String(u.id) } })}
        filterPlaceholder="Search name or email…"
        emptyMessage="No people yet."
      />
    </div>
  );
}

function CreatePersonForm({ onDone }: { onDone: () => void }) {
  const create = useCreateUser();
  const [form, setForm] = useState({ name: '', email: '', role: 'student' as Role, password: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync(form);
    onDone();
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>New person</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={set('name')} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onChange={set('role')} className="w-full">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Temp password</Label>
            <Input value={form.password} onChange={set('password')} minLength={6} required />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
            {create.isError && <span className="ml-3 text-sm text-destructive">{(create.error as Error).message}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BulkImportForm({ onDone }: { onDone: () => void }) {
  const bulk = useBulkImport();
  const [csv, setCsv] = useState('email,name,role,password\n');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await bulk.mutateAsync(csv);
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Bulk import (CSV)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            className="h-40 w-full rounded-md border border-border bg-surface p-3 font-mono text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={bulk.isPending}>
              {bulk.isPending ? 'Importing…' : 'Import'}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Done
            </Button>
          </div>
          {bulk.data && (
            <div className="text-sm">
              <p className="text-success">{bulk.data.created} created.</p>
              {bulk.data.errors.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-destructive">
                  {bulk.data.errors.map((er) => (
                    <li key={er.row}>
                      Row {er.row} ({er.email}): {er.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
