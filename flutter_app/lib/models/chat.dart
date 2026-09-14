class LastMessageSnippet {
  final String id;
  final String body;
  final int timestamp;
  final bool fromMe;
  final String status;
  final String type;

  LastMessageSnippet({
    required this.id,
    required this.body,
    required this.timestamp,
    required this.fromMe,
    required this.status,
    this.type = 'chat',
  });

  factory LastMessageSnippet.fromJson(Map<String, dynamic> json) {
    return LastMessageSnippet(
      id: json['id']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      timestamp: (json['timestamp'] is num) ? (json['timestamp'] as num).toInt() : (DateTime.now().millisecondsSinceEpoch ~/ 1000),
      fromMe: json['fromMe'] == true,
      status: json['status']?.toString() ?? 'sent',
      type: json['type']?.toString() ?? 'chat',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'body': body,
      'timestamp': timestamp,
      'fromMe': fromMe,
      'status': status,
      'type': type,
    };
  }
}

class Chat {
  final String id;
  final String name;
  final String number;
  final bool isGroup;
  final String? profilePicUrl;
  final LastMessageSnippet? lastMessage;
  final int unreadCount;
  final int updatedAt;

  Chat({
    required this.id,
    required this.name,
    required this.number,
    this.isGroup = false,
    this.profilePicUrl,
    this.lastMessage,
    this.unreadCount = 0,
    required this.updatedAt,
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    return Chat(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? json['number']?.toString() ?? json['id']?.toString().split('@').first ?? 'Desconocido',
      number: json['number']?.toString() ?? json['id']?.toString().split('@').first ?? '',
      isGroup: json['isGroup'] == true || (json['id']?.toString().contains('@g.us') ?? false),
      profilePicUrl: json['profilePicUrl']?.toString(),
      lastMessage: json['lastMessage'] != null ? LastMessageSnippet.fromJson(json['lastMessage']) : null,
      unreadCount: (json['unreadCount'] is num) ? (json['unreadCount'] as num).toInt() : 0,
      updatedAt: (json['updatedAt'] is num) ? (json['updatedAt'] as num).toInt() : DateTime.now().millisecondsSinceEpoch,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'number': number,
      'isGroup': isGroup,
      'profilePicUrl': profilePicUrl,
      'lastMessage': lastMessage?.toJson(),
      'unreadCount': unreadCount,
      'updatedAt': updatedAt,
    };
  }

  Chat copyWith({
    String? id,
    String? name,
    String? number,
    bool? isGroup,
    String? profilePicUrl,
    LastMessageSnippet? lastMessage,
    int? unreadCount,
    int? updatedAt,
  }) {
    return Chat(
      id: id ?? this.id,
      name: name ?? this.name,
      number: number ?? this.number,
      isGroup: isGroup ?? this.isGroup,
      profilePicUrl: profilePicUrl ?? this.profilePicUrl,
      lastMessage: lastMessage ?? this.lastMessage,
      unreadCount: unreadCount ?? this.unreadCount,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
