export type MessageType = 'chat' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact';
export type MessageAck = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Contact {
  jid: string;
  name?: string;
  push_name?: string;
  number: string;
  profile_pic_url?: string;
  is_saved: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Chat {
  jid: string;
  name: string;
  number: string;
  is_group: boolean;
  unread_count: number;
  last_message_text?: string;
  last_message_type?: MessageType;
  last_message_time?: number;
  last_message_from_me?: boolean;
  last_message_status?: MessageAck;
  is_pinned?: boolean;
  is_archived?: boolean;
  profile_pic_url?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  chat_jid: string;
  sender_jid?: string;
  sender_name?: string;
  from_me: boolean;
  body?: string;
  type: MessageType;
  media_url?: string;
  media_mimetype?: string;
  media_filename?: string;
  status: MessageAck;
  quoted_id?: string;
  timestamp: number;
  is_pinned?: boolean;
  is_edited?: boolean;
  is_deleted?: boolean;
  created_at?: string;
}

export interface QuickNote {
  id: number;
  title: string;
  content: string;
  category: string;
  created_at?: string;
}
