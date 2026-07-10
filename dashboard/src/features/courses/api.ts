import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Batch, Course, Person, Subject } from './types';

const courses = ['courses'];

export function useCourses() {
  return useQuery({ queryKey: courses, queryFn: () => apiFetch<Course[]>('/courses') });
}
export function useCourse(id: number) {
  return useQuery({ queryKey: [...courses, id], queryFn: () => apiFetch<Course>(`/courses/${id}`) });
}
export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type?: string }) => apiFetch<Course>('/courses', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: courses }),
  });
}

export function useSubjects(courseId: number) {
  return useQuery({
    queryKey: [...courses, courseId, 'subjects'],
    queryFn: () => apiFetch<Subject[]>(`/courses/${courseId}/subjects`),
  });
}
export function useCreateSubject(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      apiFetch<Subject>(`/courses/${courseId}/subjects`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...courses, courseId, 'subjects'] }),
  });
}

export function useBatches(subjectId: number) {
  return useQuery({
    queryKey: ['subjects', subjectId, 'batches'],
    queryFn: () => apiFetch<Batch[]>(`/subjects/${subjectId}/batches`),
    enabled: subjectId > 0,
  });
}
export function useCreateBatch(subjectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scheduleInfo?: string }) =>
      apiFetch<Batch>(`/subjects/${subjectId}/batches`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects', subjectId, 'batches'] }),
  });
}

export function useBatch(batchId: number) {
  return useQuery({
    queryKey: ['batches', batchId],
    queryFn: () => apiFetch<Batch>(`/batches/${batchId}`),
    enabled: batchId > 0,
  });
}
export function useUpdateBatch(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; scheduleInfo?: string; showProgressToStudents?: boolean }) =>
      apiFetch<Batch>(`/batches/${batchId}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches', batchId] }),
  });
}

export function useBatchTeachers(batchId: number) {
  return useQuery({
    queryKey: ['batches', batchId, 'teachers'],
    queryFn: () => apiFetch<Person[]>(`/batches/${batchId}/teachers`),
    enabled: batchId > 0,
  });
}
export function useAssignTeacher(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      apiFetch<void>(`/batches/${batchId}/teachers`, { method: 'POST', body: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches', batchId, 'teachers'] }),
  });
}

export function useEnrollments(batchId: number) {
  return useQuery({
    queryKey: ['batches', batchId, 'enrollments'],
    queryFn: () => apiFetch<Person[]>(`/batches/${batchId}/enrollments`),
    enabled: batchId > 0,
  });
}
export function useEnrollStudent(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: number) =>
      apiFetch<void>(`/batches/${batchId}/enrollments`, { method: 'POST', body: { studentId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches', batchId, 'enrollments'] }),
  });
}
