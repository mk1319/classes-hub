/* eslint-disable camelcase */

// Per-batch timetable sessions with optional weekly recurrence.
// See plan/02-domain-model.md (timetable_sessions) and plan/05-backend-api.md §timetable.
// Recurring sessions are expanded into individual rows at creation time and share
// a `series_id` so the whole series can be listed/deleted together.

exports.up = (pgm) => {
  pgm.createTable('timetable_sessions', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    batch_id: { type: 'integer', notNull: true, references: 'batches', onDelete: 'CASCADE' },
    title: { type: 'text' },
    session_date: { type: 'date', notNull: true },
    start_time: { type: 'time', notNull: true },
    end_time: { type: 'time', notNull: true },
    // 'none' for a one-off; 'weekly' rows are generated up to a chosen end date.
    recurrence: { type: 'text', notNull: true, default: 'none' },
    series_id: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('timetable_sessions', 'batch_id');
  pgm.createIndex('timetable_sessions', 'tenant_id');
  pgm.createIndex('timetable_sessions', 'session_date');
};

exports.down = (pgm) => {
  pgm.dropTable('timetable_sessions');
};
