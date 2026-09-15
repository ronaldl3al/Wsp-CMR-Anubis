import { Chat, Message, Contact, QuickNote } from '../types';

const API_BASE = '/api';

export async function fetchConnectionStatus(): Promise<{ state: string }> {
  const res = await fetch(`${API_BASE}/connection-status`);
  return res.json();
}

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetch(`${API_BASE}/chats`);
  return res.json();
}

export async function fetchMessages(chatJid: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(chatJid)}/messages?limit=150`);
  return res.json();
}

export async function markChatRead(chatJid: string): Promise<void> {
  await fetch(`${API_BASE}/chats/${encodeURIComponent(chatJid)}/read`, { method: 'POST' });
}

export async function sendTextMessage(to: string, text: string, quotedId?: string): Promise<Message> {
  const res = await fetch(`${API_BASE}/messages/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, quotedId })
  });
  if (!res.ok) throw new Error('Failed to send text message');
  return res.json();
}

export async function sendMediaMessage(to: string, file: File, caption?: string): Promise<Message> {
  const formData = new FormData();
  formData.append('to', to);
  formData.append('file', file);
  if (caption) formData.append('caption', caption);

  const res = await fetch(`${API_BASE}/messages/send-media`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to send media');
  return res.json();
}

export async function fetchContacts(): Promise<Contact[]> {
  const res = await fetch(`${API_BASE}/contacts`);
  return res.json();
}

export async function syncContacts(): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE}/contacts/sync`, { method: 'POST' });
  return res.json();
}

export async function syncChats(): Promise<{ chats: Chat[] }> {
  const res = await fetch(`${API_BASE}/chats/sync`, { method: 'POST' });
  return res.json();
}

export async function syncChatMessages(chatJid: string): Promise<{ success: boolean; count: number; messages: Message[] }> {
  const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(chatJid)}/sync-messages`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Error al sincronizar historial');
  return res.json();
}

export async function fetchQuickNotes(): Promise<QuickNote[]> {
  const res = await fetch(`${API_BASE}/quick-notes`);
  return res.json();
}

export async function createQuickNote(title: string, content: string, category?: string): Promise<QuickNote> {
  const res = await fetch(`${API_BASE}/quick-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, category })
  });
  return res.json();
}

export async function deleteQuickNote(id: number): Promise<void> {
  await fetch(`${API_BASE}/quick-notes/${id}`, { method: 'DELETE' });
}
