import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../theme/whatsapp_theme.dart';

class QrConnectionDialog extends StatelessWidget {
  const QrConnectionDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final status = provider.connectionStatus;
    final qrData = status.qrCode;

    Widget qrWidget;
    if (status.status == 'open') {
      qrWidget = Column(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(Icons.check_circle, color: WhatsAppColors.primaryGreen, size: 80),
          SizedBox(height: 16),
          Text(
            '¡WhatsApp está Conectado!',
            style: TextStyle(
              color: WhatsAppColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'La sesión con ANUBIS STORE está activa y sincronizada.',
            style: TextStyle(color: WhatsAppColors.textSecondary, fontSize: 13),
            textAlign: TextAlign.center,
          ),
        ],
      );
    } else if (qrData.isNotEmpty) {
      Widget img;
      if (qrData.startsWith('data:image')) {
        try {
          final clean = qrData.split(',').last;
          img = Image.memory(base64Decode(clean), width: 240, height: 240);
        } catch (_) {
          img = const Icon(Icons.qr_code, size: 200, color: Colors.white);
        }
      } else {
        // If Evolution returned raw base64 without prefix
        try {
          img = Image.memory(base64Decode(qrData), width: 240, height: 240);
        } catch (_) {
          img = const Icon(Icons.qr_code, size: 200, color: Colors.white);
        }
      }

      qrWidget = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: img,
          ),
          const SizedBox(height: 16),
          const Text(
            'Escanea el código con tu WhatsApp',
            style: TextStyle(
              color: WhatsAppColors.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            '1. Abre WhatsApp en tu teléfono\n2. Toca Dispositivos Vinculados\n3. Apunta tu cámara a este código QR',
            style: TextStyle(color: WhatsAppColors.textSecondary, fontSize: 13, height: 1.4),
            textAlign: TextAlign.left,
          ),
        ],
      );
    } else {
      qrWidget = Column(
        mainAxisSize: MainAxisSize.min,
        children: const [
          CircularProgressIndicator(color: WhatsAppColors.primaryGreen),
          SizedBox(height: 20),
          Text(
            'Generando código QR desde Evolution API...',
            style: TextStyle(color: WhatsAppColors.textSecondary, fontSize: 13),
          ),
        ],
      );
    }

    return AlertDialog(
      backgroundColor: WhatsAppColors.headerBackground,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Row(
        children: const [
          Icon(Icons.qr_code_scanner, color: WhatsAppColors.primaryGreen),
          SizedBox(width: 10),
          Text(
            'Vincular WhatsApp',
            style: TextStyle(color: WhatsAppColors.textPrimary, fontSize: 18),
          ),
        ],
      ),
      content: SizedBox(
        width: 320,
        child: qrWidget,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cerrar', style: TextStyle(color: WhatsAppColors.textSecondary)),
        ),
      ],
    );
  }
}
