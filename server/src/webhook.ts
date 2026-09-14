import { Request, Response } from 'express';
import { store } from './store';
import { broadcastNewMessage, broadcastMessageAck, broadcastConnectionStatus } from './socket';
import { Message, MessageAck } from './types';
import { config } from './config';
import { evolutionFetch } from './evolution';

const unwrapMessage = (msg: any): any => {
  if (!msg) return msg;
  let unwrapped = msg;
  while (
    unwrapped &&
    (unwrapped.ephemeralMessage ||
      unwrapped.viewOnceMessage ||
      unwrapped.viewOnceMessageV2 ||
      unwrapped.documentWithCaptionMessage)
  ) {
    unwrapped =
      unwrapped.ephemeralMessage?.message ||
      unwrapped.viewOnceMessage?.message ||
      unwrapped.viewOnceMessageV2?.message ||
      unwrapped.documentWithCaptionMessage?.message ||
      unwrapped;
  }
  return unwrapped;
};

const getMessageBody = (rawMsg: any): string => {
  const msg = unwrapMessage(rawMsg);
  if (!msg) return '';
  if (typeof msg.conversation === 'string') return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption;
  if (msg.documentMessage?.fileName) return msg.documentMessage.fileName;
  if (msg.buttonsResponseMessage?.selectedDisplayText) return msg.buttonsResponseMessage.selectedDisplayText;
  if (msg.templateButtonReplyMessage?.selectedDisplayText) return msg.templateButtonReplyMessage.selectedDisplayText;
  if (msg.listResponseMessage?.title) return msg.listResponseMessage.title;
  return '';
};

const getMediaType = (rawMsg: any): Message['type'] => {
  const msg = unwrapMessage(rawMsg);
  if (!msg) return 'chat';
  if (msg.imageMessage) return 'image';
  if (msg.videoMessage) return 'video';
  if (msg.audioMessage) return 'audio';
  if (msg.documentMessage) return 'document';
  if (msg.stickerMessage) return 'sticker';
  if (msg.contactMessage) return 'vcard';
  if (msg.locationMessage) return 'location';
  return 'chat';
};

const parseAckStatus = (rawStatus: any): MessageAck => {
  if (rawStatus === 3 || rawStatus === 'READ' || rawStatus === 'READ_ACK' || rawStatus === 'VIEWED' || rawStatus === 4 || rawStatus === 'PLAYED') {
    return 'read';
  }
  if (rawStatus === 2 || rawStatus === 'DELIVERY_ACK' || rawStatus === 'DELIVERED' || rawStatus === 'RECEIPT') {
    return 'delivered';
  }
  if (rawStatus === 1 || rawStatus === 'SERVER_ACK' || rawStatus === 'SENT') {
    return 'sent';
  }
  return 'pending';
};

export const handleEvolutionWebhook = async (req: Request, res: Response) => {
  const payload = req.body;
  if (!payload || !payload.event) {
    return res.status(200).json({ received: true });
  }

  const eventName = String(payload.event).toUpperCase().replace(/\./g, '_');

  try {
    switch (eventName) {
      case 'QRCODE_UPDATED': {
        const qrData =
          payload.data?.qrcode?.base64 ||
          payload.data?.qrcode?.code ||
          payload.data?.base64 ||
          payload.data?.code ||
          '';

        if (qrData) {
          store.setConnectionStatus('connecting', qrData);
          broadcastConnectionStatus('connecting', qrData);
          console.log('[WEBHOOK] QR Code updated');
        }
        break;
      }

      case 'CONNECTION_UPDATE': {
        const state =
          payload.data?.state ||
          payload.data?.status ||
          payload.data?.connectionStatus ||
          '';

        if (state === 'open') {
          store.setConnectionStatus('open');
          broadcastConnectionStatus('open');
          console.log('[WEBHOOK] Instance CONNECTED (open)');
        } else if (state === 'close') {
          store.setConnectionStatus('close');
          broadcastConnectionStatus('close');
          console.log('[WEBHOOK] Instance DISCONNECTED (close)');
        } else if (state === 'connecting') {
          store.setConnectionStatus('connecting');
          broadcastConnectionStatus('connecting');
          console.log('[WEBHOOK] Instance CONNECTING');
        }
        break;
      }

      case 'MESSAGES_UPSERT':
      case 'MESSAGES_SET':
      case 'SEND_MESSAGE': {
        let rawMessages: any[] = [];
        if (Array.isArray(payload.data)) {
          rawMessages = payload.data;
        } else if (Array.isArray(payload.data?.messages)) {
          rawMessages = payload.data.messages;
        } else if (payload.data?.key || payload.data?.message) {
          rawMessages = [payload.data];
        } else if (payload.data) {
          rawMessages = [payload.data];
        }

        for (const rawMsg of rawMessages) {
          if (!rawMsg || !rawMsg.key) continue;

          const remoteJid = rawMsg.key.remoteJid || '';
          if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.endsWith('newsletter')) {
            continue;
          }

          const fromMe = Boolean(rawMsg.key.fromMe);
          const realMsg = unwrapMessage(rawMsg.message);
          const body = getMessageBody(realMsg);
          const mediaType = getMediaType(realMsg);
          const hasMedia = mediaType !== 'chat';

          // Extract quoted message stanza ID
          const quotedMsgId =
            realMsg?.extendedTextMessage?.contextInfo?.stanzaId ||
            realMsg?.imageMessage?.contextInfo?.stanzaId ||
            realMsg?.videoMessage?.contextInfo?.stanzaId ||
            realMsg?.audioMessage?.contextInfo?.stanzaId ||
            realMsg?.documentMessage?.contextInfo?.stanzaId;

          let mediaUrl: string | undefined;
          let mediaMime: string | undefined = rawMsg.mediaType;
          let fileName: string | undefined = rawMsg.mediaName;

          if (hasMedia) {
            let base64Data = payload.data?.base64 || rawMsg.base64 || rawMsg.media?.base64;
            if (!base64Data && rawMsg.key?.id) {
              // Try to fetch base64 from Evolution API
              try {
                const inst = encodeURIComponent(config.evolution.instanceName);
                const mediaRes = await evolutionFetch(`/chat/getBase64FromMediaMessage/${inst}`, {
                  method: 'POST',
                  body: { message: { key: { id: rawMsg.key.id } } }
                });
                if (mediaRes.ok && mediaRes.data?.base64) {
                  base64Data = mediaRes.data.base64;
                  if (mediaRes.data.fileName) fileName = mediaRes.data.fileName;
                  if (mediaRes.data.mimetype) mediaMime = mediaRes.data.mimetype;
                }
              } catch {}
            }

            if (base64Data) {
              const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
              if (!mediaMime) {
                if (mediaType === 'image') mediaMime = 'image/jpeg';
                else if (mediaType === 'audio') mediaMime = 'audio/ogg';
                else if (mediaType === 'video') mediaMime = 'video/mp4';
                else mediaMime = 'application/octet-stream';
              }
              mediaUrl = `data:${mediaMime};base64,${cleanBase64}`;
            }
          }

          const rawStatus = rawMsg.status ?? rawMsg.update?.status;
          let status: MessageAck = fromMe ? 'sent' : 'delivered';
          if (rawStatus !== undefined) {
            status = parseAckStatus(rawStatus);
          }

          const messageId = rawMsg.key.id || `msg_${Date.now()}`;
          const timestamp = Number(rawMsg.messageTimestamp) || Math.floor(Date.now() / 1000);
          const pushName = rawMsg.pushName || '';

          const message: Message = {
            id: messageId,
            chatId: remoteJid,
            body: body || (hasMedia ? `[${mediaType}]` : ''),
            fromMe,
            timestamp,
            type: mediaType,
            mediaUrl,
            mediaMime,
            fileName,
            status,
            quotedMsgId,
            senderName: pushName || undefined
          };

          const { message: savedMsg, chat } = store.addMessage(message);
          broadcastNewMessage(savedMsg, chat);
          console.log(`[WEBHOOK] Message received & broadcasted: ${message.id} (chat: ${remoteJid}, fromMe: ${fromMe})`);
        }
        break;
      }

      case 'MESSAGES_UPDATE': {
        let updates: any[] = [];
        if (Array.isArray(payload.data)) {
          updates = payload.data;
        } else if (Array.isArray(payload.data?.messages)) {
          updates = payload.data.messages;
        } else if (payload.data) {
          updates = [payload.data];
        }

        for (const item of updates) {
          if (!item) continue;
          const keyId = item.key?.id || item.id || item.keyId;
          const rawStatus = item.update?.status ?? item.status ?? item.receipt;
          if (keyId && rawStatus !== undefined) {
            const status = parseAckStatus(rawStatus);
            const result = store.updateMessageAck(keyId, status);
            if (result) {
              broadcastMessageAck(keyId, status, result.chat);
              console.log(`[WEBHOOK] Updated ACK for ${keyId} -> ${status}`);
            }
          }
        }
        break;
      }
    }
  } catch (err: any) {
    console.error('[WEBHOOK_ERR]', err?.message);
  }

  return res.status(200).json({ received: true });
};
