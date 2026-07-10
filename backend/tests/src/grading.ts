// backend/tests/src/grading.ts
//
// Pure grading logic — no DB, no I/O — so the marking rules can be unit-tested
// in isolation. See plan/03-features-v1.md §Grading flow.

export type QuestionType = 'mcq_single' | 'mcq_multi' | 'text' | 'match' | 'odd_one_out';

export interface GradableQuestion {
  type: QuestionType | string;
  answer_key: unknown;
}

export interface GradeConfig {
  marks: number;
  negativeMarking: boolean;
  negativeMarkingValue: number;
}

export interface GradeResult {
  /** true/false for auto-graded types; null when it needs manual review. */
  isCorrect: boolean | null;
  /** marks awarded for auto-graded types; null when it needs manual review. */
  marksAwarded: number | null;
  /** whether this answer is deferred to a teacher (text, or match with no key). */
  manual: boolean;
}

function isBlank(answer: unknown): boolean {
  return (
    answer === null ||
    answer === undefined ||
    answer === '' ||
    (Array.isArray(answer) && answer.length === 0)
  );
}

function sameSet(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(String));
  return b.every((x) => sa.has(String(x)));
}

function sameMap(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => String(ao[k]) === String(bo[k]));
}

/**
 * Grade a single answer. Auto-graded types return concrete marks/correctness;
 * manual types (text, match without an answer key) return `manual: true` with
 * null marks so they queue for teacher review.
 */
export function gradeAnswer(
  question: GradableQuestion,
  answer: unknown,
  config: GradeConfig
): GradeResult {
  const manualResult: GradeResult = { isCorrect: null, marksAwarded: null, manual: true };

  switch (question.type) {
    case 'text':
      return manualResult;
    case 'match':
      if (question.answer_key == null) return manualResult;
      return score(sameMap(answer, question.answer_key), answer, config);
    case 'mcq_multi':
      return score(sameSet(answer, question.answer_key), answer, config);
    case 'mcq_single':
    case 'odd_one_out':
      return score(String(answer) === String(question.answer_key), answer, config);
    default:
      return manualResult;
  }
}

function score(correct: boolean, answer: unknown, config: GradeConfig): GradeResult {
  if (isBlank(answer)) {
    // Unanswered questions never incur a negative-marking penalty.
    return { isCorrect: false, marksAwarded: 0, manual: false };
  }
  if (correct) return { isCorrect: true, marksAwarded: config.marks, manual: false };
  const penalty = config.negativeMarking ? -Math.abs(config.negativeMarkingValue) : 0;
  return { isCorrect: false, marksAwarded: penalty, manual: false };
}
