export type MessageAck = 'pending' | 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  chatId: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  type: 'chat' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'vcard' | 'location';
  mediaUrl?: string;
  mediaMime?: string;
  fileName?: string;
  status: MessageAck;
  quotedMsgId?: string;
  senderName?: string;
}

export interface Chat {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
  profilePicUrl?: string;
  lastMessage?: {
    id: string;
    body: string;
    timestamp: number;
    fromMe: boolean;
    status: MessageAck;
    type: string;
  };
  unreadCount: number;
  updatedAt: number;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  category?: string;
  createdAt: number;
}

export interface SocketEvent<T = any> {
  event: 'new_message' | 'message_ack' | 'chat_updated' | 'chats_init' | 'connection_status' | 'qr_code' | 'sync_status';
  data: T;
}
