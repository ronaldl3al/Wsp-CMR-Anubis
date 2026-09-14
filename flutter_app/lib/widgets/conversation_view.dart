import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/chat.dart';
import '../models/message.dart';
import '../providers/chat_provider.dart';
import '../theme/whatsapp_theme.dart';
import 'message_bubble.dart';
import 'chat_input_bar.dart';

class ConversationView extends StatefulWidget {
  final VoidCallback onToggleNotes;

  const ConversationView({
    super.key,
    required this.onToggleNotes,
  });

  @override
  State<ConversationView> createState() => _ConversationViewState();
}

class _ConversationViewState extends State<ConversationView> {
  final ScrollController _scrollController = ScrollController();

  @override
  void didUpdateWidget(covariant ConversationView oldWidget) {
    super.didUpdateWidget(oldWidget);
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _formatDateHeader(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(date.year, date.month, date.day);

    if (day == today) return 'HOY';
    if (today.difference(day).inDays == 1) return 'AYER';
    return DateFormat('dd/MM/yyyy').format(date);
  }

  Widget _buildEmptyState() {
    return Container(
      color: const Color(0xFF111B21),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                color: WhatsAppColors.headerBackground,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chat_outlined,
                size: 70,
                color: WhatsAppColors.primaryGreen,
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'WhatsApp Web - ANUBIS STORE',
              style: TextStyle(
                color: WhatsAppColors.textPrimary,
                fontSize: 26,
                fontWeight: FontWeight.w300,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Envía y recibe mensajes en tiempo real sincronizado directamente con Evolution API.\nSelecciona un chat del menú lateral para comenzar.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: WhatsAppColors.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 36),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.lock, size: 14, color: WhatsAppColors.textMuted),
                SizedBox(width: 6),
                Text(
                  'Cifrado de extremo a extremo',
                  style: TextStyle(
                    color: WhatsAppColors.textMuted,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(Chat chat) {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      color: WhatsAppColors.headerBackground,
      child: Row(
        children: [
          // Contact Avatar
          CircleAvatar(
            radius: 20,
            backgroundColor: WhatsAppColors.outgoingBubble,
            backgroundImage: (chat.profilePicUrl != null &&
                    chat.profilePicUrl!.isNotEmpty &&
                    chat.profilePicUrl!.startsWith('http'))
                ? NetworkImage(chat.profilePicUrl!)
                : null,
            child: (chat.profilePicUrl == null || !chat.profilePicUrl!.startsWith('http'))
                ? Text(
                    chat.name.isNotEmpty ? chat.name[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          const SizedBox(width: 14),
          // Contact Info
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  chat.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: WhatsAppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 15.5,
                  ),
                ),
                Text(
                  chat.isGroup ? 'Grupo de WhatsApp' : (chat.number.isNotEmpty ? chat.number : 'En línea'),
                  style: const TextStyle(
                    color: WhatsAppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          // Action icons
          IconButton(
            icon: const Icon(Icons.flash_on, color: WhatsAppColors.primaryGreen, size: 22),
            tooltip: 'Respuestas Rápidas',
            onPressed: widget.onToggleNotes,
          ),
          IconButton(
            icon: const Icon(Icons.search, size: 20),
            tooltip: 'Buscar en chat',
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.more_vert, size: 20),
            tooltip: 'Opciones',
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildDateBadge(String text) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF182229),
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: WhatsAppColors.textSecondary,
            fontSize: 11.5,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final activeChat = provider.activeChat;

    if (activeChat == null) {
      return _buildEmptyState();
    }

    final messages = provider.activeMessages;
    _scrollToBottom();

    return Container(
      color: WhatsAppColors.conversationBackground,
      child: Column(
        children: [
          _buildHeader(activeChat),
          const Divider(height: 1, color: WhatsAppColors.divider),
          Expanded(
            child: provider.isLoadingMessages
                ? const Center(
                    child: CircularProgressIndicator(
                      color: WhatsAppColors.primaryGreen,
                      strokeWidth: 2.5,
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    itemCount: messages.length,
                    itemBuilder: (ctx, idx) {
                      final msg = messages[idx];
                      final dt = DateTime.fromMillisecondsSinceEpoch(msg.timestamp * 1000);

                      bool showDateBadge = false;
                      if (idx == 0) {
                        showDateBadge = true;
                      } else {
                        final prevDt = DateTime.fromMillisecondsSinceEpoch(messages[idx - 1].timestamp * 1000);
                        if (dt.day != prevDt.day || dt.month != prevDt.month || dt.year != prevDt.year) {
                          showDateBadge = true;
                        }
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (showDateBadge) _buildDateBadge(_formatDateHeader(dt)),
                          MessageBubble(message: msg),
                        ],
                      );
                    },
                  ),
          ),
          ChatInputBar(onToggleNotes: widget.onToggleNotes),
        ],
      ),
    );
  }
}
