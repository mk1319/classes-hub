export interface Branding {
  appName?: string;
  logoUrl?: string;
  accentColor?: string;
  flavor?: string;
}

export interface Tenant {
  id: number;
  name: string;
  branding: Branding;
  created_at: string;
}

export interface CreateTenantBody {
  name: string;
  branding?: Branding;
}
