// dashboard/src/features/auth/api.ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { setToken } from '@/lib/auth';

export interface LoginBody {
  email: string;
  password: string;
}
export interface LoginResult {
  token: string;
}

// The dashboard is a web client; deviceId is a fixed marker so the backend's
// session tracking still records a row (single-active-session is really about
// the student app — plan/15-account-security-anti-fraud.md).
const WEB_DEVICE_ID = 'dashboard-web';

export function useLogin() {
  return useMutation({
    mutationFn: (body: LoginBody) =>
      apiFetch<LoginResult>('/auth/login', {
        method: 'POST',
        anonymous: true,
        body: { ...body, deviceId: WEB_DEVICE_ID, deviceModel: 'web', appVersion: 'dashboard' },
      }),
    onSuccess: (data) => setToken(data.token),
  });
}
