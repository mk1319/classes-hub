// backend/tests/src/schema.ts
import { z } from 'zod';

export const questionType = z.enum(['mcq_single', 'mcq_multi', 'text', 'match', 'odd_one_out']);

const optionSchema = z.object({ id: z.string().min(1), text: z.string() });

export const createQuestionSchema = z.object({
  subjectId: z.number().int().positive().optional(),
  type: questionType,
  body: z.string().min(1),
  options: z.array(optionSchema).optional(),
  // answer_key shape is validated at grade-time by type; accept any JSON here.
  answerKey: z.unknown().optional(),
  solution: z.string().optional(),
  solutionImageUrl: z.string().url().optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Provide at least one field' }
);

export const createTestSchema = z.object({
  batchId: z.number().int().positive(),
  title: z.string().min(1),
  negativeMarking: z.boolean().optional(),
  negativeMarkingValue: z.number().min(0).optional(),
  revealResults: z.boolean().optional(),
  questions: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        position: z.number().int().min(0).optional(),
        marks: z.number().positive().optional(),
      })
    )
    .optional(),
});

export const updateTestSchema = z
  .object({
    title: z.string().min(1).optional(),
    negativeMarking: z.boolean().optional(),
    negativeMarkingValue: z.number().min(0).optional(),
    revealResults: z.boolean().optional(),
    questions: createTestSchema.shape.questions,
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const submitAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.number().int().positive(),
      answer: z.unknown(),
    })
  ),
});

export const gradeAttemptSchema = z.object({
  grades: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        marksAwarded: z.number(),
        isCorrect: z.boolean().optional(),
      })
    )
    .min(1),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type CreateTestInput = z.infer<typeof createTestSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type GradeAttemptInput = z.infer<typeof gradeAttemptSchema>;
