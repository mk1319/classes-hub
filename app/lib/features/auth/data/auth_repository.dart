import '../../../core/auth/device_info.dart';
import '../../../core/auth/token_store.dart';
import '../../../core/network/api_client.dart';

/// Handles login: collects silent device metadata, posts credentials, and
/// stores the returned JWT. See plan/15 (session/device tracking).
class AuthRepository {
  AuthRepository(this._api, this._tokenStore, this._deviceInfo);

  final ApiClient _api;
  final TokenStore _tokenStore;
  final DeviceInfoService _deviceInfo;

  Future<void> login({required String email, required String password}) async {
    final device = await _deviceInfo.collect();
    final res = await _api.post('/auth/login', body: {
      'email': email,
      'password': password,
      'deviceId': device.deviceId,
      'deviceModel': device.deviceModel,
      'osVersion': device.osVersion,
      'appVersion': device.appVersion,
    });
    await _tokenStore.write(res['token'] as String);
    // Register this device for push after a successful login.
    try {
      // FCM token wiring is app-shell responsibility; endpoint is ready:
      // await _api.post('/announcements/tokens', body: {'token': fcmToken});
    } catch (_) {/* non-fatal */}
  }

  Future<bool> hasSession() async => (await _tokenStore.read()) != null;

  Future<void> logout() => _tokenStore.clear();

  Map<String, dynamic>? claims(String token) => TokenStore.decode(token);
}
