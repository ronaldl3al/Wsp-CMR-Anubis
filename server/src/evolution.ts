import { config } from './config';
import { Contact, Chat, Message, MessageAck } from './types';
import * as db from './db';

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function unwrapMessage(msg: any): any {
  if (!msg) return {};
  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);
  return msg;
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

  let contactsRes = await evolutionFetch(`/chat/findContacts/${inst}`, { method: 'POST', body: {} });
  if (!contactsRes.ok || !contactsRes.data) {
    contactsRes = await evolutionFetch(`/chat/findContacts/${inst}`, { method: 'GET' });
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

        const lastMsg = item.lastMessage;
        let lastMessageText = '';
        let lastMessageTime = 0;
        let lastMessageFromMe = false;
        let lastMessageStatus: MessageAck = 'delivered';

        if (lastMsg) {
          lastMessageText =
            lastMsg.message?.conversation ||
            lastMsg.message?.extendedTextMessage?.text ||
            lastMsg.message?.imageMessage?.caption ||
            lastMsg.message?.videoMessage?.caption ||
            '';
          lastMessageTime = Number(lastMsg.messageTimestamp) || 0;
          lastMessageFromMe = Boolean(lastMsg.key?.fromMe);
          if (lastMsg.status === 'READ') lastMessageStatus = 'read';
          else if (lastMsg.status === 'DELIVERY_ACK') lastMessageStatus = 'delivered';
          else if (lastMsg.status === 'SERVER_ACK') lastMessageStatus = 'sent';
        }

        await db.upsertChat({
          jid,
          name,
          number,
          is_group: isGroup,
          profile_pic_url: pic || undefined,
          unread_count: item.unreadCount || 0,
          last_message_text: lastMessageText || undefined,
          last_message_time: lastMessageTime || undefined,
          last_message_from_me: lastMessageFromMe,
          last_message_status: lastMessageStatus
        });
      }
    }
  } catch (err: any) {
    console.error('[EVOLUTION] Error syncing recent chats:', err.message);
  }
}

export async function sendTextMessage(
  to: string,
  text: string,
  quotedId?: string,
  quotedBody?: string,
  quotedSender?: string
): Promise<Message> {
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

  let resolvedQuotedBody = quotedBody;
  let resolvedQuotedSender = quotedSender;

  if (quotedId) {
    try {
      const qRes = await db.pool.query('SELECT * FROM wsp_messages WHERE id = $1', [quotedId]);
      const quotedMsg = qRes.rows[0];
      if (quotedMsg) {
        if (!resolvedQuotedBody) resolvedQuotedBody = quotedMsg.body;
        if (!resolvedQuotedSender) {
          resolvedQuotedSender = quotedMsg.from_me ? 'Tú' : (quotedMsg.sender_name || quotedMsg.chat_jid?.split('@')[0]);
        }
      }

      const quoteObj = {
        key: {
          remoteJid: quotedMsg?.chat_jid || (to.includes('@') ? to : `${destination}@s.whatsapp.net`),
          fromMe: quotedMsg ? quotedMsg.from_me : false,
          id: quotedId
        },
        message: {
          conversation: resolvedQuotedBody || ''
        }
      };
      payload.quoted = quoteObj;
      payload.options.quoted = quoteObj;
    } catch (e: any) {
      console.error('[EVOLUTION] Error preparing quoted message:', e.message);
    }
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
    quoted_body: resolvedQuotedBody,
    quoted_sender: resolvedQuotedSender,
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
      audio: cleanBase64
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
      media: cleanBase64,
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

  const fullDataUri = mediaBase64.startsWith('data:')
    ? mediaBase64
    : `data:${mimetype};base64,${cleanBase64}`;

  const message: Message = {
    id: msgId,
    chat_jid: targetJid,
    from_me: true,
    body: caption || `[${type}]`,
    type,
    media_url: fullDataUri,
    media_mimetype: mimetype,
    media_filename: fileName || `file_${Date.now()}`,
    status: res.ok ? 'sent' : 'pending',
    timestamp
  };

  const { message: savedMsg } = await db.addMessage(message);
  return savedMsg;
}

export async function syncChatMessages(chatJid: string): Promise<Message[]> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  console.log(`[EVOLUTION] Syncing historical messages for chat: ${chatJid}...`);

  const payload = {
    where: {
      key: {
        remoteJid: chatJid
      }
    },
    limit: 50
  };

  const res = await evolutionFetch(`/chat/findMessages/${inst}`, {
    method: 'POST',
    body: payload
  });

  const records = res.data?.messages?.records || res.data?.records || (Array.isArray(res.data) ? res.data : []);
  const savedMessages: Message[] = [];

  for (const item of records) {
    if (!item || !item.key) continue;
    const msgId = item.key.id;
    if (!msgId) continue;

    const fromMe = Boolean(item.key.fromMe);
    const rawMsg = item.message || {};
    const msgObj = unwrapMessage(rawMsg);
    const text =
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      msgObj.imageMessage?.caption ||
      msgObj.videoMessage?.caption ||
      msgObj.documentMessage?.caption ||
      '';

    const contextInfo =
      msgObj.extendedTextMessage?.contextInfo ||
      msgObj.imageMessage?.contextInfo ||
      msgObj.videoMessage?.contextInfo ||
      msgObj.audioMessage?.contextInfo ||
      msgObj.documentMessage?.contextInfo;
    const quotedId = contextInfo?.stanzaId;
    const quotedBody =
      contextInfo?.quotedMessage?.conversation ||
      contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      contextInfo?.quotedMessage?.imageMessage?.caption ||
      (contextInfo?.quotedMessage ? '[Archivo]' : undefined);
    const quotedSender = contextInfo?.participant ? contextInfo.participant.split('@')[0] : (fromMe ? 'Tú' : undefined);

    let type: Message['type'] = 'chat';
    let mediaMimetype: string | undefined;
    let mediaFilename: string | undefined;
    let mediaUrl: string | undefined;

    if (msgObj.imageMessage) {
      type = 'image';
      mediaMimetype = msgObj.imageMessage.mimetype || 'image/jpeg';
      mediaUrl = item.base64 ? `data:${mediaMimetype};base64,${item.base64}` : undefined;
    } else if (msgObj.videoMessage) {
      type = 'video';
      mediaMimetype = msgObj.videoMessage.mimetype || 'video/mp4';
      mediaUrl = item.base64 ? `data:${mediaMimetype};base64,${item.base64}` : undefined;
    } else if (msgObj.audioMessage) {
      type = 'audio';
      mediaMimetype = msgObj.audioMessage.mimetype || 'audio/ogg';
      mediaUrl = item.base64 ? `data:${mediaMimetype};base64,${item.base64}` : undefined;
    } else if (msgObj.documentMessage) {
      type = 'document';
      mediaMimetype = msgObj.documentMessage.mimetype || 'application/octet-stream';
      mediaFilename = msgObj.documentMessage.fileName;
      mediaUrl = item.base64 ? `data:${mediaMimetype};base64,${item.base64}` : undefined;
    }

    // Auto-decrypt media if base64 not yet embedded
    if (type !== 'chat' && !mediaUrl) {
      const decrypted = await getBase64FromMedia(msgId);
      if (decrypted?.base64) {
        mediaUrl = `data:${decrypted.mimetype || mediaMimetype || 'image/jpeg'};base64,${decrypted.base64}`;
      }
    }

    const timestamp = Number(item.messageTimestamp) || Math.floor(Date.now() / 1000);
    let status: MessageAck = fromMe ? 'sent' : 'delivered';
    const rawStatus = item.status;
    const numStatus = Number(rawStatus);
    const strStatus = String(rawStatus).toUpperCase();
    if (numStatus === 4 || numStatus === 5 || strStatus === 'READ' || strStatus === 'PLAYED') status = 'read';
    else if (numStatus === 3 || strStatus === 'DELIVERY_ACK' || strStatus === 'DELIVERED') status = 'delivered';
    else if (numStatus === 2 || strStatus === 'SERVER_ACK' || strStatus === 'SENT') status = 'sent';

    const message: Message = {
      id: msgId,
      chat_jid: chatJid,
      sender_jid: item.key.participant || chatJid,
      sender_name: item.pushName || undefined,
      from_me: fromMe,
      body: text || (type !== 'chat' ? `[${type}]` : ''),
      type,
      media_url: mediaUrl,
      media_mimetype: mediaMimetype,
      media_filename: mediaFilename,
      quoted_id: quotedId,
      quoted_body: quotedBody,
      quoted_sender: quotedSender,
      status,
      timestamp
    };

    const { message: saved } = await db.addMessage(message);
    savedMessages.push(saved);
  }

  return savedMessages;
}

export async function markChatRead(chatJid: string): Promise<void> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  await db.markChatAsRead(chatJid);

  try {
    const unreadRes = await db.pool.query(
      "SELECT id, chat_jid FROM wsp_messages WHERE chat_jid = $1 AND from_me = FALSE AND status != 'read' ORDER BY timestamp DESC LIMIT 30",
      [chatJid]
    );

    const readMessages = unreadRes.rows.length > 0
      ? unreadRes.rows.map((r: any) => ({ remoteJid: r.chat_jid, fromMe: false, id: r.id }))
      : [{ remoteJid: chatJid, fromMe: false }];

    await evolutionFetch(`/chat/markMessageAsRead/${inst}`, {
      method: 'POST',
      body: { readMessages }
    });

    if (unreadRes.rows.length > 0) {
      const ids = unreadRes.rows.map((r: any) => r.id);
      await db.pool.query("UPDATE wsp_messages SET status = 'read' WHERE id = ANY($1)", [ids]);
    }
  } catch (err: any) {
    console.error(`[EVOLUTION] Error marking chat ${chatJid} read in Evolution:`, err.message);
  }
}

export async function getBase64FromMedia(messageId: string): Promise<{ base64: string; mimetype?: string } | null> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  try {
    const res = await evolutionFetch(`/chat/getBase64FromMediaMessage/${inst}`, {
      method: 'POST',
      body: {
        message: {
          key: {
            id: messageId
          }
        }
      }
    });
    if (res.ok && res.data?.base64) {
      return {
        base64: res.data.base64,
        mimetype: res.data.mimetype
      };
    }
  } catch (err: any) {
    console.error(`[EVOLUTION] Error decrypting media for message ${messageId}:`, err.message);
  }
  return null;
}

export async function updateMessage(chatJid: string, messageId: string, newText: string): Promise<boolean> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  const number = chatJid.replace(/@.+$/, '');
  try {
    const res = await evolutionFetch(`/chat/updateMessage/${inst}`, {
      method: 'POST',
      body: {
        number,
        key: {
          remoteJid: chatJid,
          fromMe: true,
          id: messageId
        },
        text: newText
      }
    });
    return res.ok;
  } catch (err: any) {
    console.error(`[EVOLUTION] Error editing message ${messageId}:`, err.message);
    return false;
  }
}

export async function deleteMessageForEveryone(chatJid: string, messageId: string): Promise<boolean> {
  const inst = encodeURIComponent(config.evolution.instanceName);
  try {
    const res = await evolutionFetch(`/chat/deleteMessageForEveryone/${inst}`, {
      method: 'DELETE',
      body: {
        remoteJid: chatJid,
        id: messageId,
        fromMe: true
      }
    });
    return res.ok;
  } catch (err: any) {
    console.error(`[EVOLUTION] Error deleting message ${messageId} for everyone:`, err.message);
    return false;
  }
}

