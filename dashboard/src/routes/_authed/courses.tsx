import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { useCourses, useCreateCourse } from '@/features/courses/api';
import type { Course } from '@/features/courses/types';

export const Route = createFileRoute('/_authed/courses')({ component: CoursesPage });

function CoursesPage() {
  const { data, isLoading } = useCourses();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  const columns: Column<Course>[] = [
    { key: 'name', header: 'Name', render: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
    { key: 'type', header: 'Type', render: (c) => c.type ?? '—', sortValue: (c) => c.type ?? '' },
    { key: 'created', header: 'Created', render: (c) => new Date(c.created_at).toLocaleDateString(), sortValue: (c) => c.created_at },
  ];

  return (
    <div>
      <PageHeader
        title="Courses"
        description="A course holds subjects, and each subject holds batches. Click a course to manage it."
        action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'New course'}</Button>}
      />
      {showForm && <NewCourseForm onDone={() => setShowForm(false)} />}
      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        getRowKey={(c) => c.id}
        onRowClick={(c) => navigate({ to: '/courses/$courseId', params: { courseId: String(c.id) } })}
        filterPlaceholder="Filter courses…"
        emptyMessage="No courses yet."
      />
    </div>
  );
}

function NewCourseForm({ onDone }: { onDone: () => void }) {
  const create = useCreateCourse();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ name, type: type || undefined });
    onDone();
  }
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>New course</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Class 10 / B.Com" required />
          </div>
          <div className="space-y-1.5">
            <Label>Type (optional)</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="school / professional" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
