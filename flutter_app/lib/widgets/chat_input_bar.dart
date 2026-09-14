import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../theme/whatsapp_theme.dart';

class ChatInputBar extends StatefulWidget {
  final VoidCallback onToggleNotes;

  const ChatInputBar({
    super.key,
    required this.onToggleNotes,
  });

  @override
  State<ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends State<ChatInputBar> {
  final TextEditingController _textController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  bool _isComposing = false;

  @override
  void initState() {
    super.initState();
    _textController.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    final hasText = _textController.text.trim().isNotEmpty;
    if (hasText != _isComposing) {
      setState(() {
        _isComposing = hasText;
      });
    }
  }

  void _handleSend() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    final provider = context.read<ChatProvider>();
    provider.sendMessage(text);

    _textController.clear();
    _focusNode.requestFocus();
  }

  Future<void> _handleAttachFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'mp3', 'ogg', 'wav', 'doc', 'docx'],
        withData: true,
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        if (file.bytes != null) {
          final base64Data = base64Encode(file.bytes!);
          final ext = file.extension?.toLowerCase() ?? '';
          String mimetype = 'application/octet-stream';
          if (['jpg', 'jpeg'].contains(ext)) mimetype = 'image/jpeg';
          else if (ext == 'png') mimetype = 'image/png';
          else if (ext == 'webp') mimetype = 'image/webp';
          else if (ext == 'pdf') mimetype = 'application/pdf';
          else if (['mp3', 'ogg', 'wav'].contains(ext)) mimetype = 'audio/ogg';

          if (mounted) {
            final provider = context.read<ChatProvider>();
            await provider.sendMedia(
              base64Data: base64Data,
              mimetype: mimetype,
              fileName: file.name,
            );
          }
        }
      }
    } catch (e) {
      debugPrint('[ChatInputBar] Error picking file: $e');
    }
  }

  @override
  void dispose() {
    _textController.removeListener(_onTextChanged);
    _textController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: WhatsAppColors.headerBackground,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Attach button
          IconButton(
            icon: const Icon(Icons.attach_file, color: WhatsAppColors.textSecondary),
            tooltip: 'Adjuntar archivo / imagen',
            onPressed: _handleAttachFile,
          ),
          // Quick Notes button
          IconButton(
            icon: const Icon(Icons.flash_on, color: WhatsAppColors.primaryGreen, size: 22),
            tooltip: 'Respuestas Rápidas',
            onPressed: widget.onToggleNotes,
          ),
          const SizedBox(width: 4),
          // Input field
          Expanded(
            child: RawKeyboardListener(
              focusNode: FocusNode(),
              onKey: (event) {
                if (event is RawKeyDownEvent &&
                    event.logicalKey == LogicalKeyboardKey.enter &&
                    !event.isShiftPressed) {
                  _handleSend();
                }
              },
              child: Container(
                constraints: const BoxConstraints(maxHeight: 120),
                decoration: BoxDecoration(
                  color: WhatsAppColors.inputBackground,
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                child: TextField(
                  controller: _textController,
                  focusNode: _focusNode,
                  maxLines: null,
                  textInputAction: TextInputAction.send,
                  keyboardType: TextInputType.multiline,
                  style: const TextStyle(
                    color: WhatsAppColors.textPrimary,
                    fontSize: 14.5,
                  ),
                  decoration: const InputDecoration(
                    hintText: 'Escribe un mensaje aquí...',
                    hintStyle: TextStyle(
                      color: WhatsAppColors.textSecondary,
                      fontSize: 14,
                    ),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Send button
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _isComposing ? WhatsAppColors.primaryGreen : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon: Icon(
                _isComposing ? Icons.send : Icons.mic,
                color: _isComposing ? Colors.black : WhatsAppColors.textSecondary,
                size: 20,
              ),
              onPressed: _isComposing ? _handleSend : null,
            ),
          ),
        ],
      ),
    );
  }
}
