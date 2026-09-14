import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/message.dart';
import '../theme/whatsapp_theme.dart';
import 'status_icon.dart';

class MessageBubble extends StatelessWidget {
  final Message message;

  const MessageBubble({
    super.key,
    required this.message,
  });

  String _formatTime(int timestampSec) {
    if (timestampSec <= 0) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch(timestampSec * 1000);
    return DateFormat('HH:mm').format(dt);
  }

  Widget _buildMediaContent(BuildContext context) {
    if (message.type == 'image' && message.mediaUrl != null && message.mediaUrl!.isNotEmpty) {
      final url = message.mediaUrl!;
      Widget imgWidget;
      if (url.startsWith('data:')) {
        try {
          final clean = url.split(',').last;
          final bytes = base64Decode(clean);
          imgWidget = Image.memory(bytes, fit: BoxFit.cover);
        } catch (_) {
          imgWidget = const Icon(Icons.broken_image, size: 48, color: WhatsAppColors.textSecondary);
        }
      } else {
        imgWidget = Image.network(
          url,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, size: 48, color: WhatsAppColors.textSecondary),
        );
      }

      return Container(
        margin: const EdgeInsets.only(bottom: 6),
        constraints: const BoxConstraints(maxWidth: 320, maxHeight: 320),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
        ),
        child: imgWidget,
      );
    }

    if (message.type == 'audio') {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: WhatsAppColors.primaryGreen,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.play_arrow, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: WhatsAppColors.textMuted,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Icon(Icons.mic, size: 18, color: WhatsAppColors.textSecondary),
          ],
        ),
      );
    }

    if (message.type == 'document') {
      return Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.black12,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.insert_drive_file, color: WhatsAppColors.primaryGreen, size: 28),
            const SizedBox(width: 8),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.fileName ?? 'Documento',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: WhatsAppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                    ),
                  ),
                  if (message.mediaMime != null)
                    Text(
                      message.mediaMime!,
                      style: const TextStyle(color: WhatsAppColors.textSecondary, fontSize: 11),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  @override
  Widget build(BuildContext context) {
    final fromMe = message.fromMe;
    final timeStr = _formatTime(message.timestamp);

    final bubbleBg = fromMe ? WhatsAppColors.outgoingBubble : WhatsAppColors.incomingBubble;
    final borderRadius = BorderRadius.only(
      topLeft: const Radius.circular(8),
      topRight: const Radius.circular(8),
      bottomLeft: Radius.circular(fromMe ? 8 : 0),
      bottomRight: Radius.circular(fromMe ? 0 : 8),
    );

    return Align(
      alignment: fromMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.65,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: bubbleBg,
          borderRadius: borderRadius,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.18),
              blurRadius: 1,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!fromMe && message.senderName != null && message.senderName!.isNotEmpty) ...[
              Text(
                message.senderName!,
                style: const TextStyle(
                  color: WhatsAppColors.primaryGreen,
                  fontWeight: FontWeight.w600,
                  fontSize: 12.5,
                ),
              ),
              const SizedBox(height: 2),
            ],
            _buildMediaContent(context),
            if (message.body.isNotEmpty && (message.type == 'chat' || message.body != '[${message.type}]'))
              SelectableText(
                message.body,
                style: const TextStyle(
                  color: WhatsAppColors.textPrimary,
                  fontSize: 14.2,
                  height: 1.35,
                ),
              ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(width: 8),
                Text(
                  timeStr,
                  style: const TextStyle(
                    color: WhatsAppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
                if (fromMe) ...[
                  const SizedBox(width: 4),
                  StatusIcon(status: message.status, size: 15),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
