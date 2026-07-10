import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/cache/cache_first.dart';
import '../../../core/cache/local_db.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../domain/models.dart';

/// Cache-first reads for the student's batches and their sessions.
///
/// The backend has no single "my batches" endpoint, so we derive the student's
/// batch ids from their visible tests (each carries batch_id) and hydrate names
/// via GET /batches/:id. (A dedicated /me/batches endpoint would be cleaner —
/// noted in app/NOTES.md.)
class TimetableRepository {
  TimetableRepository(this._api, this._db);
  final ApiClient _api;
  final LocalDb _db;

  Stream<List<Batch>> myBatches() => cacheFirst<List<Batch>>(
        db: _db,
        cacheKey: 'my-batches',
        fetch: () async {
          final tests = await _api.get('/tests') as List<dynamic>;
          final ids = {for (final t in tests) (t as Map)['batch_id'] as int};
          final batches = <Map<String, dynamic>>[];
          for (final id in ids) {
            batches.add(await _api.get('/batches/$id') as Map<String, dynamic>);
          }
          return batches;
        },
        decode: (json) => (json as List).map((e) => Batch.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Stream<List<Session>> sessions(int batchId) => cacheFirst<List<Session>>(
        db: _db,
        cacheKey: 'timetable:$batchId',
        fetch: () => _api.get('/batches/$batchId/sessions'),
        decode: (json) => (json as List).map((e) => Session.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

final timetableRepositoryProvider = Provider(
  (ref) => TimetableRepository(ref.watch(apiClientProvider), ref.watch(localDbProvider)),
);

final myBatchesProvider = StreamProvider<List<Batch>>(
  (ref) => ref.watch(timetableRepositoryProvider).myBatches(),
);

final sessionsProvider = StreamProvider.family<List<Session>, int>(
  (ref, batchId) => ref.watch(timetableRepositoryProvider).sessions(batchId),
);
