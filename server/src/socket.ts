import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { store } from './store';
import { Chat, Message, MessageAck } from './types';

let wss: WebSocketServer | null = null;

export const initWebSocket = (server: HttpServer) => {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] New Flutter client connected');

    // Send initial connection status
    ws.send(
      JSON.stringify({
        event: 'connection_status',
        data: {
          status: store.connectionStatus,
          qrCode: store.qrCode
        }
      })
    );

    // Send initial chats
    ws.send(
      JSON.stringify({
        event: 'chats_init',
        data: store.getChats()
      })
    );

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.action === 'ping') {
          ws.send(JSON.stringify({ event: 'pong', data: Date.now() }));
        }
      } catch {}
    });

    ws.on('close', () => {
      console.log('[WS] Flutter client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  console.log('[WS] WebSocket server initialized on path /ws');
};

export const broadcast = (event: string, data: any) => {
  if (!wss) return;
  const payload = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

export const broadcastNewMessage = (message: Message, chat: Chat) => {
  broadcast('new_message', { message, chat });
};

export const broadcastMessageAck = (messageId: string, status: MessageAck, chat?: Chat) => {
  broadcast('message_ack', { messageId, status, chat });
};

export const broadcastChatUpdated = (chat: Chat) => {
  broadcast('chat_updated', chat);
};

export const broadcastConnectionStatus = (status: 'open' | 'connecting' | 'close', qrCode: string = '') => {
  broadcast('connection_status', { status, qrCode });
};
