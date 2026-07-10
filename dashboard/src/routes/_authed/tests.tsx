import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { ScopePicker, type Scope } from '@/components/ScopePicker';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCreateQuestion, useCreateTest, useQuestions, useTests, type Test } from '@/features/tests/api';

export const Route = createFileRoute('/_authed/tests')({ component: TestsPage });

function TestsPage() {
  const [scope, setScope] = useState<Scope>({ courseId: 0, subjectId: 0, batchId: 0 });
  const { data: tests, isLoading } = useTests(scope.batchId || undefined);

  const columns: Column<Test>[] = [
    { key: 'title', header: 'Title', render: (t) => <span className="font-medium">{t.title}</span>, sortValue: (t) => t.title },
    {
      key: 'neg',
      header: 'Negative marking',
      render: (t) => (t.negative_marking ? <Badge tone="warning">−{t.negative_marking_value}</Badge> : <Badge>off</Badge>),
    },
    {
      key: 'reveal',
      header: 'Reveal results',
      render: (t) => (t.reveal_results ? <Badge tone="success">on</Badge> : <Badge>off</Badge>),
    },
    { key: 'created', header: 'Created', render: (t) => new Date(t.created_at).toLocaleDateString(), sortValue: (t) => t.created_at },
  ];

  return (
    <div>
      <PageHeader title="Tests" description="Build tests from the reusable question bank, per batch." />
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuestionBank subjectId={scope.subjectId} />
        <div>
          <ScopePicker onChange={setScope} />
          {scope.batchId > 0 && scope.subjectId > 0 && <NewTestForm batchId={scope.batchId} subjectId={scope.subjectId} />}
        </div>
      </div>
      <DataTable columns={columns} rows={tests} isLoading={isLoading} getRowKey={(t) => t.id} filterPlaceholder="Filter tests…" emptyMessage={scope.batchId ? 'No tests for this batch yet.' : 'Pick a batch, or view all your tests.'} />
    </div>
  );
}

function QuestionBank({ subjectId }: { subjectId: number }) {
  const { data } = useQuestions(subjectId ? { subjectId } : {});
  const create = useCreateQuestion();
  const [body, setBody] = useState('');
  const [correct, setCorrect] = useState('a');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      subjectId: subjectId || undefined,
      type: 'mcq_single',
      body,
      options: [
        { id: 'a', text: 'Option A' },
        { id: 'b', text: 'Option B' },
        { id: 'c', text: 'Option C' },
        { id: 'd', text: 'Option D' },
      ],
      answerKey: correct,
    });
    setBody('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question bank</CardTitle>
        <CardDescription>Reusable across tests. This form adds a quick 4-option MCQ; richer types via API.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={submit} className="space-y-2">
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Question text" required />
          <div className="flex items-center gap-2">
            <Label>Correct option</Label>
            <select className="h-9 rounded-md border border-border bg-surface px-2 text-sm" value={correct} onChange={(e) => setCorrect(e.target.value)}>
              {['a', 'b', 'c', 'd'].map((o) => (
                <option key={o} value={o}>
                  {o.toUpperCase()}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={create.isPending}>
              Add question
            </Button>
          </div>
        </form>
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {data?.map((q) => (
            <li key={q.id} className="flex items-center gap-2 border-b border-border py-1 last:border-0">
              <Badge>{q.type}</Badge>
              <span className="line-clamp-1">{q.body}</span>
            </li>
          ))}
          {data?.length === 0 && <p className="text-muted">No questions yet.</p>}
        </ul>
      </CardContent>
    </Card>
  );
}

function NewTestForm({ batchId, subjectId }: { batchId: number; subjectId: number }) {
  const { data: questions } = useQuestions(subjectId ? { subjectId } : {});
  const create = useCreateTest();
  const [title, setTitle] = useState('');
  const [reveal, setReveal] = useState(true);
  const [negative, setNegative] = useState(false);
  const [negValue, setNegValue] = useState(0.25);
  const [selected, setSelected] = useState<number[]>([]);

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      batchId,
      title,
      revealResults: reveal,
      negativeMarking: negative,
      negativeMarkingValue: negative ? negValue : 0,
      questions: selected.map((questionId, i) => ({ questionId, position: i, marks: 1 })),
    });
    setTitle('');
    setSelected([]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New test</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Reveal results after submission
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} /> Negative marking
            {negative && (
              <Input
                type="number"
                step="0.25"
                min="0"
                value={negValue}
                onChange={(e) => setNegValue(Number(e.target.value))}
                className="ml-2 h-8 w-20"
              />
            )}
          </label>
          <div>
            <Label>Questions ({selected.length} selected)</Label>
            <div className="mt-1 max-h-40 space-y-1 overflow-auto rounded-md border border-border p-2 text-sm">
              {questions?.map((q) => (
                <label key={q.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                  <span className="line-clamp-1">{q.body}</span>
                </label>
              ))}
              {questions?.length === 0 && <p className="text-muted">Add questions to the bank first.</p>}
            </div>
          </div>
          <Button type="submit" disabled={create.isPending || selected.length === 0}>
            {create.isPending ? 'Creating…' : 'Create test'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
