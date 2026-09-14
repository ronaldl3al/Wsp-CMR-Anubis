import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/chat.dart';
import '../models/message.dart';
import '../models/quick_note.dart';
import '../models/connection_state.dart';

class ApiService {
  static String get baseUrl {
    // In Flutter Web, Uri.base is the origin (e.g. https://wsp-cmr-anubis-production.up.railway.app)
    final origin = Uri.base.origin;
    if (origin.isNotEmpty && !origin.contains('null')) {
      return origin;
    }
    return 'http://localhost:8080';
  }

  static Future<List<Chat>> getChats() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/api/chats'));
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        return list.map((item) => Chat.fromJson(item)).toList();
      }
    } catch (e) {
      // ignore or log
    }
    return [];
  }

  static Future<List<Chat>> syncChats() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/api/sync'));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['chats'] is List) {
          final List list = data['chats'];
          return list.map((item) => Chat.fromJson(item)).toList();
        }
      }
    } catch (_) {}
    return [];
  }

  static Future<List<Message>> getMessages(String chatId) async {
    try {
      final encoded = Uri.encodeComponent(chatId);
      final res = await http.get(Uri.parse('$baseUrl/api/chats/$encoded/messages'));
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        return list.map((item) => Message.fromJson(item)).toList();
      }
    } catch (e) {
      // ignore
    }
    return [];
  }

  static Future<Message?> sendTextMessage(String chatId, String text, {String? quotedId}) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/api/messages/send'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'chatId': chatId,
          'text': text,
          'quotedMsgId': quotedId,
        }),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['message'] != null) {
          return Message.fromJson(data['message']);
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  static Future<Message?> sendMediaMessage(
    String chatId,
    String mediaBase64,
    String mimetype,
    String fileName, {
    String? caption,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/api/messages/send-media'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'chatId': chatId,
          'mediaBase64': mediaBase64,
          'mimetype': mimetype,
          'fileName': fileName,
          'caption': caption,
        }),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['message'] != null) {
          return Message.fromJson(data['message']);
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  static Future<void> markAsRead(String chatId) async {
    try {
      final encoded = Uri.encodeComponent(chatId);
      await http.post(Uri.parse('$baseUrl/api/chats/$encoded/read'));
    } catch (_) {}
  }

  static Future<AppConnectionStatus> getStatus() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/api/status'));
      if (res.statusCode == 200) {
        return AppConnectionStatus.fromJson(jsonDecode(res.body));
      }
    } catch (_) {}
    return AppConnectionStatus(status: 'connecting');
  }

  static Future<List<QuickNote>> getNotes() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/api/notes'));
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        return list.map((item) => QuickNote.fromJson(item)).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<QuickNote?> createNote(String title, String content, String category) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/api/notes'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'title': title,
          'content': content,
          'category': category,
        }),
      );
      if (res.statusCode == 200) {
        return QuickNote.fromJson(jsonDecode(res.body));
      }
    } catch (_) {}
    return null;
  }

  static Future<bool> deleteNote(String id) async {
    try {
      final res = await http.delete(Uri.parse('$baseUrl/api/notes/$id'));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return data['success'] == true;
      }
    } catch (_) {}
    return false;
  }
}
