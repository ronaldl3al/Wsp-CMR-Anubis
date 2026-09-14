import 'package:flutter/material.dart';
import '../theme/whatsapp_theme.dart';
import 'chat_list_sidebar.dart';
import 'conversation_view.dart';
import 'quick_notes_panel.dart';

class ResizableLayout extends StatefulWidget {
  const ResizableLayout({super.key});

  @override
  State<ResizableLayout> createState() => _ResizableLayoutState();
}

class _ResizableLayoutState extends State<ResizableLayout> {
  double _sidebarWidth = 360.0;
  bool _showNotes = false;
  bool _isDragging = false;

  static const double _minSidebarWidth = 260.0;
  static const double _maxSidebarWidth = 550.0;

  void _toggleNotes() {
    setState(() {
      _showNotes = !_showNotes;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WhatsAppColors.appBackground,
      body: Row(
        children: [
          // 1. Sidebar (Chat List)
          SizedBox(
            width: _sidebarWidth,
            child: ChatListSidebar(onToggleNotes: _toggleNotes),
          ),

          // 2. Resizable Divider / Splitter
          MouseRegion(
            cursor: SystemMouseCursors.resizeColumn,
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onHorizontalDragStart: (_) {
                setState(() => _isDragging = true);
              },
              onHorizontalDragUpdate: (details) {
                setState(() {
                  _sidebarWidth = (_sidebarWidth + details.delta.dx)
                      .clamp(_minSidebarWidth, _maxSidebarWidth);
                });
              },
              onHorizontalDragEnd: (_) {
                setState(() => _isDragging = false);
              },
              child: Container(
                width: 6,
                color: _isDragging ? WhatsAppColors.primaryGreen : WhatsAppColors.divider,
              ),
            ),
          ),

          // 3. Main Conversation Area
          Expanded(
            child: ConversationView(onToggleNotes: _toggleNotes),
          ),

          // 4. Quick Notes Drawer (collapsible)
          if (_showNotes)
            QuickNotesPanel(onClose: _toggleNotes),
        ],
      ),
    );
  }
}
