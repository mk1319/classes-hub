import 'package:flutter/material.dart';
import '../../flavors/flavor.dart';

/// Design tokens — same "Slate & Amber" neutrals/semantics as the dashboard
/// (plan/08 + plan/13). Neutrals and semantic colors are FIXED across every
/// tenant; only [accent] comes from the flavor. Screens never hardcode a color —
/// they read from the theme or [AppColors].
class AppColors {
  static const ink = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
  static const bg = Color(0xFFF8FAFC);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFE2E8F0);

  // Fixed semantics (meaning-carrying — never re-branded per tenant).
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFCA8A04);
  static const destructive = Color(0xFFDC2626);

  // Dark-mode neutrals.
  static const inkDark = Color(0xFFF1F5F9);
  static const mutedDark = Color(0xFF94A3B8);
  static const bgDark = Color(0xFF0B1120);
  static const surfaceDark = Color(0xFF111827);
  static const borderDark = Color(0xFF1F2937);
}

class AppTheme {
  static ThemeData light() => _base(Brightness.light);
  static ThemeData dark() => _base(Brightness.dark);

  static ThemeData _base(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final accent = appFlavor.accentColor;
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: brightness,
    ).copyWith(
      primary: accent,
      surface: isDark ? AppColors.surfaceDark : AppColors.surface,
      error: AppColors.destructive,
    );

    final onBg = isDark ? AppColors.inkDark : AppColors.ink;
    final muted = isDark ? AppColors.mutedDark : AppColors.muted;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: isDark ? AppColors.bgDark : AppColors.bg,
      fontFamily: 'Inter',
      textTheme: _textTheme(onBg, muted),
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        foregroundColor: onBg,
        elevation: 0,
        centerTitle: false,
      ),
      dividerColor: isDark ? AppColors.borderDark : AppColors.border,
      cardTheme: CardTheme(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          minimumSize: const Size.fromHeight(48), // comfortable tap target
        ),
      ),
    );
  }

  static TextTheme _textTheme(Color ink, Color muted) => TextTheme(
        headlineSmall: TextStyle(fontWeight: FontWeight.w600, color: ink),
        titleMedium: TextStyle(fontWeight: FontWeight.w600, color: ink),
        titleSmall: TextStyle(fontWeight: FontWeight.w500, color: ink),
        bodyMedium: TextStyle(fontWeight: FontWeight.w400, color: ink),
        bodySmall: TextStyle(fontWeight: FontWeight.w400, color: muted),
        labelLarge: TextStyle(fontWeight: FontWeight.w500, color: ink),
      );
}
