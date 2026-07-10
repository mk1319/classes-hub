export type Role = 'teacher' | 'student';

export interface User {
  id: number;
  tenant_id: number;
  role: string;
  email: string;
  name: string;
  created_at: string;
}

export interface CreateUserBody {
  email: string;
  name: string;
  role: Role;
  password: string;
}

export interface SessionRecord {
  id: number;
  device_id: string;
  device_model: string | null;
  os_version: string | null;
  app_version: string | null;
  ip_address: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BulkImportResult {
  created: number;
  errors: { row: number; email: string; error: string }[];
}
