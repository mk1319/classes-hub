import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'flavors/flavor.dart';

void main() {
  // Keep startup minimal (plan/14): resolve the flavor, then run. Non-critical
  // service init is deferred to first frame via Riverpod lazy providers.
  WidgetsFlutterBinding.ensureInitialized();
  appFlavor = Flavor.fromEnvironment();
  runApp(const ProviderScope(child: ClassesHubApp()));
}
