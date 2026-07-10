import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/cache/cache_first.dart';
import '../../../core/providers.dart';

class CoverageEntry {
  CoverageEntry({required this.title, required this.date, required this.notes});
  final String title;
  final String date;
  final String? notes;

  factory CoverageEntry.fromJson(Map<String, dynamic> j) => CoverageEntry(
        title: j['title'] as String? ?? 'Covered',
        date: j['covered_date'] as String,
        notes: j['notes'] as String?,
      );
}

/// Read-only coverage log for a batch. The backend returns 403 when the teacher
/// hasn't enabled student progress visibility (plan/11) — surfaced as a friendly
/// message rather than an error.
final coverageProvider = StreamProvider.family<List<CoverageEntry>, int>((ref, batchId) {
  final api = ref.watch(apiClientProvider);
  final db = ref.watch(localDbProvider);
  return cacheFirst<List<CoverageEntry>>(
    db: db,
    cacheKey: 'coverage:$batchId',
    fetch: () => api.get('/batches/$batchId/coverage'),
    decode: (j) => (j as List).map((e) => CoverageEntry.fromJson(e as Map<String, dynamic>)).toList(),
  );
});

class SyllabusScreen extends ConsumerWidget {
  const SyllabusScreen({required this.batchId, super.key});
  final int batchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coverage = ref.watch(coverageProvider(batchId));
    return Scaffold(
      appBar: AppBar(title: const Text('Syllabus progress')),
      body: coverage.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) {
          final hidden = e is DioException && e.response?.statusCode == 403;
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                hidden
                    ? 'Your teacher has not shared progress for this batch.'
                    : 'Could not load progress.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        },
        data: (list) => list.isEmpty
            ? const Center(child: Text('Nothing logged yet.'))
            : ListView.separated(
                itemCount: list.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final c = list[i];
                  return ListTile(
                    leading: const Icon(Icons.check_circle_outline),
                    title: Text(c.title),
                    subtitle: c.notes != null ? Text(c.notes!) : null,
                    trailing: Text(c.date, style: Theme.of(context).textTheme.bodySmall),
                  );
                },
              ),
      ),
    );
  }
}
