import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'api_service.dart';

typedef OnNewMessageCallback = void Function(Map<String, dynamic> data);
typedef OnMessageAckCallback = void Function(Map<String, dynamic> data);
typedef OnChatUpdatedCallback = void Function(Map<String, dynamic> data);
typedef OnChatsInitCallback = void Function(List<dynamic> data);
typedef OnConnectionStatusCallback = void Function(Map<String, dynamic> data);

class WebSocketService {
  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  bool _isConnected = false;
  bool _isDisposed = false;

  OnNewMessageCallback? onNewMessage;
  OnMessageAckCallback? onMessageAck;
  OnChatUpdatedCallback? onChatUpdated;
  OnChatsInitCallback? onChatsInit;
  OnConnectionStatusCallback? onConnectionStatus;

  bool get isConnected => _isConnected;

  String get _wsUrl {
    final base = ApiService.baseUrl;
    final wsScheme = base.startsWith('https') ? 'wss' : 'ws';
    final host = base.replaceFirst(RegExp(r'^https?:\/\/'), '');
    return '$wsScheme://$host/ws';
  }

  void connect() {
    if (_isDisposed) return;
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();

    try {
      final uri = Uri.parse(_wsUrl);
      debugPrint('[WS] Connecting to $uri');
      _channel = WebSocketChannel.connect(uri);
      _isConnected = true;

      // Start ping timer every 25 seconds
      _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) {
        if (_isConnected && _channel != null) {
          try {
            _channel!.sink.add(jsonEncode({'action': 'ping'}));
          } catch (_) {}
        }
      });

      _channel!.stream.listen(
        (event) {
          _handleMessage(event);
        },
        onDone: () {
          debugPrint('[WS] Connection closed, will reconnect in 3s');
          _isConnected = false;
          _scheduleReconnect();
        },
        onError: (err) {
          debugPrint('[WS] Error: $err');
          _isConnected = false;
          _scheduleReconnect();
        },
      );
    } catch (e) {
      debugPrint('[WS] Connect error: $e');
      _isConnected = false;
      _scheduleReconnect();
    }
  }

  void _handleMessage(dynamic raw) {
    try {
      final parsed = jsonDecode(raw.toString());
      final event = parsed['event']?.toString();
      final data = parsed['data'];

      switch (event) {
        case 'chats_init':
          if (data is List && onChatsInit != null) {
            onChatsInit!(data);
          }
          break;
        case 'new_message':
          if (data is Map<String, dynamic> && onNewMessage != null) {
            onNewMessage!(data);
          }
          break;
        case 'message_ack':
          if (data is Map<String, dynamic> && onMessageAck != null) {
            onMessageAck!(data);
          }
          break;
        case 'chat_updated':
          if (data is Map<String, dynamic> && onChatUpdated != null) {
            onChatUpdated!(data);
          }
          break;
        case 'connection_status':
          if (data is Map<String, dynamic> && onConnectionStatus != null) {
            onConnectionStatus!(data);
          }
          break;
      }
    } catch (e) {
      debugPrint('[WS] Handle message error: $e');
    }
  }

  void _scheduleReconnect() {
    if (_isDisposed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (!_isConnected && !_isDisposed) {
        connect();
      }
    });
  }

  void dispose() {
    _isDisposed = true;
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();
    _channel?.sink.close();
  }
}
