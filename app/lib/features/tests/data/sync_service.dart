import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/cache/local_db.dart';
import '../../../core/providers.dart';
import 'tests_repository.dart';

/// Background flush of queued test answers. When connectivity returns, any
/// attempt with unsynced answers is (re)submitted so a test finished offline
/// lands on the server without the student doing anything (plan/14).
class TestSyncService {
  TestSyncService(this._ref) {
    // Flush whenever we transition to online.
    _ref.listen(onlineProvider, (_, next) {
      if (next.valueOrNull == true) flush();
    });
  }
  final Ref _ref;

  Future<void> flush() async {
    final LocalDb db = _ref.read(localDbProvider);
    final repo = _ref.read(testsRepositoryProvider);
    final pending = await db.unsyncedAnswers();
    final attemptIds = {for (final a in pending) a.attemptId};
    for (final id in attemptIds) {
      try {
        await repo.submitAttempt(id);
      } catch (_) {
        // Still offline or the attempt already submitted — leave queued.
      }
    }
  }
}

/// Alive while the app is running (watched in the home shell) so the reconnect
/// listener stays registered.
final testSyncServiceProvider = Provider((ref) => TestSyncService(ref));
