import 'dart:convert';
import 'local_db.dart';

/// Cache-first read helper (stale-while-revalidate — plan/14). Emits the cached
/// value immediately if present, then fetches from the network, writes it back
/// to the cache, and emits the fresh value. A network failure after a cache hit
/// is swallowed (the student keeps the last-known state); a failure with no
/// cache rethrows so the UI can show an error.
Stream<T> cacheFirst<T>({
  required LocalDb db,
  required String cacheKey,
  required Future<dynamic> Function() fetch,
  required T Function(dynamic json) decode,
}) async* {
  final cached = await db.readCache(cacheKey);
  var served = false;
  if (cached != null) {
    yield decode(jsonDecode(cached));
    served = true;
  }
  try {
    final fresh = await fetch();
    await db.writeCache(cacheKey, jsonEncode(fresh));
    yield decode(fresh);
  } catch (e) {
    if (!served) rethrow;
    // else: keep serving the cached value we already emitted.
  }
}
