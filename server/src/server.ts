import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { store } from './store';
import { initWebSocket, broadcastNewMessage, broadcastChatUpdated } from './socket';
import { handleEvolutionWebhook } from './webhook';
import {
  initEvolution,
  sendTextMessage,
  sendMediaMessage,
  markMessageAsRead,
  evolutionFetch
} from './evolution';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  if (!req.path.startsWith('/public') && !req.path.endsWith('.js') && !req.path.endsWith('.png')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    instance: config.evolution.instanceName,
    connection: store.connectionStatus,
    chatsCount: store.getChats().length
  });
});

// Evolution Webhooks
app.post('/webhook', handleEvolutionWebhook);
app.post('/evolution-webhook/:sessionId?', handleEvolutionWebhook);

// REST APIs
// 1. Connection status & QR Code
app.get('/api/status', (req, res) => {
  res.json({
    status: store.connectionStatus,
    qrCode: store.qrCode,
    instance: config.evolution.instanceName
  });
});

// 2. Chats list
app.get('/api/chats', (req, res) => {
  res.json(store.getChats());
});

// 3. Messages for a chat
app.get('/api/chats/:jid/messages', async (req, res) => {
  const { jid } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  let messages = store.getMessages(jid, limit);

  // If store has no messages for this chat, attempt to fetch from Evolution API
  if (messages.length === 0) {
    try {
      const inst = encodeURIComponent(config.evolution.instanceName);
      const evoRes = await evolutionFetch(`/chat/findMessages/${inst}`, {
        method: 'POST',
        body: {
          where: {
            key: { remoteJid: jid }
          },
          limit: 30
        }
      });

      const fetchedList = Array.isArray(evoRes.data)
        ? evoRes.data
        : evoRes.data?.messages || [];

      if (Array.isArray(fetchedList)) {
        for (const item of fetchedList) {
          if (!item || !item.key) continue;
          const msgId = item.key.id || `hist_${Date.now()}`;
          const fromMe = Boolean(item.key.fromMe);
          const rawText =
            item.message?.conversation ||
            item.message?.extendedTextMessage?.text ||
            item.message?.imageMessage?.caption ||
            '';

          store.addMessage({
            id: msgId,
            chatId: jid,
            body: rawText,
            fromMe,
            timestamp: Number(item.messageTimestamp) || Math.floor(Date.now() / 1000),
            type: item.message?.imageMessage ? 'image' : (item.message?.audioMessage ? 'audio' : 'chat'),
            status: fromMe ? 'delivered' : 'read'
          });
        }
        messages = store.getMessages(jid, limit);
      }
    } catch (err: any) {
      console.error(`[MESSAGES_FETCH_ERR] Chat ${jid}:`, err?.message);
    }
  }

  res.json(messages);
});

// 4. Send text message
app.post('/api/messages/send', async (req, res) => {
  const { chatId, text, quotedMsgId } = req.body;
  if (!chatId || !text) {
    return res.status(400).json({ error: 'chatId and text are required' });
  }

  try {
    const message = await sendTextMessage(chatId, text, quotedMsgId);
    const chat = store.getChat(chatId);
    if (chat) {
      broadcastNewMessage(message, chat);
    }
    return res.json({ success: true, message });
  } catch (err: any) {
    console.error('[SEND_TEXT_ERR]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to send message' });
  }
});

// 5. Send media message
app.post('/api/messages/send-media', async (req, res) => {
  const { chatId, mediaBase64, mimetype, fileName, caption } = req.body;
  if (!chatId || !mediaBase64 || !mimetype) {
    return res.status(400).json({ error: 'chatId, mediaBase64 and mimetype are required' });
  }

  try {
    const message = await sendMediaMessage(chatId, mediaBase64, mimetype, fileName, caption);
    const chat = store.getChat(chatId);
    if (chat) {
      broadcastNewMessage(message, chat);
    }
    return res.json({ success: true, message });
  } catch (err: any) {
    console.error('[SEND_MEDIA_ERR]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to send media' });
  }
});

// 6. Mark chat as read
app.post('/api/chats/:jid/read', async (req, res) => {
  const { jid } = req.params;
  await markMessageAsRead(jid);
  const updatedChat = store.getChat(jid);
  if (updatedChat) {
    broadcastChatUpdated(updatedChat);
  }
  res.json({ success: true });
});

// 7. Quick notes APIs
app.get('/api/notes', (req, res) => {
  res.json(store.getNotes());
});

app.post('/api/notes', (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  const note = store.saveNote(title, content, category);
  res.json(note);
});

app.delete('/api/notes/:id', (req, res) => {
  const { id } = req.params;
  const deleted = store.deleteNote(id);
  res.json({ success: deleted });
});

// Static assets: serve Flutter Web app
const flutterBuildPath = path.join(__dirname, '../public');
const localFlutterPath = path.join(__dirname, '../../flutter_app/build/web');
const staticPath = fs.existsSync(flutterBuildPath)
  ? flutterBuildPath
  : (fs.existsSync(localFlutterPath) ? localFlutterPath : null);

if (staticPath) {
  console.log(`[STATIC] Serving Flutter web app from: ${staticPath}`);
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // Fallback landing page if frontend build is not yet present
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Anubis WhatsApp Gateway</title>
          <meta charset="utf-8">
          <style>
            body { background: #0b141a; color: #e9edef; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { background: #111b21; padding: 40px; border-radius: 12px; text-align: center; max-width: 480px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
            h1 { color: #00a884; margin-bottom: 12px; }
            p { color: #8696a0; line-height: 1.5; }
            .status { margin-top: 20px; padding: 12px; background: #202c33; border-radius: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Anubis WhatsApp Gateway</h1>
            <p>El backend y WebSocket bridge están operativos.</p>
            <div class="status">Instancia Evolution: ${config.evolution.instanceName}</div>
          </div>
        </body>
      </html>
    `);
  });
}

// Initialize WebSocket
initWebSocket(server);

// Start server
server.listen(config.port, async () => {
  console.log(`[SERVER] Anubis WhatsApp Gateway listening on port ${config.port}`);
  // Initialize Evolution API
  await initEvolution();
});
