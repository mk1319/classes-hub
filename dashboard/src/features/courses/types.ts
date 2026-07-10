export interface Course {
  id: number;
  tenant_id: number;
  name: string;
  type: string | null;
  created_at: string;
}

export interface Subject {
  id: number;
  tenant_id: number;
  course_id: number;
  name: string;
  created_at: string;
}

export interface Batch {
  id: number;
  tenant_id: number;
  subject_id: number;
  name: string;
  schedule_info: string | null;
  show_progress_to_students: boolean;
  created_at: string;
}

export interface Person {
  id: number;
  name: string;
  email: string;
}
