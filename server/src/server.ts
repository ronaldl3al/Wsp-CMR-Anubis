import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { config } from './config';
import * as db from './db';
import * as evolution from './evolution';
import * as socket from './socket';
import { handleEvolutionWebhook } from './webhook';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
socket.initSocket(server);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// Silence legacy /ws reconnection requests from older client tabs
app.all('/ws', (req, res) => {
  res.status(200).send('OK');
});

// Health check endpoint (for Railway)
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    service: 'Wsp-CMR-Anubis',
    time: new Date().toISOString()
  });
});

// Connection state with Evolution API
app.get('/api/connection-status', async (req, res) => {
  try {
    const status = await evolution.checkConnectionStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Chats
app.get('/api/chats', async (req, res) => {
  try {
    const chats = await db.getChats();
    res.json(chats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chats/:jid', async (req, res) => {
  try {
    const chat = await db.getChat(req.params.jid);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chats/:jid/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const messages = await db.getMessages(req.params.jid, limit);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats/:jid/read', async (req, res) => {
  try {
    await evolution.markChatRead(req.params.jid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats/:jid/sync-messages', async (req, res) => {
  try {
    const messages = await evolution.syncChatMessages(req.params.jid);
    res.json({ success: true, count: messages.length, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Outbound Messaging
app.post('/api/messages/send-text', async (req, res) => {
  try {
    const { to, text, quotedId } = req.body;
    if (!to || !text) {
      return res.status(400).json({ error: 'Missing to or text' });
    }
    const message = await evolution.sendTextMessage(to, text, quotedId);
    res.json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/send-media', upload.single('file'), async (req, res) => {
  try {
    const to = req.body.to;
    const caption = req.body.caption || '';
    let mediaBase64 = req.body.mediaBase64;
    let mimetype = req.body.mimetype;
    let fileName = req.body.fileName;

    if (req.file) {
      mediaBase64 = req.file.buffer.toString('base64');
      mimetype = req.file.mimetype;
      fileName = req.file.originalname;
    }

    if (!to || !mediaBase64 || !mimetype) {
      return res.status(400).json({ error: 'Missing to, media or mimetype' });
    }

    const message = await evolution.sendMediaMessage(to, mediaBase64, mimetype, fileName, caption);
    res.json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await db.getContacts();
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/sync', async (req, res) => {
  try {
    const result = await evolution.syncContacts();
    res.json({ success: true, count: result.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats/sync', async (req, res) => {
  try {
    await evolution.syncRecentChats();
    const chats = await db.getChats();
    res.json({ success: true, chats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Quick Notes / Canned Responses
app.get('/api/quick-notes', async (req, res) => {
  try {
    const notes = await db.getQuickNotes();
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quick-notes', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const note = await db.createQuickNote(title, content, category || 'General');
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/quick-notes/:id', async (req, res) => {
  try {
    const success = await db.deleteQuickNote(parseInt(req.params.id, 10));
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook from Evolution API
app.post('/api/webhook/evolution', handleEvolutionWebhook);
app.post('/webhook/evolution', handleEvolutionWebhook);

// Serve static frontend assets
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Wsp-CMR-Anubis server running. Client building...');
    }
  });
});

// Start Server
async function start() {
  try {
    await db.initDatabase();
    console.log('[DB] PostgreSQL connected and initialized successfully.');

    // Auto-sync initial contacts and chats in background safely
    evolution.syncContacts().catch((e) => console.error('[INIT] Initial contact sync error:', e.message));
    evolution.syncRecentChats().catch((e) => console.error('[INIT] Initial chat sync error:', e.message));

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`[SERVER] WhatsApp Web Server running on port ${config.port}`);
    });
  } catch (err: any) {
    console.error('[FATAL] Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
