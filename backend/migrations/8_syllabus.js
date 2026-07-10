/* eslint-disable camelcase */

// Optional predefined chapter list per subject + per-batch coverage log.
// See plan/11-syllabus-tracking-feature.md. Student visibility is the
// batches.show_progress_to_students flag (added in migration 3), toggled via the
// courses feature — not here.

exports.up = (pgm) => {
  pgm.createTable('chapters', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    subject_id: { type: 'integer', notNull: true, references: 'subjects', onDelete: 'CASCADE' },
    title: { type: 'text', notNull: true },
    position: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('chapters', 'subject_id');
  pgm.createIndex('chapters', 'tenant_id');

  pgm.createTable('chapter_coverage', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    batch_id: { type: 'integer', notNull: true, references: 'batches', onDelete: 'CASCADE' },
    // Null when it's a free-form entry not linked to a predefined chapter.
    chapter_id: { type: 'integer', references: 'chapters', onDelete: 'SET NULL' },
    // Used for free-form entries (or a snapshot of the chapter title).
    title: { type: 'text' },
    covered_date: { type: 'date', notNull: true },
    notes: { type: 'text' },
    created_by: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('chapter_coverage', 'batch_id');
  pgm.createIndex('chapter_coverage', 'tenant_id');
};

exports.down = (pgm) => {
  pgm.dropTable('chapter_coverage');
  pgm.dropTable('chapters');
};
