import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/timetable_repository.dart';

/// Lists the student's batches; each expands to its schedule and links to the
/// batch's syllabus progress. Cache-first: shows saved data instantly, refreshes
/// in the background.
class TimetableScreen extends ConsumerWidget {
  const TimetableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final batches = ref.watch(myBatchesProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Timetable'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
          ),
        ],
      ),
      body: batches.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load your batches.\n$e', textAlign: TextAlign.center)),
        data: (list) => list.isEmpty
            ? const Center(child: Text('You are not enrolled in any batches yet.'))
            : ListView.builder(
                itemCount: list.length,
                itemBuilder: (_, i) => _BatchTile(batchId: list[i].id, name: list[i].name),
              ),
      ),
    );
  }
}

class _BatchTile extends ConsumerWidget {
  const _BatchTile({required this.batchId, required this.name});
  final int batchId;
  final String name;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(sessionsProvider(batchId));
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: ExpansionTile(
        title: Text(name, style: Theme.of(context).textTheme.titleSmall),
        childrenPadding: const EdgeInsets.only(bottom: 8),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: TextButton.icon(
                icon: const Icon(Icons.timeline, size: 18),
                label: const Text('Syllabus progress'),
                onPressed: () => context.push('/syllabus/$batchId'),
              ),
            ),
          ),
          sessions.when(
            loading: () => const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator()),
            error: (e, _) => const Padding(padding: EdgeInsets.all(12), child: Text('Could not load sessions.')),
            data: (list) => list.isEmpty
                ? const Padding(padding: EdgeInsets.all(12), child: Text('No sessions scheduled.'))
                : Column(
                    children: [
                      for (final s in list)
                        ListTile(
                          dense: true,
                          leading: const Icon(Icons.event, size: 20),
                          title: Text(s.title ?? 'Class'),
                          subtitle: Text('${s.date} · ${s.start}–${s.end}'),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
