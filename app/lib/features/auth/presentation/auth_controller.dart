import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../data/auth_repository.dart';

final authRepositoryProvider = Provider(
  (ref) => AuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(tokenStoreProvider),
    ref.watch(deviceInfoProvider),
  ),
);

enum AuthStatus { unknown, signedOut, signedIn }

class AuthState {
  const AuthState({this.status = AuthStatus.unknown, this.error, this.loading = false});
  final AuthStatus status;
  final String? error;
  final bool loading;

  AuthState copyWith({AuthStatus? status, String? error, bool? loading}) =>
      AuthState(status: status ?? this.status, error: error, loading: loading ?? this.loading);
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repo, this._ref) : super(const AuthState()) {
    _bootstrap();
    // A 401 anywhere signs the user out (single-active-session enforcement).
    _ref.listen(unauthorizedProvider, (_, __) => forceSignOut());
  }

  final AuthRepository _repo;
  final Ref _ref;

  Future<void> _bootstrap() async {
    final has = await _repo.hasSession();
    state = state.copyWith(status: has ? AuthStatus.signedIn : AuthStatus.signedOut);
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(loading: true, error: null);
    try {
      await _repo.login(email: email, password: password);
      state = state.copyWith(status: AuthStatus.signedIn, loading: false);
    } catch (e) {
      state = state.copyWith(loading: false, error: 'Invalid email or password');
    }
  }

  Future<void> signOut() async {
    await _repo.logout();
    state = state.copyWith(status: AuthStatus.signedOut);
  }

  void forceSignOut() {
    state = state.copyWith(status: AuthStatus.signedOut);
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref.watch(authRepositoryProvider), ref),
);
