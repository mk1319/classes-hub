import 'package:connectivity_plus/connectivity_plus.dart';

/// Thin wrapper over connectivity_plus. Drives the offline banner and lets the
/// sync worker flush the write queue when connectivity returns
/// (plan/14-flutter-offline-performance.md).
class ConnectivityService {
  ConnectivityService([Connectivity? c]) : _connectivity = c ?? Connectivity();
  final Connectivity _connectivity;

  Stream<bool> get onlineChanges =>
      _connectivity.onConnectivityChanged.map(_isOnline);

  Future<bool> isOnline() async => _isOnline(await _connectivity.checkConnectivity());

  bool _isOnline(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);
}
