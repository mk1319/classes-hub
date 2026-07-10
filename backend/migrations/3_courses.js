/* eslint-disable camelcase */

// Academic structure: Course/Program -> Subject -> Batch, plus batch teacher
// assignments and per-subject/batch student enrollment.
// See plan/02-domain-model.md and plan/11-syllabus-tracking-feature.md
// (show_progress_to_students lives on batches).

exports.up = (pgm) => {
  pgm.createTable('courses', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    // Free-form program type label (e.g. "school", "professional"); optional.
    type: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('courses', 'tenant_id');

  pgm.createTable('subjects', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    course_id: { type: 'integer', notNull: true, references: 'courses', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('subjects', 'course_id');
  pgm.createIndex('subjects', 'tenant_id');

  pgm.createTable('batches', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    subject_id: { type: 'integer', notNull: true, references: 'subjects', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    // Human-readable schedule blurb (e.g. "Mon/Wed/Fri 7am"); the structured
    // recurring sessions live in timetable_sessions (Phase 6).
    schedule_info: { type: 'text' },
    // Teacher-controlled per-batch toggle for syllabus visibility to students.
    show_progress_to_students: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('batches', 'subject_id');
  pgm.createIndex('batches', 'tenant_id');

  pgm.createTable('batch_teachers', {
    batch_id: { type: 'integer', notNull: true, references: 'batches', onDelete: 'CASCADE' },
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('batch_teachers', 'batch_teachers_pkey', {
    primaryKey: ['batch_id', 'user_id'],
  });
  pgm.createIndex('batch_teachers', 'user_id');

  pgm.createTable('enrollments', {
    batch_id: { type: 'integer', notNull: true, references: 'batches', onDelete: 'CASCADE' },
    student_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('enrollments', 'enrollments_pkey', {
    primaryKey: ['batch_id', 'student_id'],
  });
  pgm.createIndex('enrollments', 'student_id');
};

exports.down = (pgm) => {
  pgm.dropTable('enrollments');
  pgm.dropTable('batch_teachers');
  pgm.dropTable('batches');
  pgm.dropTable('subjects');
  pgm.dropTable('courses');
};
