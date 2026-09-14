import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../theme/whatsapp_theme.dart';
import 'chat_tile.dart';
import 'qr_connection_dialog.dart';

class ChatListSidebar extends StatefulWidget {
  final VoidCallback onToggleNotes;

  const ChatListSidebar({
    super.key,
    required this.onToggleNotes,
  });

  @override
  State<ChatListSidebar> createState() => _ChatListSidebarState();
}

class _ChatListSidebarState extends State<ChatListSidebar> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Widget _buildHeader(BuildContext context, ChatProvider provider) {
    final status = provider.connectionStatus;
    Color statusColor = Colors.orange;
    String statusTooltip = 'Conectando a Evolution API...';
    if (status.status == 'open') {
      statusColor = WhatsAppColors.primaryGreen;
      statusTooltip = 'Conectado a WhatsApp (ANUBIS STORE)';
    } else if (status.status == 'close') {
      statusColor = Colors.redAccent;
      statusTooltip = 'Desconectado de WhatsApp';
    }

    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      color: WhatsAppColors.headerBackground,
      child: Row(
        children: [
          // Logo / Avatar
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: WhatsAppColors.outgoingBubble,
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Text(
                'A',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // App Title & Status
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ANUBIS STORE',
                  style: TextStyle(
                    color: WhatsAppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      status.status == 'open' ? 'En línea' : 'Conectando...',
                      style: const TextStyle(
                        color: WhatsAppColors.textSecondary,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Actions
          if (status.status != 'open')
            IconButton(
              icon: const Icon(Icons.qr_code, size: 20, color: WhatsAppColors.primaryGreen),
              tooltip: 'Vincular WhatsApp (Código QR)',
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (_) => const QrConnectionDialog(),
                );
              },
            ),
          IconButton(
            icon: const Icon(Icons.note_alt_outlined, size: 20),
            tooltip: 'Notas Rápidas y Respuestas',
            onPressed: widget.onToggleNotes,
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(ChatProvider provider) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: WhatsAppColors.sidebarBackground,
      child: Container(
        height: 36,
        decoration: BoxDecoration(
          color: WhatsAppColors.searchBackground,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 10),
              child: Icon(Icons.search, size: 18, color: WhatsAppColors.textSecondary),
            ),
            Expanded(
              child: TextField(
                controller: _searchController,
                style: const TextStyle(color: WhatsAppColors.textPrimary, fontSize: 13.5),
                decoration: const InputDecoration(
                  hintText: 'Buscar un chat o iniciar uno nuevo',
                  hintStyle: TextStyle(color: WhatsAppColors.textSecondary, fontSize: 13.5),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                ),
                onChanged: (val) => provider.setSearchQuery(val),
              ),
            ),
            if (_searchController.text.isNotEmpty)
              IconButton(
                icon: const Icon(Icons.close, size: 16, color: WhatsAppColors.textSecondary),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () {
                  _searchController.clear();
                  provider.setSearchQuery('');
                },
              ),
            const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChips(ChatProvider provider) {
    final filters = [
      {'id': 'all', 'label': 'Todos'},
      {'id': 'unread', 'label': 'No leídos'},
      {'id': 'groups', 'label': 'Grupos'},
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      color: WhatsAppColors.sidebarBackground,
      child: Row(
        children: filters.map((f) {
          final isSelected = provider.activeFilter == f['id'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => provider.setActiveFilter(f['id']!),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF0A332C) : WhatsAppColors.headerBackground,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? WhatsAppColors.primaryGreen : Colors.transparent,
                    width: 1,
                  ),
                ),
                child: Text(
                  f['label']!,
                  style: TextStyle(
                    color: isSelected ? WhatsAppColors.primaryGreen : WhatsAppColors.textSecondary,
                    fontSize: 12.5,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final chats = provider.filteredChats;

    return Container(
      color: WhatsAppColors.sidebarBackground,
      child: Column(
        children: [
          _buildHeader(context, provider),
          _buildSearchBar(provider),
          _buildFilterChips(provider),
          const Divider(height: 1, color: WhatsAppColors.divider),
          Expanded(
            child: provider.isLoadingChats
                ? const Center(
                    child: CircularProgressIndicator(
                      color: WhatsAppColors.primaryGreen,
                      strokeWidth: 2.5,
                    ),
                  )
                : chats.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.chat_bubble_outline, size: 48, color: WhatsAppColors.textMuted),
                            const SizedBox(height: 12),
                            Text(
                              provider.searchQuery.isNotEmpty
                                  ? 'No se encontraron chats con "${provider.searchQuery}"'
                                  : 'No hay chats disponibles',
                              style: const TextStyle(color: WhatsAppColors.textSecondary, fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: chats.length,
                        itemBuilder: (ctx, idx) {
                          final chat = chats[idx];
                          final isSelected = provider.activeChat?.id == chat.id;
                          return ChatTile(
                            chat: chat,
                            isSelected: isSelected,
                            onTap: () => provider.selectChat(chat),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
