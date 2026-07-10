import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { ScopePicker, type Scope } from '@/components/ScopePicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { useChapters, useCoverage, useCreateChapter, useLogCoverage } from '@/features/syllabus/api';

export const Route = createFileRoute('/_authed/syllabus')({ component: SyllabusPage });

function SyllabusPage() {
  const [scope, setScope] = useState<Scope>({ courseId: 0, subjectId: 0, batchId: 0 });

  return (
    <div>
      <PageHeader title="Syllabus" description="Optional chapter list per subject, and a coverage log per batch." />
      <ScopePicker onChange={setScope} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {scope.subjectId > 0 && <Chapters subjectId={scope.subjectId} />}
        {scope.batchId > 0 && <CoverageLog subjectId={scope.subjectId} batchId={scope.batchId} />}
      </div>
      {scope.subjectId === 0 && <p className="text-sm text-muted">Pick a subject (and optionally a batch).</p>}
    </div>
  );
}

function Chapters({ subjectId }: { subjectId: number }) {
  const { data } = useChapters(subjectId);
  const create = useCreateChapter(subjectId);
  const [title, setTitle] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chapters</CardTitle>
        <CardDescription>Predefined list for this subject (optional).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await create.mutateAsync({ title, position: (data?.length ?? 0) + 1 });
            setTitle('');
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ch 1: Kinematics" />
          <Button type="submit">Add</Button>
        </form>
        <ol className="list-inside list-decimal space-y-1 text-sm">
          {data?.map((c) => <li key={c.id}>{c.title}</li>)}
          {data?.length === 0 && <p className="text-muted">No chapters — free-form coverage still works.</p>}
        </ol>
      </CardContent>
    </Card>
  );
}

function CoverageLog({ subjectId, batchId }: { subjectId: number; batchId: number }) {
  const { data } = useCoverage(batchId);
  const { data: chapters } = useChapters(subjectId);
  const log = useLogCoverage(batchId);
  const [form, setForm] = useState({ chapterId: '', title: '', coveredDate: '', notes: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await log.mutateAsync({
      chapterId: form.chapterId ? Number(form.chapterId) : undefined,
      title: form.chapterId ? undefined : form.title,
      coveredDate: form.coveredDate,
      notes: form.notes || undefined,
    });
    setForm({ chapterId: '', title: '', coveredDate: '', notes: '' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage log</CardTitle>
        <CardDescription>Standalone by date — works for makeup/extra classes too.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Chapter</Label>
              <Select
                value={form.chapterId}
                onChange={(e) => setForm((f) => ({ ...f, chapterId: e.target.value }))}
                className="w-full"
              >
                <option value="">Free-form…</option>
                {chapters?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.coveredDate} onChange={(e) => setForm((f) => ({ ...f, coveredDate: e.target.value }))} required />
            </div>
          </div>
          {!form.chapterId && (
            <div className="space-y-1.5">
              <Label>What was covered</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Projectile motion basics" required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button type="submit" disabled={log.isPending}>
            Log coverage
          </Button>
        </form>
        <ul className="space-y-1 text-sm">
          {data?.map((c) => (
            <li key={c.id} className="flex justify-between border-b border-border py-1 last:border-0">
              <span>{c.title}</span>
              <span className="text-muted">{c.covered_date}</span>
            </li>
          ))}
          {data?.length === 0 && <p className="text-muted">Nothing logged yet.</p>}
        </ul>
      </CardContent>
    </Card>
  );
}
