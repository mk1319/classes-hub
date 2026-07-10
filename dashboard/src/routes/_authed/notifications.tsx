import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAnnouncements, useCreateAnnouncement, type Announcement } from '@/features/notifications/api';
import { useCourses } from '@/features/courses/api';

export const Route = createFileRoute('/_authed/notifications')({ component: NotificationsPage });

function NotificationsPage() {
  const { data, isLoading } = useAnnouncements();

  const columns: Column<Announcement>[] = [
    { key: 'title', header: 'Title', render: (a) => <span className="font-medium">{a.title}</span>, sortValue: (a) => a.title },
    { key: 'scope', header: 'Scope', render: (a) => <Badge tone="primary">{a.scope}</Badge>, sortValue: (a) => a.scope },
    { key: 'body', header: 'Message', render: (a) => <span className="line-clamp-1 text-muted">{a.body}</span> },
    { key: 'sent', header: 'Sent', render: (a) => (a.sent_at ? new Date(a.sent_at).toLocaleString() : '—'), sortValue: (a) => a.sent_at ?? '' },
  ];

  return (
    <div>
      <PageHeader title="Announcements" description="Send push + in-app announcements to a batch, course, or the whole institute." />
      <NewAnnouncementForm />
      <DataTable columns={columns} rows={data} isLoading={isLoading} getRowKey={(a) => a.id} filterPlaceholder="Filter announcements…" emptyMessage="No announcements sent yet." />
    </div>
  );
}

function NewAnnouncementForm() {
  const create = useCreateAnnouncement();
  const { data: courses } = useCourses();
  const [scope, setScope] = useState<'tenant' | 'course' | 'batch'>('tenant');
  const [scopeId, setScopeId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const res = await create.mutateAsync({
      scope,
      scopeId: scope === 'tenant' ? undefined : Number(scopeId),
      title,
      body,
    });
    setResult(`Sent — push targeted ${res.pushTargeted} device(s).`);
    setTitle('');
    setBody('');
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>New announcement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="w-full">
                <option value="tenant">Whole institute</option>
                <option value="course">A course</option>
                <option value="batch">A batch</option>
              </Select>
            </div>
            {scope === 'course' && (
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="w-full">
                  <option value="">Select…</option>
                  {courses?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {scope === 'batch' && (
              <div className="space-y-1.5">
                <Label>Batch ID</Label>
                <Input value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="Batch id" />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <textarea
              className="h-24 w-full rounded-md border border-border bg-surface p-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Sending…' : 'Send'}
            </Button>
            {result && <span className="text-sm text-success">{result}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
