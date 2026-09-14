import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/quick_note.dart';
import '../providers/notes_provider.dart';
import '../providers/chat_provider.dart';
import '../theme/whatsapp_theme.dart';

class QuickNotesPanel extends StatefulWidget {
  final VoidCallback onClose;

  const QuickNotesPanel({
    super.key,
    required this.onClose,
  });

  @override
  State<QuickNotesPanel> createState() => _QuickNotesPanelState();
}

class _QuickNotesPanelState extends State<QuickNotesPanel> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotesProvider>().loadNotes();
    });
  }

  void _showAddDialog() {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    String category = 'General';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: WhatsAppColors.headerBackground,
          title: const Text('Nueva Respuesta Rápida', style: TextStyle(color: WhatsAppColors.textPrimary)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                style: const TextStyle(color: WhatsAppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Título o atajo (ej. Saludo)',
                  labelStyle: TextStyle(color: WhatsAppColors.textSecondary),
                  enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: WhatsAppColors.divider)),
                  focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: WhatsAppColors.primaryGreen)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contentCtrl,
                style: const TextStyle(color: WhatsAppColors.textPrimary),
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Mensaje de respuesta',
                  labelStyle: TextStyle(color: WhatsAppColors.textSecondary),
                  enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: WhatsAppColors.divider)),
                  focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: WhatsAppColors.primaryGreen)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar', style: TextStyle(color: WhatsAppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: WhatsAppColors.primaryGreen,
                foregroundColor: Colors.black,
              ),
              onPressed: () {
                if (titleCtrl.text.trim().isNotEmpty && contentCtrl.text.trim().isNotEmpty) {
                  context.read<NotesProvider>().addNote(
                        titleCtrl.text.trim(),
                        contentCtrl.text.trim(),
                        category,
                      );
                  Navigator.pop(ctx);
                }
              },
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final notesProv = context.watch<NotesProvider>();
    final chatProv = context.watch<ChatProvider>();
    final notes = notesProv.filteredNotes;

    return Container(
      width: 320,
      color: WhatsAppColors.sidebarBackground,
      decoration: const BoxDecoration(
        border: Border(
          left: BorderSide(color: WhatsAppColors.divider, width: 1),
        ),
      ),
      child: Column(
        children: [
          // Header
          Container(
            height: 60,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            color: WhatsAppColors.headerBackground,
            child: Row(
              children: [
                const Icon(Icons.flash_on, color: WhatsAppColors.primaryGreen, size: 22),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Respuestas Rápidas',
                    style: TextStyle(
                      color: WhatsAppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add, color: WhatsAppColors.primaryGreen),
                  tooltip: 'Crear nueva nota',
                  onPressed: _showAddDialog,
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  tooltip: 'Cerrar panel',
                  onPressed: widget.onClose,
                ),
              ],
            ),
          ),
          // Categories
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: WhatsAppColors.sidebarBackground,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: notesProv.categories.map((cat) {
                  final isSel = notesProv.selectedCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(
                        cat,
                        style: TextStyle(
                          color: isSel ? Colors.black : WhatsAppColors.textSecondary,
                          fontSize: 12,
                          fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      selected: isSel,
                      selectedColor: WhatsAppColors.primaryGreen,
                      backgroundColor: WhatsAppColors.headerBackground,
                      onSelected: (_) => notesProv.setCategory(cat),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const Divider(height: 1, color: WhatsAppColors.divider),
          // List
          Expanded(
            child: notesProv.isLoading
                ? const Center(child: CircularProgressIndicator(color: WhatsAppColors.primaryGreen))
                : notes.isEmpty
                    ? Center(
                        child: Text(
                          'No hay notas guardadas',
                          style: TextStyle(color: WhatsAppColors.textSecondary, fontSize: 13),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: notes.length,
                        itemBuilder: (ctx, idx) {
                          final note = notes[idx];
                          return Card(
                            color: WhatsAppColors.headerBackground,
                            margin: const EdgeInsets.only(bottom: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: const BorderSide(color: WhatsAppColors.divider),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          note.title,
                                          style: const TextStyle(
                                            color: WhatsAppColors.primaryGreen,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, size: 16, color: Colors.redAccent),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(),
                                        onPressed: () => notesProv.removeNote(note.id),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    note.content,
                                    style: const TextStyle(
                                      color: WhatsAppColors.textPrimary,
                                      fontSize: 13,
                                      height: 1.3,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: ElevatedButton.icon(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: WhatsAppColors.inputBackground,
                                        foregroundColor: WhatsAppColors.primaryGreen,
                                        elevation: 0,
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                      ),
                                      icon: const Icon(Icons.send_rounded, size: 14),
                                      label: const Text('Enviar'),
                                      onPressed: () {
                                        if (chatProv.activeChat != null) {
                                          chatProv.sendMessage(note.content);
                                        }
                                      },
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
