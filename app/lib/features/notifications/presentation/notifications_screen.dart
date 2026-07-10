import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/cache/cache_first.dart';
import '../../../core/providers.dart';

class Announcement {
  Announcement({required this.title, required this.body, required this.sentAt});
  final String title;
  final String body;
  final String? sentAt;

  factory Announcement.fromJson(Map<String, dynamic> j) => Announcement(
        title: j['title'] as String,
        body: j['body'] as String,
        sentAt: j['sent_at'] as String?,
      );
}

final announcementsProvider = StreamProvider<List<Announcement>>((ref) {
  final api = ref.watch(apiClientProvider);
  final db = ref.watch(localDbProvider);
  return cacheFirst<List<Announcement>>(
    db: db,
    cacheKey: 'announcements',
    fetch: () => api.get('/announcements'),
    decode: (j) => (j as List).map((e) => Announcement.fromJson(e as Map<String, dynamic>)).toList(),
  );
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(announcementsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Updates')),
      body: items.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load updates.\n$e', textAlign: TextAlign.center)),
        data: (list) => list.isEmpty
            ? const Center(child: Text('No announcements yet.'))
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: list.length,
                itemBuilder: (_, i) {
                  final a = list[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(a.title, style: Theme.of(context).textTheme.titleSmall),
                          const SizedBox(height: 4),
                          Text(a.body, style: Theme.of(context).textTheme.bodyMedium),
                          if (a.sentAt != null) ...[
                            const SizedBox(height: 8),
                            Text(a.sentAt!.split('T').first, style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
