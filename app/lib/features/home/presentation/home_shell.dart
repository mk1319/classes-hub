import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../tests/data/sync_service.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../resources/presentation/resources_screen.dart';
import '../../tests/presentation/tests_screen.dart';
import '../../timetable/presentation/timetable_screen.dart';

/// Persistent bottom navigation for the four primary sections
/// (plan/13-flutter-design-guidelines.md — bottom nav, not a drawer).
class HomeShell extends ConsumerWidget {
  const HomeShell({required this.child, super.key});
  final Widget child;

  static const _tabs = ['/timetable', '/tests', '/resources', '/notifications'];

  int _indexFor(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final i = _tabs.indexWhere((t) => loc.startsWith(t));
    return i < 0 ? 0 : i;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Keep the reconnect sync worker alive while signed in.
    ref.watch(testSyncServiceProvider);
    final index = _indexFor(context);
    return Scaffold(
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_tabs[i]),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today), label: 'Timetable'),
          NavigationDestination(icon: Icon(Icons.quiz_outlined), selectedIcon: Icon(Icons.quiz), label: 'Tests'),
          NavigationDestination(icon: Icon(Icons.folder_outlined), selectedIcon: Icon(Icons.folder), label: 'Resources'),
          NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Updates'),
        ],
      ),
    );
  }
}

/// Renders the feature screen for a tab index (kept in one place so ShellRoute
/// route bodies stay one-liners).
class HomeTab extends ConsumerWidget {
  const HomeTab({required this.tab, super.key});
  final int tab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    switch (tab) {
      case 1:
        return const TestsScreen();
      case 2:
        return const ResourcesScreen();
      case 3:
        return const NotificationsScreen();
      case 0:
      default:
        return const TimetableScreen();
    }
  }
}
