import 'package:flutter/material.dart';

class WhatsAppColors {
  static const Color appBackground = Color(0xFF0C1317);
  static const Color conversationBackground = Color(0xFF0B141A);
  static const Color sidebarBackground = Color(0xFF111B21);
  static const Color headerBackground = Color(0xFF202C33);
  static const Color searchBackground = Color(0xFF202C33);
  static const Color inputBackground = Color(0xFF2A3942);
  static const Color divider = Color(0xFF222D34);
  static const Color hover = Color(0xFF202C33);
  static const Color activeChat = Color(0xFF2A3942);

  // Bubbles
  static const Color outgoingBubble = Color(0xFF005C4B);
  static const Color incomingBubble = Color(0xFF202C33);

  // WhatsApp Accents
  static const Color primaryGreen = Color(0xFF00A884);
  static const Color accentGreen = Color(0xFF25D366);
  static const Color checkBlue = Color(0xFF53BDEB);
  static const Color checkGray = Color(0xFF8696A0);

  // Text
  static const Color textPrimary = Color(0xFFE9EDEF);
  static const Color textSecondary = Color(0xFF8696A0);
  static const Color textMuted = Color(0xFF667781);
  static const Color textLink = Color(0xFF53BDEB);
}

class WhatsAppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: WhatsAppColors.conversationBackground,
      primaryColor: WhatsAppColors.primaryGreen,
      canvasColor: WhatsAppColors.sidebarBackground,
      cardColor: WhatsAppColors.headerBackground,
      dividerColor: WhatsAppColors.divider,
      colorScheme: const ColorScheme.dark(
        primary: WhatsAppColors.primaryGreen,
        secondary: WhatsAppColors.accentGreen,
        surface: WhatsAppColors.sidebarBackground,
        background: WhatsAppColors.conversationBackground,
      ),
      fontFamily: 'Segoe UI',
      textTheme: const TextTheme(
        bodyLarge: TextStyle(color: WhatsAppColors.textPrimary, fontSize: 15),
        bodyMedium: TextStyle(color: WhatsAppColors.textPrimary, fontSize: 14),
        bodySmall: TextStyle(color: WhatsAppColors.textSecondary, fontSize: 12),
        titleMedium: TextStyle(color: WhatsAppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
      ),
      iconTheme: const IconThemeData(
        color: WhatsAppColors.textSecondary,
        size: 22,
      ),
    );
  }
}
