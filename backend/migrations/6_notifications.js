/* eslint-disable camelcase */

// Announcements + the FCM device tokens push is dispatched to.
// See plan/02-domain-model.md (announcements) and plan/05-backend-api.md §notifications.
//   scope: 'tenant' (everyone in the tenant), 'course' (scope_id = course_id),
//          'batch' (scope_id = batch_id). scope_id is null for tenant-wide.

exports.up = (pgm) => {
  pgm.createTable('announcements', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    scope: { type: 'text', notNull: true },
    scope_id: { type: 'integer' },
    title: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    created_by: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
    sent_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('announcements', 'tenant_id');

  // FCM registration tokens per device, used to fan out push on announcement.
  pgm.createTable('device_tokens', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    token: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('device_tokens', 'device_tokens_token_unique', { unique: ['token'] });
  pgm.createIndex('device_tokens', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('device_tokens');
  pgm.dropTable('announcements');
};
