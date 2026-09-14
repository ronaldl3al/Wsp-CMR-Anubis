class Message {
  final String id;
  final String chatId;
  final String body;
  final bool fromMe;
  final int timestamp;
  final String type;
  final String? mediaUrl;
  final String? mediaMime;
  final String? fileName;
  final String status; // 'pending' | 'sent' | 'delivered' | 'read'
  final String? quotedMsgId;
  final String? senderName;

  Message({
    required this.id,
    required this.chatId,
    required this.body,
    required this.fromMe,
    required this.timestamp,
    this.type = 'chat',
    this.mediaUrl,
    this.mediaMime,
    this.fileName,
    this.status = 'pending',
    this.quotedMsgId,
    this.senderName,
  });

  factory Message.fromJson(dynamic rawJson) {
    if (rawJson is! Map) {
      return Message(
        id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
        chatId: '',
        body: '',
        fromMe: false,
        timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      );
    }
    final json = Map<String, dynamic>.from(rawJson);
    return Message(
      id: json['id']?.toString() ?? 'msg_${DateTime.now().millisecondsSinceEpoch}',
      chatId: json['chatId']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      fromMe: json['fromMe'] == true,
      timestamp: (json['timestamp'] is num) ? (json['timestamp'] as num).toInt() : (DateTime.now().millisecondsSinceEpoch ~/ 1000),
      type: json['type']?.toString() ?? 'chat',
      mediaUrl: json['mediaUrl']?.toString(),
      mediaMime: json['mediaMime']?.toString(),
      fileName: json['fileName']?.toString(),
      status: json['status']?.toString() ?? (json['fromMe'] == true ? 'sent' : 'delivered'),
      quotedMsgId: json['quotedMsgId']?.toString(),
      senderName: json['senderName']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'chatId': chatId,
      'body': body,
      'fromMe': fromMe,
      'timestamp': timestamp,
      'type': type,
      'mediaUrl': mediaUrl,
      'mediaMime': mediaMime,
      'fileName': fileName,
      'status': status,
      'quotedMsgId': quotedMsgId,
      'senderName': senderName,
    };
  }

  Message copyWith({
    String? id,
    String? chatId,
    String? body,
    bool? fromMe,
    int? timestamp,
    String? type,
    String? mediaUrl,
    String? mediaMime,
    String? fileName,
    String? status,
    String? quotedMsgId,
    String? senderName,
  }) {
    return Message(
      id: id ?? this.id,
      chatId: chatId ?? this.chatId,
      body: body ?? this.body,
      fromMe: fromMe ?? this.fromMe,
      timestamp: timestamp ?? this.timestamp,
      type: type ?? this.type,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      mediaMime: mediaMime ?? this.mediaMime,
      fileName: fileName ?? this.fileName,
      status: status ?? this.status,
      quotedMsgId: quotedMsgId ?? this.quotedMsgId,
      senderName: senderName ?? this.senderName,
    );
  }
}
