import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:uuid/uuid.dart';

/// Silent (non-biometric) device metadata collected at login for the anti-fraud
/// session record — plan/15-account-security-anti-fraud.md. The deviceId is a
/// UUID generated once per install and kept in secure storage.
class DeviceMetadata {
  DeviceMetadata({
    required this.deviceId,
    required this.deviceModel,
    required this.osVersion,
    required this.appVersion,
  });

  final String deviceId;
  final String deviceModel;
  final String osVersion;
  final String appVersion;
}

class DeviceInfoService {
  DeviceInfoService(this._storage);
  final FlutterSecureStorage _storage;
  static const _deviceIdKey = 'device_id';

  Future<DeviceMetadata> collect() async {
    final deviceId = await _deviceId();
    final pkg = await PackageInfo.fromPlatform();
    final plugin = DeviceInfoPlugin();

    var model = 'unknown';
    var os = 'unknown';
    if (Platform.isAndroid) {
      final a = await plugin.androidInfo;
      model = '${a.manufacturer} ${a.model}';
      os = 'Android ${a.version.release}';
    } else if (Platform.isIOS) {
      final i = await plugin.iosInfo;
      model = i.utsname.machine;
      os = 'iOS ${i.systemVersion}';
    }

    return DeviceMetadata(
      deviceId: deviceId,
      deviceModel: model,
      osVersion: os,
      appVersion: '${pkg.version}+${pkg.buildNumber}',
    );
  }

  Future<String> _deviceId() async {
    final existing = await _storage.read(key: _deviceIdKey);
    if (existing != null) return existing;
    final id = const Uuid().v4();
    await _storage.write(key: _deviceIdKey, value: id);
    return id;
  }
}
