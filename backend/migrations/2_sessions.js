/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('sessions', {
    id: 'id',
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
  pgm.createIndex('sessions', 'user_id', {
    name: 'sessions_one_active_per_user',
    unique: true,
    where: 'is_active',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('sessions', 'user_id', { name: 'sessions_one_active_per_user' });
  pgm.dropTable('sessions');
};
