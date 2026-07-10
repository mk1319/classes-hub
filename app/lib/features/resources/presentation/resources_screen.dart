import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/providers.dart';
import '../data/resources_repository.dart';

class ResourcesScreen extends ConsumerWidget {
  const ResourcesScreen({super.key});

  IconData _icon(String type) => switch (type) {
        'pdf' => Icons.picture_as_pdf_outlined,
        'video' => Icons.play_circle_outline,
        'image' => Icons.image_outlined,
        _ => Icons.description_outlined,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resources = ref.watch(resourcesProvider);
    final api = ref.watch(apiClientProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Resources')),
      body: resources.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load resources.\n$e', textAlign: TextAlign.center)),
        data: (list) => list.isEmpty
            ? const Center(child: Text('No study materials yet.'))
            : ListView.separated(
                itemCount: list.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final r = list[i];
                  return ListTile(
                    leading: Icon(_icon(r.type)),
                    title: Text(r.title),
                    subtitle: Text(r.isLink ? 'External link' : 'Uploaded file'),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () {
                      final url = r.isLink ? r.linkUrl : uploadUrl(api, r.id);
                      if (url != null) launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                    },
                  );
                },
              ),
      ),
    );
  }
}
