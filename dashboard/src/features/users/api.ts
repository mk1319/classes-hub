import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { BulkImportResult, CreateUserBody, Role, SessionRecord, User } from './types';

const key = ['users'];

export function useUsers(role?: Role) {
  return useQuery({
    queryKey: [...key, { role }],
    queryFn: () => apiFetch<User[]>(`/users${role ? `?role=${role}` : ''}`),
  });
}

export function useUser(id: number) {
  return useQuery({ queryKey: [...key, id], queryFn: () => apiFetch<User>(`/users/${id}`) });
}

export function useUserSessions(id: number) {
  return useQuery({
    queryKey: [...key, id, 'sessions'],
    queryFn: () => apiFetch<SessionRecord[]>(`/users/${id}/sessions`),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) => apiFetch<User>('/users', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useBulkImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => apiFetch<BulkImportResult>('/users/bulk-import', { method: 'POST', body: { csv } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
