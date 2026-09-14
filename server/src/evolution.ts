import { config } from './config';
import { store } from './store';
import { Chat, Message, MessageAck } from './types';
import { broadcastNewMessage, broadcastChatUpdated } from './socket';

export const evolutionFetch = async (
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
) => {
  const url = `${config.evolution.apiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: config.evolution.apiKey,
    'api-key': config.evolution.apiKey,
    Authorization: `Bearer ${config.evolution.apiKey}`,
    ...(options.headers || {})
  };

  const reqOptions: RequestInit = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    reqOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, reqOptions);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (err: any) {
    console.error(`[EVOLUTION_FETCH_ERR] ${options.method || 'GET'} ${url}:`, err?.message);
    return { status: 500, ok: false, data: null, error: err };
  }
};

export const normalizePhoneNumber = (raw: string): string => {
  if (!raw) return '';
  if (raw.includes('@lid')) return raw;
  if (raw.includes('@g.us')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits;
};

export const resolveInstanceName = async (): Promise<string> => {
  try {
    const res = await evolutionFetch('/instance/fetchInstances');
    const list = Array.isArray(res.data) ? res.data : [];
    if (list.length > 0) {
      const match = list.find(
        (inst: any) =>
          inst.name?.toLowerCase().trim() === config.evolution.instanceName.toLowerCase().trim()
      );
      if (match && match.name) return match.name;
      const openMatch = list.find((inst: any) => inst.connectionStatus === 'open');
      if (openMatch && openMatch.name) return openMatch.name;
      if (list[0].name) return list[0].name;
    }
  } catch {}
  return config.evolution.instanceName;
};

export const initEvolution = async () => {
  const instanceName = await resolveInstanceName();
  config.evolution.instanceName = instanceName;
  const inst = encodeURIComponent(instanceName);

  console.log(`[EVOLUTION] Connecting to Evolution API: ${config.evolution.apiUrl} (resolved instance: ${instanceName})`);

  try {
    // 1. Check if instance exists
    const stateRes = await evolutionFetch(`/instance/connectionState/${inst}`);
    if (stateRes.status === 404 || !stateRes.ok) {
      console.log(`[EVOLUTION] Instance ${instanceName} not found, creating...`);
      await evolutionFetch('/instance/create', {
        method: 'POST',
        body: {
          instanceName,
          token: config.evolution.apiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        }
      });
    }

    // 2. Configure Webhook with both URLs and formats
    const webhookUrl = `${config.backendUrl}/webhook`;
    console.log(`[EVOLUTION] Configuring Webhook to ${webhookUrl}`);

    const webhookEvents = [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'MESSAGES_DELETE',
      'SEND_MESSAGE',
      'MESSAGES_SET',
      'CHATS_UPSERT',
      'CHATS_UPDATE',
      'CHATS_SET',
      'CONTACTS_UPSERT',
      'CONTACTS_UPDATE',
      'CONTACTS_SET',
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED'
    ];

    // Try nested format
    await evolutionFetch(`/webhook/set/${inst}`, {
      method: 'POST',
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: webhookEvents
        }
      }
    });

    // Try flat format
    await evolutionFetch(`/webhook/set/${inst}`, {
      method: 'POST',
      body: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: webhookEvents
      }
    });

    // Ensure readMessages is enabled
    await evolutionFetch(`/settings/set/${inst}`, {
      method: 'POST',
      body: { readMessages: true }
    });

    // 3. Check State & Connect
    const connRes = await evolutionFetch(`/instance/connectionState/${inst}`);
    const state = connRes.data?.instance?.state || connRes.data?.state || connRes.data?.instance?.connectionStatus || '';
    if (state === 'open') {
      console.log(`[EVOLUTION] WhatsApp Instance is CONNECTED (state: open)`);
      store.setConnectionStatus('open');
      // Sync initial chats & messages
      await syncInitialChats();
    } else {
      console.log(`[EVOLUTION] Instance state is ${state || 'connecting'}, requesting connect QR...`);
      store.setConnectionStatus('connecting');
      const connectRes = await evolutionFetch(`/instance/connect/${inst}`);
      const qrData = connectRes.data?.base64 || connectRes.data?.code || connectRes.data?.qrcode?.base64 || '';
      if (qrData) {
        store.setConnectionStatus('connecting', qrData);
        console.log(`[EVOLUTION] QR code available for pairing`);
      }
    }
  } catch (err: any) {
    console.error('[EVOLUTION] Error initializing Evolution API:', err?.message);
  }
};

export const syncInitialChats = async () => {
  const inst = encodeURIComponent(config.evolution.instanceName);
  console.log(`[EVOLUTION] Syncing chats & messages for ${config.evolution.instanceName}...`);

  try {
    // 1. Fetch Chats: Try POST first, then GET
    let chatsRes = await evolutionFetch(`/chat/findChats/${inst}`, { method: 'POST', body: {} });
    if (!chatsRes.ok || !chatsRes.data) {
      chatsRes = await evolutionFetch(`/chat/findChats/${inst}`, { method: 'GET' });
    }

    const chatsList = Array.isArray(chatsRes.data)
      ? chatsRes.data
      : (chatsRes.data?.chats || chatsRes.data?.data || []);

    if (Array.isArray(chatsList) && chatsList.length > 0) {
      for (const item of chatsList) {
        if (!item || !item.id) continue;
        const jid = item.id;
        if (jid.includes('@broadcast') || jid.endsWith('newsletter')) continue;

        const isGroup = jid.includes('@g.us');
        const number = jid.split('@')[0];
        const name = item.name || item.displayName || item.pushName || item.subject || number;

        store.upsertChat({
          id: jid,
          name,
          number,
          isGroup,
          profilePicUrl: item.profilePictureUrl || item.profilePicUrl,
          unreadCount: item.unreadCount || 0,
          updatedAt: item.conversationTimestamp ? item.conversationTimestamp * 1000 : Date.now()
        });
      }
      console.log(`[EVOLUTION] Synced ${store.getChats().length} chats from /chat/findChats`);
    }

    // 2. Fetch Contacts to improve chat names and profile pictures
    let contactsRes = await evolutionFetch(`/contact/findContact/${inst}`, { method: 'POST', body: {} });
    if (!contactsRes.ok || !contactsRes.data) {
      contactsRes = await evolutionFetch(`/contact/findContact/${inst}`, { method: 'GET' });
    }
    const contactsList = Array.isArray(contactsRes.data)
      ? contactsRes.data
      : (contactsRes.data?.contacts || contactsRes.data?.data || []);

    if (Array.isArray(contactsList) && contactsList.length > 0) {
      for (const c of contactsList) {
        if (!c || !c.id) continue;
        const jid = c.id;
        const name = c.name || c.displayName || c.pushName;
        const pic = c.profilePictureUrl || c.profilePicUrl;
        if (name || pic) {
          store.upsertChat({
            id: jid,
            name: name || undefined,
            profilePicUrl: pic || undefined
          });
        }
      }
    }

    // 3. Fetch Recent Messages to populate chats and conversation threads
    const messagesRes = await evolutionFetch(`/chat/findMessages/${inst}`, {
      method: 'POST',
      body: { limit: 100 }
    });

    const messagesList = Array.isArray(messagesRes.data)
      ? messagesRes.data
      : (messagesRes.data?.messages || messagesRes.data?.data || []);

    if (Array.isArray(messagesList) && messagesList.length > 0) {
      console.log(`[EVOLUTION] Processing ${messagesList.length} recent messages...`);
      for (const m of messagesList) {
        if (!m || !m.key) continue;
        const remoteJid = m.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.endsWith('newsletter')) continue;

        const fromMe = Boolean(m.key.fromMe);
        const rawText =
          m.message?.conversation ||
          m.message?.extendedTextMessage?.text ||
          m.message?.imageMessage?.caption ||
          m.message?.videoMessage?.caption ||
          m.message?.documentMessage?.caption ||
          '';

        const msgType = m.message?.imageMessage
          ? 'image'
          : m.message?.videoMessage
          ? 'video'
          : m.message?.audioMessage
          ? 'audio'
          : m.message?.documentMessage
          ? 'document'
          : 'chat';

        const msgId = m.key.id || `hist_${Date.now()}`;
        const timestamp = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);

        let ack: MessageAck = fromMe ? 'delivered' : 'read';
        const rawStatus = m.status;
        if (rawStatus === 3 || rawStatus === 'READ') ack = 'read';
        else if (rawStatus === 2 || rawStatus === 'DELIVERED') ack = 'delivered';
        else if (rawStatus === 1 || rawStatus === 'SENT') ack = 'sent';

        const message: Message = {
          id: msgId,
          chatId: remoteJid,
          body: rawText || (msgType !== 'chat' ? `[${msgType}]` : ''),
          fromMe,
          timestamp,
          type: msgType,
          status: ack,
          senderName: m.pushName || undefined
        };

        store.addMessage(message);
      }
      console.log(`[EVOLUTION] Store now has ${store.getChats().length} chats after processing messages`);
    }
  } catch (err: any) {
    console.error('[EVOLUTION] Error syncing chats & messages:', err?.message);
  }
};

export const sendTextMessage = async (to: string, text: string, quotedId?: string): Promise<Message> => {
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

  const message: Message = {
    id: msgId,
    chatId: to.includes('@') ? to : `${destination}@s.whatsapp.net`,
    body: text,
    fromMe: true,
    timestamp,
    type: 'chat',
    status: res.ok ? 'sent' : 'pending',
    quotedMsgId: quotedId
  };

  store.addMessage(message);
  return message;
};

export const sendMediaMessage = async (
  to: string,
  mediaBase64: string,
  mimetype: string,
  fileName?: string,
  caption?: string
): Promise<Message> => {
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

  let type: Message['type'] = 'document';
  if (isAudio) type = 'audio';
  else if (mimetype.startsWith('image/')) type = 'image';
  else if (mimetype.startsWith('video/')) type = 'video';

  const message: Message = {
    id: msgId,
    chatId: to.includes('@') ? to : `${destination}@s.whatsapp.net`,
    body: caption || `[${type}]`,
    fromMe: true,
    timestamp,
    type,
    mediaUrl: `data:${mimetype};base64,${cleanBase64}`,
    mediaMime: mimetype,
    fileName: fileName || `file_${Date.now()}`,
    status: res.ok ? 'sent' : 'pending'
  };

  store.addMessage(message);
  return message;
};

export const markMessageAsRead = async (chatId: string) => {
  const inst = encodeURIComponent(config.evolution.instanceName);
  store.markChatRead(chatId);
  try {
    await evolutionFetch(`/chat/markMessageAsRead/${inst}`, {
      method: 'POST',
      body: {
        readMessages: [{ remoteJid: chatId }]
      }
    });
  } catch (err: any) {
    console.error(`[EVOLUTION] Error marking chat ${chatId} as read:`, err?.message);
  }
};

export const fetchProfilePicUrl = async (numberOrJid: string): Promise<string> => {
  const inst = encodeURIComponent(config.evolution.instanceName);
  const number = normalizePhoneNumber(numberOrJid.split('@')[0]);
  try {
    const res = await evolutionFetch(`/chat/fetchProfilePictureUrl/${inst}`, {
      method: 'POST',
      body: { number }
    });
    return res.data?.profilePictureUrl || '';
  } catch {
    return '';
  }
};
