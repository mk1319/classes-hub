exports.up = (pgm) => {
  pgm.createIndex('sessions', 'user_id', {
    name: 'sessions_one_active_per_user',
    unique: true,
    where: 'is_active',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('sessions', 'user_id', { name: 'sessions_one_active_per_user' });
};
