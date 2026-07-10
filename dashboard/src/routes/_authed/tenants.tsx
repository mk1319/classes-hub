import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCreateTenant, useTenants } from '@/features/tenants/api';
import type { Tenant } from '@/features/tenants/types';

export const Route = createFileRoute('/_authed/tenants')({ component: TenantsPage });

function TenantsPage() {
  const { data, isLoading } = useTenants();
  const [showForm, setShowForm] = useState(false);

  const columns: Column<Tenant>[] = [
    { key: 'name', header: 'Name', render: (t) => <span className="font-medium">{t.name}</span>, sortValue: (t) => t.name },
    {
      key: 'accent',
      header: 'Accent',
      render: (t) =>
        t.branding.accentColor ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded" style={{ background: t.branding.accentColor }} />
            <span className="text-muted">{t.branding.accentColor}</span>
          </span>
        ) : (
          <Badge>default amber</Badge>
        ),
    },
    { key: 'appName', header: 'App name', render: (t) => t.branding.appName ?? '—' },
    { key: 'flavor', header: 'Flavor', render: (t) => t.branding.flavor ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Onboard a tutor/institute and set their whitelabel branding."
        action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'New tenant'}</Button>}
      />
      {showForm && <NewTenantForm onDone={() => setShowForm(false)} />}
      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        getRowKey={(t) => t.id}
        filterPlaceholder="Filter tenants…"
        emptyMessage="No tenants yet — create the first one."
      />
    </div>
  );
}

function NewTenantForm({ onDone }: { onDone: () => void }) {
  const create = useCreateTenant();
  const [name, setName] = useState('');
  const [appName, setAppName] = useState('');
  const [accentColor, setAccentColor] = useState('#D97706');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ name, branding: { appName: appName || undefined, accentColor } });
    onDone();
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>New tenant</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Institute name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>App name (optional)</Label>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Accent color</Label>
            <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-16 p-1" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create tenant'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
