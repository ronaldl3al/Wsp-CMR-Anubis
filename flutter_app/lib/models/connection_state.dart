class AppConnectionStatus {
  final String status; // 'open' | 'connecting' | 'close'
  final String qrCode;

  AppConnectionStatus({
    required this.status,
    this.qrCode = '',
  });

  bool get isConnected => status == 'open';
  bool get hasQr => qrCode.isNotEmpty;

  factory AppConnectionStatus.fromJson(Map<String, dynamic> json) {
    return AppConnectionStatus(
      status: json['status']?.toString() ?? 'connecting',
      qrCode: json['qrCode']?.toString() ?? '',
    );
  }
}
