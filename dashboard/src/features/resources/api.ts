import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, fileUrl } from '@/lib/api';

export type ResourceType = 'pdf' | 'document' | 'image' | 'video';

export interface Resource {
  id: number;
  subject_id: number | null;
  batch_id: number | null;
  type: ResourceType;
  title: string;
  storage_type: 'upload' | 'link';
  link_url: string | null;
  is_downloadable: boolean;
  created_at: string;
}

export interface CreateResourceBody {
  subjectId?: number;
  batchId?: number;
  type: ResourceType;
  title: string;
  storageType: 'upload' | 'link';
  linkUrl?: string;
  isDownloadable?: boolean;
  file?: { filename: string; mimeType: string; dataBase64: string };
}

export function useResources(filters: { subjectId?: number; batchId?: number } = {}) {
  const qs = new URLSearchParams();
  if (filters.subjectId) qs.set('subjectId', String(filters.subjectId));
  if (filters.batchId) qs.set('batchId', String(filters.batchId));
  const suffix = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: ['resources', filters],
    queryFn: () => apiFetch<Resource[]>(`/resources${suffix}`),
  });
}

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateResourceBody) => apiFetch<Resource>('/resources', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/resources/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

/** Direct URL to open an uploaded resource's bytes (link resources use link_url). */
export function resourceFileUrl(id: number): string {
  return fileUrl(`/resources/${id}/file`);
}
