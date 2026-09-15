import { Request, Response } from 'express';
import * as db from './db';
import * as socket from './socket';
import * as evolution from './evolution';
import { Message, MessageAck, MessageType } from './types';

function unwrapMessage(msg: any): any {
  if (!msg) return {};
  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);
  return msg;
}

export async function handleEvolutionWebhook(req: Request, res: Response) {
  // Respond immediately 200 to Evolution API
  res.status(200).json({ status: 'ok' });

  try {
    const payload = req.body;
    if (!payload || !payload.event) return;

    // Normalize event: handles both "messages.upsert" and "MESSAGES_UPSERT"
    const rawEvent = String(payload.event);
    const event = rawEvent.replace(/\./g, '_').toUpperCase();
    console.log(`[WEBHOOK] Incoming event: ${rawEvent} -> Normalized: ${event}`);

    const data = payload.data;
    if (!data) return;

    // 1. New or Updated Incoming/Outgoing Message
    if (event === 'MESSAGES_UPSERT' || event === 'SEND_MESSAGE') {
      let messagesList: any[] = [];
      if (Array.isArray(data)) {
        messagesList = data;
      } else if (Array.isArray(data.messages)) {
        messagesList = data.messages;
      } else if (data.key) {
        messagesList = [data];
      } else if (data) {
        messagesList = [data];
      }

      for (const item of messagesList) {
        if (!item || !item.key) continue;

        const key = item.key;
        const remoteJid = key.remoteJid;
        if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.endsWith('newsletter')) continue;

        const fromMe = Boolean(key.fromMe);
        const msgId = key.id;
        if (!msgId) continue;

        const rawMsg = item.message || {};
        const msgObj = unwrapMessage(rawMsg);
        const pushName = item.pushName || undefined;

        // Extract text content
        const text =
          msgObj.conversation ||
          msgObj.extendedTextMessage?.text ||
          msgObj.imageMessage?.caption ||
          msgObj.videoMessage?.caption ||
          msgObj.documentMessage?.caption ||
          '';

        // Determine type and media
        let type: MessageType = 'chat';
        let mediaUrl: string | undefined = undefined;
        let mediaMimetype: string | undefined = undefined;
        let mediaFilename: string | undefined = undefined;

        if (msgObj.imageMessage) {
          type = 'image';
          mediaMimetype = msgObj.imageMessage.mimetype || 'image/jpeg';
          mediaUrl = item.base64 || data.base64 ? `data:${mediaMimetype};base64,${item.base64 || data.base64}` : msgObj.imageMessage.url;
        } else if (msgObj.videoMessage) {
          type = 'video';
          mediaMimetype = msgObj.videoMessage.mimetype || 'video/mp4';
          mediaUrl = item.base64 || data.base64 ? `data:${mediaMimetype};base64,${item.base64 || data.base64}` : msgObj.videoMessage.url;
        } else if (msgObj.audioMessage) {
          type = 'audio';
          mediaMimetype = msgObj.audioMessage.mimetype || 'audio/ogg';
          mediaUrl = item.base64 || data.base64 ? `data:${mediaMimetype};base64,${item.base64 || data.base64}` : msgObj.audioMessage.url;
        } else if (msgObj.documentMessage) {
          type = 'document';
          mediaMimetype = msgObj.documentMessage.mimetype || 'application/octet-stream';
          mediaFilename = msgObj.documentMessage.fileName;
          mediaUrl = item.base64 || data.base64 ? `data:${mediaMimetype};base64,${item.base64 || data.base64}` : msgObj.documentMessage.url;
        } else if (msgObj.stickerMessage) {
          type = 'sticker';
          mediaMimetype = msgObj.stickerMessage.mimetype || 'image/webp';
          mediaUrl = item.base64 || data.base64 ? `data:${mediaMimetype};base64,${item.base64 || data.base64}` : msgObj.stickerMessage.url;
        }

        // If mediaUrl is missing or points to WhatsApp encrypted MMG servers, fetch decrypted base64
        if (type !== 'chat' && (!mediaUrl || mediaUrl.includes('mmg.whatsapp.net') || mediaUrl.includes('.enc'))) {
          try {
            const decrypted = await evolution.getBase64FromMedia(msgId);
            if (decrypted?.base64) {
              mediaUrl = `data:${decrypted.mimetype || mediaMimetype || 'image/jpeg'};base64,${decrypted.base64}`;
            }
          } catch (e: any) {
            console.error('[WEBHOOK] Failed to decrypt media in webhook:', e.message);
          }
        }

        const timestamp = Number(item.messageTimestamp) || Math.floor(Date.now() / 1000);
        const status: MessageAck = fromMe ? 'sent' : 'delivered';

        const contextInfo =
          msgObj.extendedTextMessage?.contextInfo ||
          msgObj.imageMessage?.contextInfo ||
          msgObj.videoMessage?.contextInfo ||
          msgObj.audioMessage?.contextInfo ||
          msgObj.documentMessage?.contextInfo;
        const quotedId = contextInfo?.stanzaId;

        const message: Message = {
          id: msgId,
          chat_jid: remoteJid,
          sender_jid: key.participant || remoteJid,
          sender_name: pushName,
          from_me: fromMe,
          body: text || (type !== 'chat' ? `[${type}]` : ''),
          type,
          media_url: mediaUrl,
          media_mimetype: mediaMimetype,
          media_filename: mediaFilename,
          quoted_id: quotedId,
          status,
          timestamp
        };

        console.log(`[WEBHOOK] Saving and broadcasting message ${msgId} from ${remoteJid} (fromMe: ${fromMe})`);
        const { message: savedMsg, chat: updatedChat } = await db.addMessage(message);
        socket.broadcastNewMessage(savedMsg, updatedChat);
      }
    }

    // 2. Message ACK Status Update (Delivered / Read)
    else if (event === 'MESSAGES_UPDATE') {
      let updates: any[] = [];
      if (Array.isArray(data)) {
        updates = data;
      } else if (Array.isArray(data.messages)) {
        updates = data.messages;
      } else if (data) {
        updates = [data];
      }

      for (const item of updates) {
        if (!item) continue;
        const key = item.key || {};
        const msgId = key.id || item.id;
        const rawStatus = item.update?.status ?? item.status;

        if (!msgId || rawStatus === undefined) continue;

        let ack: MessageAck = 'sent';
        const strStatus = String(rawStatus).toUpperCase();
        if (rawStatus === 3 || rawStatus === 4 || strStatus === 'READ' || strStatus === 'PLAYED') ack = 'read';
        else if (rawStatus === 2 || strStatus === 'DELIVERED' || strStatus === 'DELIVERY_ACK') ack = 'delivered';
        else if (rawStatus === 1 || strStatus === 'SENT' || strStatus === 'SERVER_ACK') ack = 'sent';

        console.log(`[WEBHOOK] Updating status for message ${msgId} -> ${ack}`);
        const updated = await db.updateMessageStatus(msgId, ack);
        if (updated) {
          socket.broadcastMessageUpdate(msgId, ack, key.remoteJid);
        }
      }
    }

    // 3. Contacts Update
    else if (event === 'CONTACTS_UPSERT') {
      const contacts = Array.isArray(data) ? data : [data];
      for (const c of contacts) {
        const jid = c.remoteJid || c.id;
        if (!jid || !jid.includes('@')) continue;

        const name = c.name || c.pushName;
        const pic = c.profilePictureUrl || c.profilePicUrl;
        const number = jid.split('@')[0].replace(/\D/g, '');

        await db.upsertContact({
          jid,
          name: c.name || undefined,
          push_name: c.pushName || undefined,
          number,
          profile_pic_url: pic || undefined,
          is_saved: Boolean(c.name)
        });
      }
    }

    // 4. Connection State Update
    else if (event === 'CONNECTION_UPDATE') {
      const state = data.state;
      if (state === 'open' || state === 'connecting' || state === 'close') {
        socket.broadcastConnectionStatus(state);
      }
    }
  } catch (err: any) {
    console.error('[WEBHOOK] Error processing Evolution webhook:', err.message);
  }
}
