import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/tests/presentation/attempt_screen.dart';
import '../../features/syllabus/presentation/syllabus_screen.dart';

/// go_router config with an auth redirect. Students land on the tabbed home
/// shell; unauthenticated users are sent to /login. The redirect re-runs when
/// auth state changes (including a forced sign-out on 401).
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthListenable(ref);
  return GoRouter(
    initialLocation: '/timetable',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authControllerProvider).status;
      final loggingIn = state.matchedLocation == '/login';
      if (status == AuthStatus.unknown) return null;
      if (status == AuthStatus.signedOut) return loggingIn ? null : '/login';
      if (loggingIn) return '/timetable';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (_, __, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/timetable', builder: (_, __) => const HomeTab(tab: 0)),
          GoRoute(path: '/tests', builder: (_, __) => const HomeTab(tab: 1)),
          GoRoute(path: '/resources', builder: (_, __) => const HomeTab(tab: 2)),
          GoRoute(path: '/notifications', builder: (_, __) => const HomeTab(tab: 3)),
        ],
      ),
      GoRoute(
        path: '/attempt/:testId',
        builder: (_, s) => AttemptScreen(testId: int.parse(s.pathParameters['testId']!)),
      ),
      GoRoute(
        path: '/syllabus/:batchId',
        builder: (_, s) => SyllabusScreen(batchId: int.parse(s.pathParameters['batchId']!)),
      ),
    ],
  );
});

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }
}
