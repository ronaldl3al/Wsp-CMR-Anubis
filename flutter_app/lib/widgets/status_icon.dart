import 'package:flutter/material.dart';
import '../theme/whatsapp_theme.dart';

class StatusIcon extends StatelessWidget {
  final String status;
  final double size;

  const StatusIcon({
    super.key,
    required this.status,
    this.size = 15,
  });

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case 'pending':
        return Icon(
          Icons.access_time_rounded,
          size: size,
          color: WhatsAppColors.checkGray,
        );
      case 'sent':
        return Icon(
          Icons.check,
          size: size,
          color: WhatsAppColors.checkGray,
        );
      case 'delivered':
        return Icon(
          Icons.done_all,
          size: size,
          color: WhatsAppColors.checkGray,
        );
      case 'read':
        return Icon(
          Icons.done_all,
          size: size,
          color: WhatsAppColors.checkBlue,
        );
      default:
        return Icon(
          Icons.check,
          size: size,
          color: WhatsAppColors.checkGray,
        );
    }
  }
}
