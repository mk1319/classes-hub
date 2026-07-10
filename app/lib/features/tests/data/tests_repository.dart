import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/cache/cache_first.dart';
import '../../../core/cache/local_db.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../domain/models.dart';

class TestsRepository {
  TestsRepository(this._api, this._db);
  final ApiClient _api;
  final LocalDb _db;

  Stream<List<TestSummary>> listTests() => cacheFirst<List<TestSummary>>(
        db: _db,
        cacheKey: 'tests',
        fetch: () => _api.get('/tests'),
        decode: (j) => (j as List).map((e) => TestSummary.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<TestDetail> getTest(int id) async =>
      TestDetail.fromJson(await _api.get('/tests/$id') as Map<String, dynamic>);

  Future<int> startAttempt(int testId) async {
    final res = await _api.post('/tests/$testId/attempts') as Map<String, dynamic>;
    return res['id'] as int;
  }

  /// Persist a single answer locally the moment the student picks it, so a
  /// dropped connection or crash mid-test never loses progress (plan/14).
  Future<void> saveAnswerLocally(int attemptId, int questionId, Object? answer) =>
      _db.queueAnswer(attemptId, questionId, jsonEncode(answer));

  /// Submit all of an attempt's locally-saved answers. On success the queued
  /// rows are marked synced; on failure they remain for the sync worker to retry.
  Future<Map<String, dynamic>> submitAttempt(int attemptId) async {
    final pending = (await _db.unsyncedAnswers()).where((a) => a.attemptId == attemptId).toList();
    final answers = [
      for (final a in pending) {'questionId': a.questionId, 'answer': jsonDecode(a.answerJson)},
    ];
    final res = await _api.patch('/attempts/$attemptId', body: {'answers': answers}) as Map<String, dynamic>;
    for (final a in pending) {
      await _db.markSynced(a.id);
    }
    return res;
  }

  Future<Map<String, dynamic>> getResult(int attemptId) async =>
      await _api.get('/attempts/$attemptId/result') as Map<String, dynamic>;
}

final testsRepositoryProvider = Provider(
  (ref) => TestsRepository(ref.watch(apiClientProvider), ref.watch(localDbProvider)),
);

final testsListProvider = StreamProvider<List<TestSummary>>(
  (ref) => ref.watch(testsRepositoryProvider).listTests(),
);
