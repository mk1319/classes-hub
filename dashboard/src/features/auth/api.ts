// dashboard/src/features/auth/api.ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { setToken, clearToken } from '@/lib/auth';

interface LoginInput {
  email: string;
  password: string;
  deviceId: string;
}

interface LoginResult {
  token: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<LoginResult>('/auth/login', { method: 'POST', body: input, anonymous: true }),
    onSuccess: (data) => setToken(data.token),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => clearToken(),
  });
}
