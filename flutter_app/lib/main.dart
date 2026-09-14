import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/chat_provider.dart';
import 'providers/notes_provider.dart';
import 'theme/whatsapp_theme.dart';
import 'widgets/resizable_layout.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const WhatsAppCloneApp());
}

class WhatsAppCloneApp extends StatelessWidget {
  const WhatsAppCloneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ChatProvider()..init()),
        ChangeNotifierProvider(create: (_) => NotesProvider()),
      ],
      child: MaterialApp(
        title: 'WhatsApp Web - ANUBIS STORE',
        debugShowCheckedModeBanner: false,
        theme: WhatsAppTheme.darkTheme,
        home: const ResizableLayout(),
      ),
    );
  }
}
