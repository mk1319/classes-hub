import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { CreateTenantBody, Tenant } from './types';

const key = ['tenants'];

export function useTenants() {
  return useQuery({ queryKey: key, queryFn: () => apiFetch<Tenant[]>('/tenants') });
}

export function useTenant(id: number) {
  return useQuery({ queryKey: [...key, id], queryFn: () => apiFetch<Tenant>(`/tenants/${id}`) });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTenantBody) => apiFetch<Tenant>('/tenants', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateTenant(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateTenantBody>) => apiFetch<Tenant>(`/tenants/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
