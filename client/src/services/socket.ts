import { io, Socket } from 'socket.io-client';
import { Message, Chat, MessageAck } from '../types';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to real-time server');
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from server');
    });
  }
  return socket;
}

export function subscribeToMessages(
  onNewMessage: (data: { message: Message; chat: Chat }) => void,
  onMessageAck: (data: { messageId: string; status: MessageAck; chatJid?: string }) => void,
  onStatusChange: (data: { status: 'open' | 'connecting' | 'close' }) => void,
  onMessageEdited?: (message: Message) => void,
  onMessageDeleted?: (data: { messageId: string; chatJid: string }) => void,
  onMessagePinned?: (message: Message) => void
) {
  const s = getSocket();

  s.on('message:new', onNewMessage);
  s.on('message:ack', onMessageAck);
  s.on('connection:status', onStatusChange);
  if (onMessageEdited) s.on('message:edited', onMessageEdited);
  if (onMessageDeleted) s.on('message:deleted', onMessageDeleted);
  if (onMessagePinned) s.on('message:pinned', onMessagePinned);

  return () => {
    s.off('message:new', onNewMessage);
    s.off('message:ack', onMessageAck);
    s.off('connection:status', onStatusChange);
    if (onMessageEdited) s.off('message:edited', onMessageEdited);
    if (onMessageDeleted) s.off('message:deleted', onMessageDeleted);
    if (onMessagePinned) s.off('message:pinned', onMessagePinned);
  };
}

export function joinChatRoom(chatJid: string) {
  const s = getSocket();
  s.emit('joinChat', chatJid);
}

export function leaveChatRoom(chatJid: string) {
  const s = getSocket();
  s.emit('leaveChat', chatJid);
}
