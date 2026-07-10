import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useAssignTeacher,
  useBatches,
  useBatchTeachers,
  useCourse,
  useCreateBatch,
  useCreateSubject,
  useEnrollStudent,
  useEnrollments,
  useSubjects,
  useUpdateBatch,
} from '@/features/courses/api';
import { useUsers } from '@/features/users/api';

export const Route = createFileRoute('/_authed/courses/$courseId')({ component: CourseDetail });

function CourseDetail() {
  const { courseId } = Route.useParams();
  const id = Number(courseId);
  const { data: course } = useCourse(id);
  const { data: subjects } = useSubjects(id);
  const createSubject = useCreateSubject(id);
  const [name, setName] = useState('');
  const [openSubject, setOpenSubject] = useState<number | null>(null);

  return (
    <div>
      <PageHeader
        title={course?.name ?? 'Course'}
        description="Manage subjects, batches, teacher assignments and enrollment."
        action={
          <Link to="/courses">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subjects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await createSubject.mutateAsync({ name });
              setName('');
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New subject name" className="max-w-xs" />
            <Button type="submit" disabled={createSubject.isPending}>
              Add subject
            </Button>
          </form>

          <div className="divide-y divide-border">
            {(subjects ?? []).map((s) => (
              <div key={s.id} className="py-2">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setOpenSubject(openSubject === s.id ? null : s.id)}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted">{openSubject === s.id ? '−' : '+'}</span>
                </button>
                {openSubject === s.id && <SubjectBatches subjectId={s.id} />}
              </div>
            ))}
            {subjects?.length === 0 && <p className="py-4 text-sm text-muted">No subjects yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SubjectBatches({ subjectId }: { subjectId: number }) {
  const { data: batches } = useBatches(subjectId);
  const createBatch = useCreateBatch(subjectId);
  const [name, setName] = useState('');
  const [openBatch, setOpenBatch] = useState<number | null>(null);

  return (
    <div className="mt-3 space-y-3 rounded-md bg-bg p-3">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await createBatch.mutateAsync({ name });
          setName('');
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New batch name" className="max-w-xs" />
        <Button type="submit" size="sm" disabled={createBatch.isPending}>
          Add batch
        </Button>
      </form>
      {(batches ?? []).map((b) => (
        <div key={b.id} className="rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{b.name}</span>
              {b.show_progress_to_students && <Badge tone="primary">progress visible</Badge>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpenBatch(openBatch === b.id ? null : b.id)}>
              {openBatch === b.id ? 'Hide' : 'Manage'}
            </Button>
          </div>
          {openBatch === b.id && <BatchManage batchId={b.id} showProgress={b.show_progress_to_students} />}
        </div>
      ))}
    </div>
  );
}

function BatchManage({ batchId, showProgress }: { batchId: number; showProgress: boolean }) {
  const update = useUpdateBatch(batchId);
  const { data: teachers } = useBatchTeachers(batchId);
  const { data: students } = useEnrollments(batchId);
  const assign = useAssignTeacher(batchId);
  const enroll = useEnrollStudent(batchId);
  const { data: allTeachers } = useUsers('teacher');
  const { data: allStudents } = useUsers('student');
  const [teacherId, setTeacherId] = useState('');
  const [studentId, setStudentId] = useState('');

  return (
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label>Student progress visibility</Label>
        <Button
          size="sm"
          variant={showProgress ? 'primary' : 'outline'}
          onClick={() => update.mutate({ showProgressToStudents: !showProgress })}
        >
          {showProgress ? 'On' : 'Off'}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Teachers ({teachers?.length ?? 0})</Label>
        <ul className="text-sm text-muted">{teachers?.map((t) => <li key={t.id}>{t.name}</li>)}</ul>
        <div className="flex gap-2">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Add teacher…</option>
            {allTeachers?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button size="sm" disabled={!teacherId} onClick={() => teacherId && assign.mutate(Number(teacherId))}>
            Assign
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Enrolled ({students?.length ?? 0})</Label>
        <ul className="max-h-24 overflow-auto text-sm text-muted">{students?.map((s) => <li key={s.id}>{s.name}</li>)}</ul>
        <div className="flex gap-2">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Enroll student…</option>
            {allStudents?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button size="sm" disabled={!studentId} onClick={() => studentId && enroll.mutate(Number(studentId))}>
            Enroll
          </Button>
        </div>
      </div>
    </div>
  );
}
