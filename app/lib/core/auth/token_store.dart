import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT in platform secure storage. The token carries the session
/// claims; the backend re-verifies every call and returns 401 the moment the
/// session is deactivated (single-active-session — plan/15), which the app
/// client turns into a forced logout.
class TokenStore {
  TokenStore(this._storage);
  final FlutterSecureStorage _storage;

  static const _tokenKey = 'jwt';

  Future<String?> read() => _storage.read(key: _tokenKey);
  Future<void> write(String token) => _storage.write(key: _tokenKey, value: token);
  Future<void> clear() => _storage.delete(key: _tokenKey);

  /// Decode the payload for UI purposes only (role/tenant); not trusted for authz.
  static Map<String, dynamic>? decode(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = parts[1];
      final normalized = base64Url.normalize(payload);
      return jsonDecode(utf8.decode(base64Url.decode(normalized))) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }
}
