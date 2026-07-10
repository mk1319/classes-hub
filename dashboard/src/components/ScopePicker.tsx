import { useState } from 'react';
import { Label, Select } from '@/components/ui/input';
import { useBatches, useCourses, useSubjects } from '@/features/courses/api';

export interface Scope {
  courseId: number;
  subjectId: number;
  batchId: number;
}

/*
 * Cascading course → subject → batch selector. Several batch-scoped screens
 * (tests, timetable, resources, syllabus) need the same picker, so it lives in
 * components/ (shared). Emits ids (0 = none selected) as the user drills down.
 */
export function ScopePicker({
  onChange,
  need = 'batch',
}: {
  onChange: (scope: Scope) => void;
  need?: 'subject' | 'batch';
}) {
  const [courseId, setCourseId] = useState(0);
  const [subjectId, setSubjectId] = useState(0);
  const [batchId, setBatchId] = useState(0);

  const { data: courses } = useCourses();
  const { data: subjects } = useSubjects(courseId);
  const { data: batches } = useBatches(subjectId);

  function emit(next: Partial<Scope>) {
    const scope = { courseId, subjectId, batchId, ...next };
    onChange(scope);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label>Course</Label>
        <Select
          value={courseId}
          onChange={(e) => {
            const v = Number(e.target.value);
            setCourseId(v);
            setSubjectId(0);
            setBatchId(0);
            emit({ courseId: v, subjectId: 0, batchId: 0 });
          }}
        >
          <option value={0}>Select…</option>
          {courses?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Subject</Label>
        <Select
          value={subjectId}
          disabled={!courseId}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSubjectId(v);
            setBatchId(0);
            emit({ subjectId: v, batchId: 0 });
          }}
        >
          <option value={0}>Select…</option>
          {subjects?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {need === 'batch' && (
        <div className="space-y-1.5">
          <Label>Batch</Label>
          <Select
            value={batchId}
            disabled={!subjectId}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBatchId(v);
              emit({ batchId: v });
            }}
          >
            <option value={0}>Select…</option>
            {batches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
