import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/cache/cache_first.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';

class ResourceItem {
  ResourceItem({
    required this.id,
    required this.title,
    required this.type,
    required this.storageType,
    required this.linkUrl,
    required this.isDownloadable,
  });
  final int id;
  final String title;
  final String type;
  final String storageType; // upload | link
  final String? linkUrl;
  final bool isDownloadable;

  bool get isLink => storageType == 'link';

  factory ResourceItem.fromJson(Map<String, dynamic> j) => ResourceItem(
        id: j['id'] as int,
        title: j['title'] as String,
        type: j['type'] as String,
        storageType: j['storage_type'] as String,
        linkUrl: j['link_url'] as String?,
        isDownloadable: j['is_downloadable'] as bool? ?? false,
      );
}

final resourcesProvider = StreamProvider<List<ResourceItem>>((ref) {
  final api = ref.watch(apiClientProvider);
  final db = ref.watch(localDbProvider);
  return cacheFirst<List<ResourceItem>>(
    db: db,
    cacheKey: 'resources',
    fetch: () => api.get('/resources'),
    decode: (j) => (j as List).map((e) => ResourceItem.fromJson(e as Map<String, dynamic>)).toList(),
  );
});

/// Absolute URL to open/stream an uploaded resource's bytes.
String uploadUrl(ApiClient api, int id) => api.fileUrl('/resources/$id/file');
