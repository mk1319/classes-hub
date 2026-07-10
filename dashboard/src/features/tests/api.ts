import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { CreateTestBody, Question, QuestionType, Test } from './types';

export type { Test, Question, QuestionType } from './types';

export function useQuestions(filters: { subjectId?: number; type?: QuestionType } = {}) {
  const qs = new URLSearchParams();
  if (filters.subjectId) qs.set('subjectId', String(filters.subjectId));
  if (filters.type) qs.set('type', filters.type);
  const suffix = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: ['questions', filters],
    queryFn: () => apiFetch<Question[]>(`/questions${suffix}`),
  });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch<Question>('/questions', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useTests(batchId?: number) {
  return useQuery({
    queryKey: ['tests', { batchId }],
    queryFn: () => apiFetch<Test[]>(`/tests${batchId ? `?batchId=${batchId}` : ''}`),
  });
}

export function useTest(id: number) {
  return useQuery({
    queryKey: ['tests', id],
    queryFn: () => apiFetch<Test & { questions: unknown[] }>(`/tests/${id}`),
    enabled: id > 0,
  });
}

export function useCreateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTestBody) => apiFetch<Test>('/tests', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tests'] }),
  });
}
