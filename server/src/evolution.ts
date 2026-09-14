import { config } from './config';
import { store } from './store';
import { Chat, Message, MessageAck } from './types';

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

export const initEvolution = async () => {
  const inst = encodeURIComponent(config.evolution.instanceName);
  console.log(`[EVOLUTION] Connecting to Evolution API: ${config.evolution.apiUrl} (instance: ${config.evolution.instanceName})`);

  try {
    // 1. Check if instance exists
    const stateRes = await evolutionFetch(`/instance/connectionState/${inst}`);
    if (stateRes.status === 404 || !stateRes.ok) {
      console.log(`[EVOLUTION] Instance ${config.evolution.instanceName} not found, creating...`);
      await evolutionFetch('/instance/create', {
        method: 'POST',
        body: {
          instanceName: config.evolution.instanceName,
          token: config.evolution.apiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        }
      });
    }

    // 2. Configure Webhook
    const webhookUrl = `${config.backendUrl}/webhook`;
    console.log(`[EVOLUTION] Configuring Webhook to ${webhookUrl}`);
    await evolutionFetch(`/webhook/set/${inst}`, {
      method: 'POST',
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: [
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
          ]
        }
      }
    });

    // 3. Check State & Connect
    const connRes = await evolutionFetch(`/instance/connectionState/${inst}`);
    const state = connRes.data?.instance?.state || connRes.data?.state || '';
    if (state === 'open') {
      console.log(`[EVOLUTION] WhatsApp Instance is CONNECTED (state: open)`);
      store.setConnectionStatus('open');
      // Sync initial chats
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
  console.log(`[EVOLUTION] Syncing chats for ${config.evolution.instanceName}...`);
  try {
    const res = await evolutionFetch(`/chat/findChats/${inst}`);
    const list = Array.isArray(res.data) ? res.data : (res.data?.chats || res.data?.data || []);

    if (Array.isArray(list)) {
      for (const item of list) {
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
      console.log(`[EVOLUTION] Synced ${store.getChats().length} chats into memory`);
    }
  } catch (err: any) {
    console.error('[EVOLUTION] Error syncing chats:', err?.message);
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
