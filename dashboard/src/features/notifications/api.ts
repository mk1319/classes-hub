import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface Announcement {
  id: number;
  scope: 'tenant' | 'course' | 'batch';
  scope_id: number | null;
  title: string;
  body: string;
  sent_at: string | null;
  created_at: string;
}

export interface CreateAnnouncementBody {
  scope: 'tenant' | 'course' | 'batch';
  scopeId?: number;
  title: string;
  body: string;
}

export function useAnnouncements(scope?: string) {
  return useQuery({
    queryKey: ['announcements', { scope }],
    queryFn: () => apiFetch<Announcement[]>(`/announcements${scope ? `?scope=${scope}` : ''}`),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAnnouncementBody) =>
      apiFetch<Announcement & { pushTargeted: number }>('/announcements', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}
