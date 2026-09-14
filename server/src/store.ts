import { Chat, Message, MessageAck, QuickNote } from './types';

class MemoryStore {
  private chats: Map<string, Chat> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private messageIndex: Map<string, Message> = new Map();
  private quickNotes: QuickNote[] = [
    {
      id: '1',
      title: 'Saludo Inicial',
      content: '¡Hola! Bienvenido a ANUBIS STORE. ¿En qué podemos ayudarte hoy?',
      category: 'General',
      createdAt: Date.now()
    },
    {
      id: '2',
      title: 'Horario de Atención',
      content: 'Nuestro horario de atención es de Lunes a Sábado de 9:00 AM a 6:00 PM.',
      category: 'Información',
      createdAt: Date.now()
    },
    {
      id: '3',
      title: 'Métodos de Pago',
      content: 'Aceptamos transferencias bancarias nacionales, Pago Móvil, Zelle y USDT Binance Pay.',
      category: 'Ventas',
      createdAt: Date.now()
    }
  ];

  public connectionStatus: 'open' | 'connecting' | 'close' = 'connecting';
  public qrCode: string = '';

  public clearInvalidChats() {
    for (const [id] of this.chats) {
      if (!id.includes('@')) {
        this.chats.delete(id);
      }
    }
  }

  public upsertChat(partialChat: Partial<Chat> & { id: string }): Chat {
    if (!partialChat.id.includes('@')) {
      return partialChat as Chat;
    }

    const existing = this.chats.get(partialChat.id);
    const userNumber = partialChat.id.split('@')[0];

    // Determine readable name: avoid cuid or empty names
    let name = partialChat.name || existing?.name;
    if (!name || name.length > 20 && !name.includes(' ') && !name.startsWith('+')) {
      name = userNumber;
    }

    const updated: Chat = {
      id: partialChat.id,
      name: name,
      number: partialChat.number || existing?.number || userNumber,
      isGroup: partialChat.isGroup ?? existing?.isGroup ?? partialChat.id.includes('@g.us'),
      profilePicUrl: partialChat.profilePicUrl || existing?.profilePicUrl,
      lastMessage: partialChat.lastMessage || existing?.lastMessage,
      unreadCount: partialChat.unreadCount !== undefined ? partialChat.unreadCount : (existing?.unreadCount || 0),
      updatedAt: partialChat.updatedAt || existing?.updatedAt || Date.now()
    };

    this.chats.set(partialChat.id, updated);
    return updated;
  }

  public addMessage(msg: Message): { message: Message; chat: Chat } {
    let chatMessages = this.messages.get(msg.chatId);
    if (!chatMessages) {
      chatMessages = [];
      this.messages.set(msg.chatId, chatMessages);
    }

    // Check if message already exists by ID
    const existingIndex = chatMessages.findIndex((m) => m.id === msg.id);
    if (existingIndex >= 0) {
      // Update existing message
      chatMessages[existingIndex] = { ...chatMessages[existingIndex], ...msg };
      this.messageIndex.set(msg.id, chatMessages[existingIndex]);
      msg = chatMessages[existingIndex];
    } else {
      chatMessages.push(msg);
      this.messageIndex.set(msg.id, msg);
    }

    // Sort messages by timestamp
    chatMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Update Chat info
    const existingChat = this.chats.get(msg.chatId);
    const unreadCount = !msg.fromMe ? (existingChat?.unreadCount || 0) + 1 : (existingChat?.unreadCount || 0);

    const chat = this.upsertChat({
      id: msg.chatId,
      name: existingChat?.name || msg.senderName || msg.chatId.split('@')[0],
      number: existingChat?.number || msg.chatId.split('@')[0],
      isGroup: msg.chatId.includes('@g.us'),
      lastMessage: {
        id: msg.id,
        body: msg.body || (msg.type !== 'chat' ? `[${msg.type}]` : ''),
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        status: msg.status,
        type: msg.type
      },
      unreadCount,
      updatedAt: msg.timestamp * 1000 > Date.now() ? Date.now() : msg.timestamp * 1000
    });

    return { message: msg, chat };
  }

  public updateMessageAck(messageId: string, status: MessageAck): { message: Message; chat?: Chat } | null {
    const msg = this.messageIndex.get(messageId);
    if (!msg) return null;

    msg.status = status;

    const chat = this.chats.get(msg.chatId);
    if (chat && chat.lastMessage && chat.lastMessage.id === messageId) {
      chat.lastMessage.status = status;
      this.chats.set(chat.id, chat);
    }

    return { message: msg, chat };
  }

  public markChatRead(chatId: string): Chat | null {
    const chat = this.chats.get(chatId);
    if (chat) {
      chat.unreadCount = 0;
      this.chats.set(chatId, chat);
      return chat;
    }
    return null;
  }

  public getChats(): Chat[] {
    this.clearInvalidChats();
    return Array.from(this.chats.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getMessages(chatId: string, limit = 50): Message[] {
    const chatMessages = this.messages.get(chatId) || [];
    if (limit <= 0) return chatMessages;
    return chatMessages.slice(-limit);
  }

  public getChat(chatId: string): Chat | undefined {
    return this.chats.get(chatId);
  }

  public setConnectionStatus(status: 'open' | 'connecting' | 'close', qrCode: string = '') {
    this.connectionStatus = status;
    if (qrCode) {
      this.qrCode = qrCode;
    } else if (status === 'open') {
      this.qrCode = '';
    }
  }

  public getNotes(): QuickNote[] {
    return this.quickNotes;
  }

  public saveNote(title: string, content: string, category: string = 'General'): QuickNote {
    const note: QuickNote = {
      id: `note_${Date.now()}`,
      title,
      content,
      category,
      createdAt: Date.now()
    };
    this.quickNotes.unshift(note);
    return note;
  }

  public deleteNote(id: string): boolean {
    const lenBefore = this.quickNotes.length;
    this.quickNotes = this.quickNotes.filter((n) => n.id !== id);
    return this.quickNotes.length < lenBefore;
  }
}

export const store = new MemoryStore();
