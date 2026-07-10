/* eslint-disable camelcase */

// Study materials: uploaded blobs (bytea) or external links, attached to exactly
// one of a subject or a batch. See plan/10-resources-feature.md.
//   type        : pdf | document | image | video
//   storage_type: upload (bytes in resource_files) | link (link_url)
//   is_downloadable: meaningful only for uploads (offline caching in the app)

exports.up = (pgm) => {
  pgm.createTable('resources', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    subject_id: { type: 'integer', references: 'subjects', onDelete: 'CASCADE' },
    batch_id: { type: 'integer', references: 'batches', onDelete: 'CASCADE' },
    type: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    storage_type: { type: 'text', notNull: true },
    link_url: { type: 'text' },
    is_downloadable: { type: 'boolean', notNull: true, default: true },
    created_by: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  // Exactly one of subject_id / batch_id must be set.
  pgm.addConstraint('resources', 'resources_one_scope', {
    check: '(subject_id IS NOT NULL)::int + (batch_id IS NOT NULL)::int = 1',
  });
  pgm.createIndex('resources', 'tenant_id');
  pgm.createIndex('resources', 'subject_id');
  pgm.createIndex('resources', 'batch_id');

  // Blob kept in a separate table so listing resources never pulls file bytes.
  pgm.createTable('resource_files', {
    id: 'id',
    resource_id: { type: 'integer', notNull: true, references: 'resources', onDelete: 'CASCADE' },
    filename: { type: 'text', notNull: true },
    mime_type: { type: 'text', notNull: true },
    file_size: { type: 'integer', notNull: true },
    file_data: { type: 'bytea', notNull: true },
  });
  pgm.createIndex('resource_files', 'resource_id');
};

exports.down = (pgm) => {
  pgm.dropTable('resource_files');
  pgm.dropTable('resources');
};
