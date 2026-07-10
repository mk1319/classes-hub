import { describe, it, expect } from 'vitest';
import { gradeAnswer } from '../src/grading';

const cfg = (over = {}) => ({ marks: 4, negativeMarking: false, negativeMarkingValue: 1, ...over });

describe('gradeAnswer', () => {
  it('auto-grades mcq_single correct/incorrect', () => {
    const q = { type: 'mcq_single', answer_key: 'b' };
    expect(gradeAnswer(q, 'b', cfg())).toEqual({ isCorrect: true, marksAwarded: 4, manual: false });
    expect(gradeAnswer(q, 'a', cfg())).toEqual({ isCorrect: false, marksAwarded: 0, manual: false });
  });

  it('applies negative marking only to attempted wrong answers', () => {
    const q = { type: 'mcq_single', answer_key: 'b' };
    expect(gradeAnswer(q, 'a', cfg({ negativeMarking: true, negativeMarkingValue: 1 })).marksAwarded).toBe(-1);
    // Unanswered => no penalty.
    expect(gradeAnswer(q, null, cfg({ negativeMarking: true, negativeMarkingValue: 1 })).marksAwarded).toBe(0);
  });

  it('grades mcq_multi as an order-independent set', () => {
    const q = { type: 'mcq_multi', answer_key: ['a', 'c'] };
    expect(gradeAnswer(q, ['c', 'a'], cfg()).isCorrect).toBe(true);
    expect(gradeAnswer(q, ['a'], cfg()).isCorrect).toBe(false);
    expect(gradeAnswer(q, ['a', 'b'], cfg()).isCorrect).toBe(false);
  });

  it('grades odd_one_out automatically', () => {
    const q = { type: 'odd_one_out', answer_key: '3' };
    expect(gradeAnswer(q, '3', cfg()).isCorrect).toBe(true);
    expect(gradeAnswer(q, 3, cfg()).isCorrect).toBe(true); // number/string coerced
  });

  it('auto-grades match when a key is present, else manual', () => {
    const withKey = { type: 'match', answer_key: { 1: 'a', 2: 'b' } };
    expect(gradeAnswer(withKey, { 1: 'a', 2: 'b' }, cfg()).isCorrect).toBe(true);
    expect(gradeAnswer(withKey, { 1: 'a', 2: 'x' }, cfg()).isCorrect).toBe(false);
    const noKey = { type: 'match', answer_key: null };
    expect(gradeAnswer(noKey, { 1: 'a' }, cfg()).manual).toBe(true);
  });

  it('defers text answers to manual grading', () => {
    const q = { type: 'text', answer_key: null };
    expect(gradeAnswer(q, 'an essay', cfg())).toEqual({ isCorrect: null, marksAwarded: null, manual: true });
  });
});
