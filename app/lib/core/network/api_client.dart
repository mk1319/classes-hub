import 'package:dio/dio.dart';
import '../../flavors/flavor.dart';
import '../auth/token_store.dart';

/// Thin Dio wrapper. Attaches the JWT and, on a 401 (e.g. the session was
/// deactivated by a login elsewhere — plan/15), clears the token and notifies
/// [onUnauthorized] so the router can bounce to login. Feature repositories use
/// this; screens never touch it directly (see features/CLAUDE.md).
class ApiClient {
  ApiClient(this._tokenStore, {this.onUnauthorized}) {
    _dio = Dio(BaseOptions(
      baseUrl: appFlavor.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _tokenStore.read();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (e, handler) async {
        if (e.response?.statusCode == 401) {
          await _tokenStore.clear();
          onUnauthorized?.call();
        }
        handler.next(e);
      },
    ));
  }

  final TokenStore _tokenStore;
  final void Function()? onUnauthorized;
  late final Dio _dio;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      (await _dio.get(path, queryParameters: query)).data;

  Future<dynamic> post(String path, {Object? body}) async =>
      (await _dio.post(path, data: body)).data;

  Future<dynamic> patch(String path, {Object? body}) async =>
      (await _dio.patch(path, data: body)).data;

  /// Absolute URL for a resource file stream (opened externally / by image widget).
  String fileUrl(String path) => '${appFlavor.apiBaseUrl}$path';
}
