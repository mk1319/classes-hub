export type QuestionType = 'mcq_single' | 'mcq_multi' | 'text' | 'match' | 'odd_one_out';

export interface Question {
  id: number;
  subject_id: number | null;
  type: QuestionType;
  body: string;
  options: { id: string; text: string }[] | null;
  answer_key: unknown;
  solution: string | null;
  solution_image_url: string | null;
  created_by: number | null;
  created_at: string;
}

export interface Test {
  id: number;
  batch_id: number;
  title: string;
  negative_marking: boolean;
  negative_marking_value: number;
  reveal_results: boolean;
  created_at: string;
}

export interface CreateTestBody {
  batchId: number;
  title: string;
  negativeMarking?: boolean;
  negativeMarkingValue?: number;
  revealResults?: boolean;
  questions?: { questionId: number; position?: number; marks?: number }[];
}
