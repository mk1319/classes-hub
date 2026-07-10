import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../data/tests_repository.dart';

class TestsScreen extends ConsumerWidget {
  const TestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tests = ref.watch(testsListProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Tests')),
      body: tests.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load tests.\n$e', textAlign: TextAlign.center)),
        data: (list) => list.isEmpty
            ? const Center(child: Text('No tests assigned yet.'))
            : ListView.separated(
                itemCount: list.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final t = list[i];
                  return ListTile(
                    title: Text(t.title),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/attempt/${t.id}'),
                  );
                },
              ),
      ),
    );
  }
}
