import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/chat.dart';
import '../theme/whatsapp_theme.dart';
import 'status_icon.dart';

class ChatTile extends StatelessWidget {
  final Chat chat;
  final bool isSelected;
  final VoidCallback onTap;

  const ChatTile({
    super.key,
    required this.chat,
    required this.isSelected,
    required this.onTap,
  });

  String _formatTimestamp(int timestampSec) {
    if (timestampSec <= 0) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch(timestampSec * 1000);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDay = DateTime(dt.year, dt.month, dt.day);

    if (messageDay == today) {
      return DateFormat('HH:mm').format(dt);
    } else if (today.difference(messageDay).inDays == 1) {
      return 'Ayer';
    } else if (today.difference(messageDay).inDays < 7) {
      const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      return weekdays[dt.weekday - 1];
    } else {
      return DateFormat('dd/MM/yy').format(dt);
    }
  }

  Color _getAvatarBg(String name) {
    final colors = [
      const Color(0xFF00A884),
      const Color(0xFF007BFC),
      const Color(0xFFE542A3),
      const Color(0xFFF15C6D),
      const Color(0xFFFFB600),
      const Color(0xFF7E85F9),
    ];
    int hash = 0;
    for (int i = 0; i < name.length; i++) {
      hash += name.codeUnitAt(i);
    }
    return colors[hash % colors.length];
  }

  Widget _buildAvatar() {
    final initials = chat.name.isNotEmpty
        ? chat.name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
        : '?';

    if (chat.profilePicUrl != null && chat.profilePicUrl!.isNotEmpty && chat.profilePicUrl!.startsWith('http')) {
      return ClipOval(
        child: Image.network(
          chat.profilePicUrl!,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildInitialsAvatar(initials),
        ),
      );
    }

    return _buildInitialsAvatar(initials);
  }

  Widget _buildInitialsAvatar(String initials) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: _getAvatarBg(chat.name),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: chat.isGroup
            ? const Icon(Icons.group, color: Colors.white, size: 24)
            : Text(
                initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lm = chat.lastMessage;
    final timeStr = lm != null ? _formatTimestamp(lm.timestamp) : '';

    return Material(
      color: isSelected ? WhatsAppColors.activeChat : WhatsAppColors.sidebarBackground,
      child: InkWell(
        onTap: onTap,
        hoverColor: isSelected ? WhatsAppColors.activeChat : WhatsAppColors.hover,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: WhatsAppColors.divider, width: 0.5),
            ),
          ),
          child: Row(
            children: [
              _buildAvatar(),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            chat.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: WhatsAppColors.textPrimary,
                              fontWeight: FontWeight.w500,
                              fontSize: 15.5,
                            ),
                          ),
                        ),
                        if (timeStr.isNotEmpty)
                          Text(
                            timeStr,
                            style: TextStyle(
                              color: chat.unreadCount > 0
                                  ? WhatsAppColors.primaryGreen
                                  : WhatsAppColors.textSecondary,
                              fontSize: 12,
                              fontWeight: chat.unreadCount > 0 ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (lm != null && lm.fromMe) ...[
                          StatusIcon(status: lm.status, size: 16),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            lm?.body.isNotEmpty == true ? lm!.body : (chat.isGroup ? 'Grupo' : chat.number),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: chat.unreadCount > 0
                                  ? WhatsAppColors.textPrimary
                                  : WhatsAppColors.textSecondary,
                              fontSize: 13.5,
                              fontWeight: chat.unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
                            ),
                          ),
                        ),
                        if (chat.unreadCount > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: const BoxDecoration(
                              color: WhatsAppColors.primaryGreen,
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${chat.unreadCount}',
                              style: const TextStyle(
                                color: Colors.black,
                                fontWeight: FontWeight.bold,
                                fontSize: 11.5,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
