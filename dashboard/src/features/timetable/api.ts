import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface Session {
  id: number;
  batch_id: number;
  title: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  recurrence: 'none' | 'weekly';
  series_id: string | null;
}

export interface CreateSessionBody {
  title?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  recurrence?: 'none' | 'weekly';
  recurUntil?: string;
}

export function useSessions(batchId: number) {
  return useQuery({
    queryKey: ['timetable', batchId],
    queryFn: () => apiFetch<Session[]>(`/batches/${batchId}/sessions`),
    enabled: batchId > 0,
  });
}

export function useCreateSession(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSessionBody) =>
      apiFetch<Session[]>(`/batches/${batchId}/sessions`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable', batchId] }),
  });
}

export function useDeleteSession(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, series }: { sessionId: number; series?: boolean }) =>
      apiFetch<void>(`/batches/${batchId}/sessions/${sessionId}${series ? '?series=true' : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable', batchId] }),
  });
}
