import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'auth/device_info.dart';
import 'auth/token_store.dart';
import 'cache/local_db.dart';
import 'network/api_client.dart';
import 'network/connectivity_service.dart';

/// Cross-cutting singletons wired through Riverpod so features depend on
/// interfaces, not globals. Only `core/` builds these.

final secureStorageProvider = Provider((_) => const FlutterSecureStorage());

final tokenStoreProvider = Provider((ref) => TokenStore(ref.watch(secureStorageProvider)));

final deviceInfoProvider = Provider((ref) => DeviceInfoService(ref.watch(secureStorageProvider)));

final localDbProvider = Provider<LocalDb>((ref) {
  final db = LocalDb();
  ref.onDispose(db.close);
  return db;
});

final connectivityProvider = Provider((_) => ConnectivityService());

/// Emits `true` when online. Drives the offline banner.
final onlineProvider = StreamProvider<bool>((ref) async* {
  final svc = ref.watch(connectivityProvider);
  yield await svc.isOnline();
  yield* svc.onlineChanges;
});

/// Signalled when the API client sees a 401 so the router can redirect to login.
final unauthorizedProvider = StateProvider<int>((_) => 0);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    ref.watch(tokenStoreProvider),
    onUnauthorized: () {
      ref.read(unauthorizedProvider.notifier).state++;
      if (kDebugMode) debugPrint('Session ended elsewhere — signed out.');
    },
  );
});
