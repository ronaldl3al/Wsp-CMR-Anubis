import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/chat.dart';
import '../models/message.dart';
import '../models/connection_state.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';

class ChatProvider extends ChangeNotifier {
  final WebSocketService _ws = WebSocketService();

  List<Chat> _chats = [];
  Chat? _activeChat;
  final Map<String, List<Message>> _messages = {};
  
  String _searchQuery = '';
  String _activeFilter = 'all'; // 'all' | 'unread' | 'groups'
  bool _isLoadingChats = true;
  bool _isLoadingMessages = false;
  AppConnectionStatus _connectionStatus = AppConnectionStatus(status: 'connecting');

  // Getters
  List<Chat> get chats => _chats;
  Chat? get activeChat => _activeChat;
  String get searchQuery => _searchQuery;
  String get activeFilter => _activeFilter;
  bool get isLoadingChats => _isLoadingChats;
  bool get isLoadingMessages => _isLoadingMessages;
  AppConnectionStatus get connectionStatus => _connectionStatus;
  WebSocketService get ws => _ws;

  List<Message> get activeMessages {
    if (_activeChat == null) return [];
    return _messages[_activeChat!.id] ?? [];
  }

  List<Chat> get filteredChats {
    return _chats.where((chat) {
      // Filter by type
      if (_activeFilter == 'unread' && chat.unreadCount == 0) return false;
      if (_activeFilter == 'groups' && !chat.isGroup) return false;

      // Filter by search query
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final nameMatch = chat.name.toLowerCase().contains(q);
        final numMatch = chat.number.toLowerCase().contains(q);
        final msgMatch = chat.lastMessage?.body.toLowerCase().contains(q) ?? false;
        return nameMatch || numMatch || msgMatch;
      }
      return true;
    }).toList();
  }

  void init() {
    _initWebSocket();
    _loadInitialData();
  }

  void _initWebSocket() {
    _ws.onChatsInit = (rawList) {
      _chats = rawList.map((item) => Chat.fromJson(item)).toList();
      _sortChats();
      _isLoadingChats = false;
      notifyListeners();
    };

    _ws.onNewMessage = (data) {
      if (data['message'] != null) {
        final msg = Message.fromJson(data['message']);
        _handleIncomingMessage(msg);
      }
    };

    _ws.onMessageAck = (data) {
      final msgId = data['messageId']?.toString();
      final status = data['status']?.toString();
      if (msgId != null && status != null) {
        _handleMessageAck(msgId, status);
      }
    };

    _ws.onChatUpdated = (data) {
      final updated = Chat.fromJson(data);
      _upsertChatLocally(updated);
      notifyListeners();
    };

    _ws.onConnectionStatus = (data) {
      _connectionStatus = AppConnectionStatus.fromJson(data);
      notifyListeners();
    };

    _ws.connect();
  }

  Future<void> _loadInitialData() async {
    _isLoadingChats = true;
    notifyListeners();

    final status = await ApiService.getStatus();
    _connectionStatus = status;

    final chats = await ApiService.getChats();
    if (chats.isNotEmpty) {
      _chats = chats;
      _sortChats();
    }

    _isLoadingChats = false;
    notifyListeners();
  }

  Future<void> syncChats() async {
    _isLoadingChats = true;
    notifyListeners();

    final synced = await ApiService.syncChats();
    if (synced.isNotEmpty) {
      _chats = synced;
      _sortChats();
    } else {
      final chats = await ApiService.getChats();
      if (chats.isNotEmpty) {
        _chats = chats;
        _sortChats();
      }
    }

    _isLoadingChats = false;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void setActiveFilter(String filter) {
    _activeFilter = filter;
    notifyListeners();
  }

  Future<void> selectChat(Chat chat) async {
    if (_activeChat?.id == chat.id) return;

    _activeChat = chat;
    notifyListeners();

    // Mark as read locally and remotely
    if (chat.unreadCount > 0) {
      final idx = _chats.indexWhere((c) => c.id == chat.id);
      if (idx >= 0) {
        _chats[idx] = _chats[idx].copyWith(unreadCount: 0);
      }
      _activeChat = _activeChat?.copyWith(unreadCount: 0);
      ApiService.markAsRead(chat.id);
    }

    // Load messages if not already loaded
    if (!_messages.containsKey(chat.id)) {
      _isLoadingMessages = true;
      notifyListeners();

      final msgs = await ApiService.getMessages(chat.id);
      _messages[chat.id] = msgs;
      _isLoadingMessages = false;
      notifyListeners();
    }
  }

  // OPTIMISTIC SEND (<10ms)
  Future<void> sendMessage(String text, {String? quotedId}) async {
    if (_activeChat == null || text.trim().isEmpty) return;
    final chatId = _activeChat!.id;
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    // 1. Optimistic Message
    final optimisticMsg = Message(
      id: tempId,
      chatId: chatId,
      body: text.trim(),
      fromMe: true,
      timestamp: nowSeconds,
      type: 'chat',
      status: 'pending',
      quotedMsgId: quotedId,
    );

    // Append to active message list immediately
    if (!_messages.containsKey(chatId)) {
      _messages[chatId] = [];
    }
    _messages[chatId]!.add(optimisticMsg);

    // Update Chat snippet and bump to top
    _updateChatLastMessage(chatId, optimisticMsg);
    notifyListeners();

    // 2. Send to server
    try {
      final realMsg = await ApiService.sendTextMessage(chatId, text.trim(), quotedId: quotedId);
      if (realMsg != null) {
        // Replace provisional temp message with real message
        final chatMsgs = _messages[chatId];
        if (chatMsgs != null) {
          final tempIdx = chatMsgs.indexWhere((m) => m.id == tempId);
          if (tempIdx >= 0) {
            chatMsgs[tempIdx] = realMsg;
          }
        }
        _updateChatLastMessage(chatId, realMsg);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[ChatProvider] Error sending text: $e');
    }
  }

  // OPTIMISTIC MEDIA SEND
  Future<void> sendMedia({
    required String base64Data,
    required String mimetype,
    required String fileName,
    String? caption,
  }) async {
    if (_activeChat == null) return;
    final chatId = _activeChat!.id;
    final tempId = 'temp_media_${DateTime.now().millisecondsSinceEpoch}';
    final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    String mediaType = 'document';
    if (mimetype.startsWith('image/')) mediaType = 'image';
    else if (mimetype.startsWith('video/')) mediaType = 'video';
    else if (mimetype.contains('audio')) mediaType = 'audio';

    final optimisticMsg = Message(
      id: tempId,
      chatId: chatId,
      body: caption ?? (mediaType != 'chat' ? '[$mediaType]' : ''),
      fromMe: true,
      timestamp: nowSeconds,
      type: mediaType,
      mediaUrl: 'data:$mimetype;base64,$base64Data',
      mediaMime: mimetype,
      fileName: fileName,
      status: 'pending',
    );

    if (!_messages.containsKey(chatId)) {
      _messages[chatId] = [];
    }
    _messages[chatId]!.add(optimisticMsg);
    _updateChatLastMessage(chatId, optimisticMsg);
    notifyListeners();

    try {
      final realMsg = await ApiService.sendMediaMessage(
        chatId,
        base64Data,
        mimetype,
        fileName,
        caption: caption,
      );
      if (realMsg != null) {
        final chatMsgs = _messages[chatId];
        if (chatMsgs != null) {
          final tempIdx = chatMsgs.indexWhere((m) => m.id == tempId);
          if (tempIdx >= 0) {
            chatMsgs[tempIdx] = realMsg;
          }
        }
        _updateChatLastMessage(chatId, realMsg);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[ChatProvider] Error sending media: $e');
    }
  }

  void _handleIncomingMessage(Message msg) {
    // Add to message list
    if (!_messages.containsKey(msg.chatId)) {
      _messages[msg.chatId] = [];
    }
    final list = _messages[msg.chatId]!;
    final existingIdx = list.indexWhere((m) => m.id == msg.id);
    if (existingIdx >= 0) {
      list[existingIdx] = msg;
    } else {
      list.add(msg);
    }

    // Auto mark as read if user is looking at this exact chat
    final isActiveChat = _activeChat != null && _activeChat!.id == msg.chatId;
    if (isActiveChat && !msg.fromMe) {
      ApiService.markAsRead(msg.chatId);
    }

    // Update Chat in list
    final existingChatIdx = _chats.indexWhere((c) => c.id == msg.chatId);
    if (existingChatIdx >= 0) {
      final existingChat = _chats[existingChatIdx];
      final unread = (!msg.fromMe && !isActiveChat) ? existingChat.unreadCount + 1 : 0;
      final updated = existingChat.copyWith(
        unreadCount: unread,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
        lastMessage: LastMessageSnippet(
          id: msg.id,
          body: msg.body,
          timestamp: msg.timestamp,
          fromMe: msg.fromMe,
          status: msg.status,
          type: msg.type,
        ),
      );
      _chats[existingChatIdx] = updated;
      if (isActiveChat) {
        _activeChat = updated;
      }
    } else {
      // New chat not yet in list
      final newChat = Chat(
        id: msg.chatId,
        name: msg.senderName ?? msg.chatId.split('@').first,
        number: msg.chatId.split('@').first,
        isGroup: msg.chatId.contains('@g.us'),
        unreadCount: (!msg.fromMe && !isActiveChat) ? 1 : 0,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
        lastMessage: LastMessageSnippet(
          id: msg.id,
          body: msg.body,
          timestamp: msg.timestamp,
          fromMe: msg.fromMe,
          status: msg.status,
          type: msg.type,
        ),
      );
      _chats.insert(0, newChat);
    }

    _sortChats();
    notifyListeners();
  }

  void _handleMessageAck(String messageId, String status) {
    bool updatedAny = false;
    _messages.forEach((chatId, list) {
      final idx = list.indexWhere((m) => m.id == messageId);
      if (idx >= 0) {
        list[idx] = list[idx].copyWith(status: status);
        updatedAny = true;
      }
    });

    for (int i = 0; i < _chats.length; i++) {
      if (_chats[i].lastMessage != null && _chats[i].lastMessage!.id == messageId) {
        final lm = _chats[i].lastMessage!;
        _chats[i] = _chats[i].copyWith(
          lastMessage: LastMessageSnippet(
            id: lm.id,
            body: lm.body,
            timestamp: lm.timestamp,
            fromMe: lm.fromMe,
            status: status,
            type: lm.type,
          ),
        );
        if (_activeChat?.id == _chats[i].id) {
          _activeChat = _chats[i];
        }
        updatedAny = true;
      }
    }

    if (updatedAny) {
      notifyListeners();
    }
  }

  void _updateChatLastMessage(String chatId, Message msg) {
    final idx = _chats.indexWhere((c) => c.id == chatId);
    if (idx >= 0) {
      final chat = _chats[idx];
      _chats[idx] = chat.copyWith(
        updatedAt: DateTime.now().millisecondsSinceEpoch,
        lastMessage: LastMessageSnippet(
          id: msg.id,
          body: msg.body,
          timestamp: msg.timestamp,
          fromMe: msg.fromMe,
          status: msg.status,
          type: msg.type,
        ),
      );
      if (_activeChat?.id == chatId) {
        _activeChat = _chats[idx];
      }
      _sortChats();
    }
  }

  void _upsertChatLocally(Chat chat) {
    final idx = _chats.indexWhere((c) => c.id == chat.id);
    if (idx >= 0) {
      _chats[idx] = chat;
    } else {
      _chats.add(chat);
    }
    if (_activeChat?.id == chat.id) {
      _activeChat = chat;
    }
    _sortChats();
  }

  void _sortChats() {
    _chats.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  @override
  void dispose() {
    _ws.dispose();
    super.dispose();
  }
}
