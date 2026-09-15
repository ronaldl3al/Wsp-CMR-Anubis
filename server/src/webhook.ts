import { Request, Response } from 'express';
import * as db from './db';
import * as socket from './socket';
import { Message, MessageAck, MessageType } from './types';

export async function handleEvolutionWebhook(req: Request, res: Response) {
  // Respond immediately 200 to Evolution API
  res.status(200).json({ status: 'ok' });

  try {
    const payload = req.body;
    if (!payload || !payload.event) return;

    const event = payload.event.toUpperCase();
    const data = payload.data;

    if (!data) return;

    // 1. New or Updated Incoming/Outgoing Message
    if (event === 'MESSAGES_UPSERT' || event === 'SEND_MESSAGE') {
      const key = data.key;
      if (!key) return;

      const remoteJid = key.remoteJid;
      if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.endsWith('newsletter')) return;

      const fromMe = Boolean(key.fromMe);
      const msgId = key.id;
      if (!msgId) return;

      const msgObj = data.message || {};
      const pushName = data.pushName || undefined;

      // Extract text content
      const text =
        msgObj.conversation ||
        msgObj.extendedTextMessage?.text ||
        msgObj.imageMessage?.caption ||
        msgObj.videoMessage?.caption ||
        msgObj.documentMessage?.caption ||
        '';

      // Determine type
      let type: MessageType = 'chat';
      let mediaUrl: string | undefined = undefined;
      let mediaMimetype: string | undefined = undefined;
      let mediaFilename: string | undefined = undefined;

      if (msgObj.imageMessage) {
        type = 'image';
        mediaMimetype = msgObj.imageMessage.mimetype || 'image/jpeg';
        mediaUrl = msgObj.imageMessage.url || data.mediaUrl || data.base64;
      } else if (msgObj.videoMessage) {
        type = 'video';
        mediaMimetype = msgObj.videoMessage.mimetype || 'video/mp4';
        mediaUrl = msgObj.videoMessage.url || data.mediaUrl || data.base64;
      } else if (msgObj.audioMessage) {
        type = 'audio';
        mediaMimetype = msgObj.audioMessage.mimetype || 'audio/ogg';
        mediaUrl = msgObj.audioMessage.url || data.mediaUrl || data.base64;
      } else if (msgObj.documentMessage) {
        type = 'document';
        mediaMimetype = msgObj.documentMessage.mimetype || 'application/octet-stream';
        mediaFilename = msgObj.documentMessage.fileName;
        mediaUrl = msgObj.documentMessage.url || data.mediaUrl || data.base64;
      } else if (msgObj.stickerMessage) {
        type = 'sticker';
        mediaMimetype = msgObj.stickerMessage.mimetype || 'image/webp';
        mediaUrl = msgObj.stickerMessage.url || data.mediaUrl || data.base64;
      }

      // If base64 was passed directly
      if (data.base64 && !mediaUrl) {
        mediaUrl = `data:${mediaMimetype || 'application/octet-stream'};base64,${data.base64}`;
      }

      const timestamp = Number(data.messageTimestamp) || Math.floor(Date.now() / 1000);
      const status: MessageAck = fromMe ? 'sent' : 'delivered';

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
        status,
        timestamp
      };

      const { message: savedMsg, chat: updatedChat } = await db.addMessage(message);
      socket.broadcastNewMessage(savedMsg, updatedChat);
    }

    // 2. Message ACK Status Update (Delivered / Read)
    else if (event === 'MESSAGES_UPDATE') {
      const updates = Array.isArray(data) ? data : [data];
      for (const item of updates) {
        const key = item.key || {};
        const msgId = key.id;
        const rawStatus = item.update?.status || item.status;

        if (!msgId || rawStatus === undefined) continue;

        let ack: MessageAck = 'sent';
        if (rawStatus === 3 || rawStatus === 'READ') ack = 'read';
        else if (rawStatus === 2 || rawStatus === 'DELIVERED') ack = 'delivered';
        else if (rawStatus === 1 || rawStatus === 'SENT') ack = 'sent';

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
