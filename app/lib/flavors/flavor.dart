import 'dart:ui';

/// Per-tenant build configuration. Each tutor gets their own app build with
/// their `tenantId`, name, and accent color baked in at build time via
/// `--dart-define` (see app/CLAUDE.md). Neutrals/typography are shared across
/// every tenant; only the accent is per-tenant (plan/13-flutter-design-guidelines.md).
class Flavor {
  const Flavor({
    required this.tenantId,
    required this.appName,
    required this.accentColor,
    required this.apiBaseUrl,
  });

  final int tenantId;
  final String appName;
  final Color accentColor;
  final String apiBaseUrl;

  /// Built from --dart-define values, with a dev-friendly fallback.
  static Flavor fromEnvironment() {
    const tenantId = int.fromEnvironment('TENANT_ID', defaultValue: 0);
    const appName = String.fromEnvironment('APP_NAME', defaultValue: 'Classes Hub');
    const accentHex = String.fromEnvironment('ACCENT_COLOR', defaultValue: 'D97706');
    const apiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3000',
    );
    return Flavor(
      tenantId: tenantId,
      appName: appName,
      accentColor: _hexToColor(accentHex),
      apiBaseUrl: apiBaseUrl,
    );
  }

  static Color _hexToColor(String hex) {
    final cleaned = hex.replaceAll('#', '');
    final value = int.tryParse('FF$cleaned', radix: 16) ?? 0xFFD97706;
    return Color(value);
  }
}

/// Set once at startup (main.dart) before the app reads it.
late Flavor appFlavor;
