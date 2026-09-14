class QuickNote {
  final String id;
  final String title;
  final String content;
  final String category;
  final int createdAt;

  QuickNote({
    required this.id,
    required this.title,
    required this.content,
    this.category = 'General',
    required this.createdAt,
  });

  factory QuickNote.fromJson(Map<String, dynamic> json) {
    return QuickNote(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      category: json['category']?.toString() ?? 'General',
      createdAt: (json['createdAt'] is num) ? (json['createdAt'] as num).toInt() : DateTime.now().millisecondsSinceEpoch,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'category': category,
      'createdAt': createdAt,
    };
  }
}
