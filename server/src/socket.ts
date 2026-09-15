import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Message, Chat, MessageAck } from './types';

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    socket.on('joinChat', (chatJid: string) => {
      socket.join(chatJid);
      console.log(`[SOCKET] ${socket.id} joined room: ${chatJid}`);
    });

    socket.on('leaveChat', (chatJid: string) => {
      socket.leave(chatJid);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastNewMessage(message: Message, chat: Chat) {
  if (!io) return;
  // Emit to all clients (for chat list preview & counter)
  io.emit('message:new', { message, chat });
  // Emit specifically to the active chat room
  io.to(message.chat_jid).emit('message:chat', message);
}

export function broadcastMessageUpdate(messageId: string, status: MessageAck, chatJid?: string) {
  if (!io) return;
  io.emit('message:ack', { messageId, status, chatJid });
}

export function broadcastChatUpdate(chat: Chat) {
  if (!io) return;
  io.emit('chat:update', chat);
}

export function broadcastConnectionStatus(status: 'open' | 'connecting' | 'close') {
  if (!io) return;
  io.emit('connection:status', { status });
}
