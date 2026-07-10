import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'local_db.g.dart';

/// Generic cache store: every cache-first read stashes its JSON payload here
/// keyed by e.g. "timetable:batch:5". Serving from here first, then refreshing
/// from the network, is the stale-while-revalidate pattern from plan/14.
class CachedEntities extends Table {
  TextColumn get cacheKey => text()();
  TextColumn get payload => text()(); // JSON
  DateTimeColumn get updatedAt => dateTime()();
  @override
  Set<Column> get primaryKey => {cacheKey};
}

/// Offline write queue — the only real write path in the student app is test
/// answers, saved per-question as the student works so a dropped connection
/// mid-test never loses progress (plan/14). A background worker flushes rows
/// with synced=false when connectivity returns.
class PendingAnswers extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get attemptId => integer()();
  IntColumn get questionId => integer()();
  TextColumn get answerJson => text()();
  DateTimeColumn get createdAt => dateTime()();
  BoolColumn get synced => boolean().withDefault(const Constant(false))();
}

@DriftDatabase(tables: [CachedEntities, PendingAnswers])
class LocalDb extends _$LocalDb {
  LocalDb() : super(_open());

  @override
  int get schemaVersion => 1;

  Future<String?> readCache(String key) async {
    final row = await (select(cachedEntities)..where((t) => t.cacheKey.equals(key)))
        .getSingleOrNull();
    return row?.payload;
  }

  Future<void> writeCache(String key, String payload) => into(cachedEntities).insertOnConflictUpdate(
        CachedEntitiesCompanion.insert(cacheKey: key, payload: payload, updatedAt: DateTime.now()),
      );

  Future<void> queueAnswer(int attemptId, int questionId, String answerJson) =>
      into(pendingAnswers).insert(PendingAnswersCompanion.insert(
        attemptId: attemptId,
        questionId: questionId,
        answerJson: answerJson,
        createdAt: DateTime.now(),
      ));

  Future<List<PendingAnswer>> unsyncedAnswers() =>
      (select(pendingAnswers)..where((t) => t.synced.equals(false))).get();

  Future<void> markSynced(int id) =>
      (update(pendingAnswers)..where((t) => t.id.equals(id))).write(const PendingAnswersCompanion(synced: Value(true)));
}

LazyDatabase _open() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'classes_hub.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}
