exports.up = (pgm) => {
  pgm.createTable('tenants', {
    id: 'id',
    name: { type: 'text', notNull: true },
    branding: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('users', {
    id: 'id',
    tenant_id: { type: 'integer', references: 'tenants', onDelete: 'CASCADE' },
    role: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('users', 'tenant_id');

  pgm.createTable('sessions', {
    id: 'id',
    tenant_id: { type: 'integer', references: 'tenants', onDelete: 'CASCADE' },
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    device_id: { type: 'text', notNull: true },
    device_model: { type: 'text' },
    os_version: { type: 'text' },
    app_version: { type: 'text' },
    ip_address: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('sessions', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('sessions');
  pgm.dropTable('users');
  pgm.dropTable('tenants');
};
