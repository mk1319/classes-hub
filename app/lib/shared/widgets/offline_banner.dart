import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';

/// Persistent banner shown while offline so the student always knows whether
/// what they see is live or cached (plan/14-flutter-offline-performance.md).
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(onlineProvider).valueOrNull ?? true;
    if (online) return const SizedBox.shrink();
    return Material(
      color: AppColors.warning.withOpacity(0.15),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 16, color: AppColors.warning),
            const SizedBox(width: 8),
            Text(
              'Showing saved data — will update when back online',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
