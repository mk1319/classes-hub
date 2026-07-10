import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { ScopePicker, type Scope } from '@/components/ScopePicker';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCreateSession, useDeleteSession, useSessions, type Session } from '@/features/timetable/api';

export const Route = createFileRoute('/_authed/timetable')({ component: TimetablePage });

function TimetablePage() {
  const [scope, setScope] = useState<Scope>({ courseId: 0, subjectId: 0, batchId: 0 });
  const batchId = scope.batchId;
  const { data, isLoading } = useSessions(batchId);
  const del = useDeleteSession(batchId);

  const columns: Column<Session>[] = [
    { key: 'date', header: 'Date', render: (s) => s.session_date, sortValue: (s) => s.session_date },
    { key: 'time', header: 'Time', render: (s) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}` },
    { key: 'title', header: 'Title', render: (s) => s.title ?? '—' },
    { key: 'rec', header: 'Recurrence', render: (s) => (s.series_id ? <Badge tone="primary">series</Badge> : 'one-off') },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => del.mutate({ sessionId: s.id })}>
            Delete
          </Button>
          {s.series_id && (
            <Button variant="ghost" size="sm" onClick={() => del.mutate({ sessionId: s.id, series: true })}>
              Delete series
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Timetable" description="Per-batch schedule. Pick a batch to view and add sessions." />
      <ScopePicker onChange={setScope} />
      {batchId > 0 ? (
        <>
          <NewSessionForm batchId={batchId} />
          <DataTable columns={columns} rows={data} isLoading={isLoading} getRowKey={(s) => s.id} emptyMessage="No sessions scheduled." />
        </>
      ) : (
        <p className="text-sm text-muted">Select a batch to manage its schedule.</p>
      )}
    </div>
  );
}

function NewSessionForm({ batchId }: { batchId: number }) {
  const create = useCreateSession(batchId);
  const [form, setForm] = useState({ title: '', sessionDate: '', startTime: '09:00', endTime: '10:00', recurrence: 'none', recurUntil: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      title: form.title || undefined,
      sessionDate: form.sessionDate,
      startTime: form.startTime,
      endTime: form.endTime,
      recurrence: form.recurrence as 'none' | 'weekly',
      recurUntil: form.recurrence === 'weekly' ? form.recurUntil : undefined,
    });
    setForm((f) => ({ ...f, title: '' }));
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Add session</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={set('title')} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.sessionDate} onChange={set('sessionDate')} required />
          </div>
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input type="time" value={form.startTime} onChange={set('startTime')} required />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <Input type="time" value={form.endTime} onChange={set('endTime')} required />
          </div>
          <div className="space-y-1.5">
            <Label>Repeat</Label>
            <Select value={form.recurrence} onChange={set('recurrence')} className="w-full">
              <option value="none">One-off</option>
              <option value="weekly">Weekly</option>
            </Select>
          </div>
          {form.recurrence === 'weekly' && (
            <div className="space-y-1.5">
              <Label>Until</Label>
              <Input type="date" value={form.recurUntil} onChange={set('recurUntil')} required />
            </div>
          )}
          <div className="sm:col-span-6">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add session'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
