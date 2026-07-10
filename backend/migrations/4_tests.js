/* eslint-disable camelcase */

// Question bank, test builder, attempts, and grading.
// See plan/02-domain-model.md and plan/03-features-v1.md §Tests & Assignments.
//
// Question types (V1): mcq_single, mcq_multi, text, match, odd_one_out.
//   - options   : jsonb array of { id, text } (choice-based types)
//   - answer_key : jsonb — shape depends on type:
//       mcq_single / odd_one_out -> "optionId"
//       mcq_multi                -> ["optionId", ...] (order-independent set)
//       match                    -> { leftId: rightId, ... } (null => manual)
//       text                     -> null (always manually graded)

exports.up = (pgm) => {
  pgm.createTable('questions', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    subject_id: { type: 'integer', references: 'subjects', onDelete: 'SET NULL' },
    type: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    options: { type: 'jsonb' },
    answer_key: { type: 'jsonb' },
    solution: { type: 'text' },
    solution_image_url: { type: 'text' },
    created_by: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('questions', 'tenant_id');
  pgm.createIndex('questions', 'subject_id');

  pgm.createTable('tests', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    batch_id: { type: 'integer', notNull: true, references: 'batches', onDelete: 'CASCADE' },
    title: { type: 'text', notNull: true },
    negative_marking: { type: 'boolean', notNull: true, default: false },
    negative_marking_value: { type: 'numeric', notNull: true, default: 0 },
    reveal_results: { type: 'boolean', notNull: true, default: true },
    created_by: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('tests', 'tenant_id');
  pgm.createIndex('tests', 'batch_id');

  pgm.createTable('test_questions', {
    test_id: { type: 'integer', notNull: true, references: 'tests', onDelete: 'CASCADE' },
    question_id: { type: 'integer', notNull: true, references: 'questions', onDelete: 'CASCADE' },
    position: { type: 'integer', notNull: true, default: 0 },
    marks: { type: 'numeric', notNull: true, default: 1 },
  });
  pgm.addConstraint('test_questions', 'test_questions_pkey', {
    primaryKey: ['test_id', 'question_id'],
  });

  pgm.createTable('test_attempts', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    test_id: { type: 'integer', notNull: true, references: 'tests', onDelete: 'CASCADE' },
    student_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    // in_progress -> submitted -> graded
    status: { type: 'text', notNull: true, default: 'in_progress' },
    score: { type: 'numeric' },
    started_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    submitted_at: { type: 'timestamptz' },
  });
  pgm.createIndex('test_attempts', 'test_id');
  pgm.createIndex('test_attempts', 'student_id');

  pgm.createTable('attempt_answers', {
    id: 'id',
    attempt_id: { type: 'integer', notNull: true, references: 'test_attempts', onDelete: 'CASCADE' },
    question_id: { type: 'integer', notNull: true, references: 'questions', onDelete: 'CASCADE' },
    answer: { type: 'jsonb' },
    marks_awarded: { type: 'numeric' },
    is_correct: { type: 'boolean' },
    graded_by: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
  });
  pgm.addConstraint('attempt_answers', 'attempt_answers_unique', {
    unique: ['attempt_id', 'question_id'],
  });
  pgm.createIndex('attempt_answers', 'attempt_id');
};

exports.down = (pgm) => {
  pgm.dropTable('attempt_answers');
  pgm.dropTable('test_attempts');
  pgm.dropTable('test_questions');
  pgm.dropTable('tests');
  pgm.dropTable('questions');
};
