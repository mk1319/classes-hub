import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface Chapter {
  id: number;
  subject_id: number;
  title: string;
  position: number;
}

export interface Coverage {
  id: number;
  batch_id: number;
  chapter_id: number | null;
  title: string | null;
  covered_date: string;
  notes: string | null;
}

export function useChapters(subjectId: number) {
  return useQuery({
    queryKey: ['chapters', subjectId],
    queryFn: () => apiFetch<Chapter[]>(`/subjects/${subjectId}/chapters`),
    enabled: subjectId > 0,
  });
}

export function useCreateChapter(subjectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; position?: number }) =>
      apiFetch<Chapter>(`/subjects/${subjectId}/chapters`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chapters', subjectId] }),
  });
}

export function useCoverage(batchId: number) {
  return useQuery({
    queryKey: ['coverage', batchId],
    queryFn: () => apiFetch<Coverage[]>(`/batches/${batchId}/coverage`),
    enabled: batchId > 0,
  });
}

export function useLogCoverage(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { chapterId?: number; title?: string; coveredDate: string; notes?: string }) =>
      apiFetch<Coverage>(`/batches/${batchId}/coverage`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coverage', batchId] }),
  });
}
