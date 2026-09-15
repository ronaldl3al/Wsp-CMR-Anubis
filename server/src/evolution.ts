import { config } from './config';
import { Contact, Chat, Message, MessageAck } from './types';
import * as db from './db';

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function evolutionFetch(endpoint: string, options: { method?: string; body?: any } = {}) {
  const url = `${config.evolution.apiUrl}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: config.evolution.apiKey
  };

  const init: RequestInit = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, init);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

export async function checkConnectionStatus(): Promise<{ state: string }> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  try {
    const res = await evolutionFetch(`/instance/connectionState/${inst}`);
    if (res.ok && res.data?.instance) {
      return { state: res.data.instance.state || 'close' };
    }
  } catch (err: any) {
    console.error('[EVOLUTION] Error checking connection state:', err.message);
  }
  return { state: 'close' };
}

export async function syncContacts(): Promise<{ count: number }> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  console.log('[EVOLUTION] Starting safe contact import from WhatsApp...');

  let contactsRes = await evolutionFetch(`/contact/findContact/${inst}`, { method: 'POST', body: {} });
  if (!contactsRes.ok || !contactsRes.data) {
    contactsRes = await evolutionFetch(`/contact/findContact/${inst}`, { method: 'GET' });
  }

  const contactsList = Array.isArray(contactsRes.data)
    ? contactsRes.data
    : (contactsRes.data?.contacts || contactsRes.data?.data || []);

  let count = 0;
  if (Array.isArray(contactsList) && contactsList.length > 0) {
    for (const c of contactsList) {
      if (!c) continue;
      const jid = c.remoteJid || (c.id && c.id.includes('@') ? c.id : null);
      if (!jid || jid.includes('@broadcast') || jid.endsWith('newsletter')) continue;

      const number = normalizePhoneNumber(jid.split('@')[0]);
      const name = c.name || null; // Saved in phonebook
      const pushName = c.pushName || c.displayName || null; // WhatsApp profile name
      const pic = c.profilePictureUrl || c.profilePicUrl || null;
      const isSaved = Boolean(name && name.trim().length > 0);

      await db.upsertContact({
        jid,
        name: name || undefined,
        push_name: pushName || undefined,
        number,
        profile_pic_url: pic || undefined,
        is_saved: isSaved
      });

      // Also ensure chat exists with the proper contact name
      const displayName = name || pushName || number;
      await db.upsertChat({
        jid,
        name: displayName,
        number,
        is_group: jid.includes('@g.us'),
        profile_pic_url: pic || undefined
      });

      count++;
    }
  }

  console.log(`[EVOLUTION] Successfully imported ${count} contacts into PostgreSQL.`);
  return { count };
}

export async function syncRecentChats(): Promise<void> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  try {
    console.log('[EVOLUTION] Syncing recent chats from Evolution API...');
    let res = await evolutionFetch(`/chat/findChats/${inst}`, { method: 'POST', body: {} });
    if (!res.ok || !res.data) {
      res = await evolutionFetch(`/chat/findChats/${inst}`, { method: 'GET' });
    }

    const chatsList = Array.isArray(res.data) ? res.data : (res.data?.chats || res.data?.data || []);
    if (Array.isArray(chatsList)) {
      for (const item of chatsList) {
        if (!item) continue;
        const jid = item.remoteJid || item.id;
        if (!jid || !jid.includes('@') || jid.includes('@broadcast') || jid.endsWith('newsletter')) continue;

        const number = normalizePhoneNumber(jid.split('@')[0]);
        const name = item.name || item.pushName || number;
        const isGroup = jid.includes('@g.us');
        const pic = item.profilePictureUrl || item.profilePicUrl || null;

        await db.upsertChat({
          jid,
          name,
          number,
          is_group: isGroup,
          profile_pic_url: pic || undefined,
          unread_count: item.unreadCount || 0
        });
      }
    }
  } catch (err: any) {
    console.error('[EVOLUTION] Error syncing recent chats:', err.message);
  }
}

export async function sendTextMessage(to: string, text: string, quotedId?: string): Promise<Message> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  let destination = to;
  if (!to.includes('@g.us') && !to.includes('@lid')) {
    destination = normalizePhoneNumber(to);
  }

  const payload: any = {
    number: destination,
    text,
    options: {
      delay: 300,
      presence: 'composing'
    }
  };

  if (quotedId) {
    payload.quoted = {
      key: { id: quotedId }
    };
  }

  const res = await evolutionFetch(`/message/sendText/${inst}`, {
    method: 'POST',
    body: payload
  });

  const msgKey = res.data?.key || {};
  const msgId = msgKey.id || `msg_${Date.now()}`;
  const timestamp = res.data?.messageTimestamp || Math.floor(Date.now() / 1000);
  const targetJid = to.includes('@') ? to : `${destination}@s.whatsapp.net`;

  const message: Message = {
    id: msgId,
    chat_jid: targetJid,
    from_me: true,
    body: text,
    type: 'chat',
    status: res.ok ? 'sent' : 'pending',
    quoted_id: quotedId,
    timestamp
  };

  const { message: savedMsg } = await db.addMessage(message);
  return savedMsg;
}

export async function sendMediaMessage(
  to: string,
  mediaBase64: string,
  mimetype: string,
  fileName?: string,
  caption?: string
): Promise<Message> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  let destination = to;
  if (!to.includes('@g.us') && !to.includes('@lid')) {
    destination = normalizePhoneNumber(to);
  }

  const cleanBase64 = mediaBase64.includes(';base64,') ? mediaBase64.split(';base64,')[1] : mediaBase64;
  const isAudio = mimetype.includes('audio') || mimetype.includes('ogg') || mimetype.includes('opus') || mimetype.includes('mp3');

  let endpoint = `/message/sendMedia/${inst}`;
  let payload: any = {};

  if (isAudio) {
    endpoint = `/message/sendWhatsAppAudio/${inst}`;
    payload = {
      number: destination,
      audio: `data:${mimetype};base64,${cleanBase64}`
    };
  } else {
    let mediatype: 'image' | 'video' | 'document' = 'document';
    if (mimetype.startsWith('image/')) mediatype = 'image';
    else if (mimetype.startsWith('video/')) mediatype = 'video';

    payload = {
      number: destination,
      mediatype,
      mimetype,
      caption: caption || '',
      media: `data:${mimetype};base64,${cleanBase64}`,
      fileName: fileName || `file_${Date.now()}`
    };
  }

  const res = await evolutionFetch(endpoint, {
    method: 'POST',
    body: payload
  });

  const msgKey = res.data?.key || {};
  const msgId = msgKey.id || `msg_media_${Date.now()}`;
  const timestamp = res.data?.messageTimestamp || Math.floor(Date.now() / 1000);
  const targetJid = to.includes('@') ? to : `${destination}@s.whatsapp.net`;

  let type: Message['type'] = 'document';
  if (isAudio) type = 'audio';
  else if (mimetype.startsWith('image/')) type = 'image';
  else if (mimetype.startsWith('video/')) type = 'video';

  const message: Message = {
    id: msgId,
    chat_jid: targetJid,
    from_me: true,
    body: caption || `[${type}]`,
    type,
    media_url: `data:${mimetype};base64,${cleanBase64}`,
    media_mimetype: mimetype,
    media_filename: fileName || `file_${Date.now()}`,
    status: res.ok ? 'sent' : 'pending',
    timestamp
  };

  const { message: savedMsg } = await db.addMessage(message);
  return savedMsg;
}

export async function markChatRead(chatJid: string): Promise<void> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  await db.markChatAsRead(chatJid);

  try {
    await evolutionFetch(`/chat/markMessageAsRead/${inst}`, {
      method: 'POST',
      body: {
        readMessages: [{ remoteJid: chatJid }]
      }
    });
  } catch (err: any) {
    console.error(`[EVOLUTION] Error marking chat ${chatJid} read in Evolution:`, err.message);
  }
}
