import React, { useState, useEffect, useCallback } from 'react';
import { NavigationRail, NavTab } from './components/NavigationRail';
import { Sidebar } from './components/Sidebar';
import { ContactsPanel } from './components/ContactsPanel';
import { ChatArea } from './components/ChatArea';
import { ContactsModal } from './components/ContactsModal';
import { QuickNotesDrawer } from './components/QuickNotesDrawer';
import { NewChatModal } from './components/NewChatModal';
import { MediaModal } from './components/MediaModal';
import { ThemeModal } from './components/ThemeModal';
import { Chat, Message, Contact, QuickNote, MessageAck } from './types';
import * as api from './services/api';
import * as socketService from './services/socket';
import { getSavedTheme, applyTheme } from './utils/theme';

export const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([]);

  // Navigation tab: 'chats' or 'contacts'
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('chats');

  // Modals state
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isQuickNotesOpen, setIsQuickNotesOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [mediaModalData, setMediaModalData] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Connection & Sync state
  const [connectionState, setConnectionState] = useState<'open' | 'connecting' | 'close'>('connecting');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);

  // Apply saved theme on startup
  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [conn, chatList, contactList, notes] = await Promise.all([
          api.fetchConnectionStatus().catch(() => ({ state: 'connecting' })),
          api.fetchChats().catch(() => []),
          api.fetchContacts().catch(() => []),
          api.fetchQuickNotes().catch(() => [])
        ]);

        setConnectionState(conn.state as any);
        setChats(chatList);
        setContacts(contactList);
        setQuickNotes(notes);

        if (chatList.length > 0 && !selectedChat) {
          handleSelectChat(chatList[0]);
        }
      } catch (err) {
        console.error('[APP] Error loading initial data:', err);
      }
    };

    loadData();
  }, []);

  // Real-time WebSocket Listeners
  useEffect(() => {
    const unsubscribe = socketService.subscribeToMessages(
      // On new message
      ({ message, chat }) => {
        // Update messages list if current active chat
        if (selectedChat && message.chat_jid === selectedChat.jid) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
          // Automatically mark read if we are looking at this chat
          api.markChatRead(selectedChat.jid).catch(console.error);
        }

        // Update chats list (bump to top)
        setChats((prev) => {
          const filtered = prev.filter((c) => c.jid !== chat.jid);
          const unread = (selectedChat && selectedChat.jid === chat.jid) ? 0 : chat.unread_count;
          return [{ ...chat, unread_count: unread }, ...filtered];
        });
      },

      // On message ack (status checkmarks)
      ({ messageId, status, chatJid }) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status } : m))
        );

        if (chatJid) {
          setChats((prev) =>
            prev.map((c) =>
              c.jid === chatJid ? { ...c, last_message_status: status } : c
            )
          );
        }
      },

      // On connection state change
      ({ status }) => {
        setConnectionState(status);
      },

      // On message edited
      (editedMsg) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === editedMsg.id ? { ...m, ...editedMsg } : m))
        );
      },

      // On message deleted
      ({ messageId }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, is_deleted: true, body: '🚫 Este mensaje fue eliminado' }
              : m
          )
        );
      },

      // On message pinned
      (pinnedMsg) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === pinnedMsg.id ? { ...m, is_pinned: pinnedMsg.is_pinned } : m))
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedChat]);

  // Select Chat
  const handleSelectChat = async (chat: Chat) => {
    if (selectedChat?.jid) {
      socketService.leaveChatRoom(selectedChat.jid);
    }

    setSelectedChat(chat);
    socketService.joinChatRoom(chat.jid);

    // Optimistically reset unread count in UI
    setChats((prev) =>
      prev.map((c) => (c.jid === chat.jid ? { ...c, unread_count: 0 } : c))
    );

    try {
      const chatMessages = await api.fetchMessages(chat.jid);
      setMessages(chatMessages);
      api.markChatRead(chat.jid).catch(console.error);
    } catch (err) {
      console.error('[APP] Error fetching messages:', err);
    }
  };

  // Send Text Message
  const handleSendMessage = async (text: string) => {
    if (!selectedChat) return;

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      chat_jid: selectedChat.jid,
      from_me: true,
      body: text,
      type: 'chat',
      status: 'pending',
      timestamp: Math.floor(Date.now() / 1000)
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const sentMsg = await api.sendTextMessage(selectedChat.jid, text);
      // Replace optimistic message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? sentMsg : m))
      );
    } catch (err) {
      console.error('[APP] Error sending text message:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // Send Media Message (Images, Audio Voice Notes, Video, Docs)
  const handleSendMedia = async (file: File, caption?: string) => {
    if (!selectedChat) return;

    try {
      const sentMsg = await api.sendMediaMessage(selectedChat.jid, file, caption);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err: any) {
      console.error('[APP] Error sending media:', err);
      alert(`Error al enviar archivo: ${err.message || 'Verifica el tamaño'}`);
    }
  };

  // Sync History for the active chat on demand
  const handleSyncChatHistory = async () => {
    if (!selectedChat) return;
    setIsSyncingHistory(true);
    try {
      const res = await api.syncChatMessages(selectedChat.jid);
      const updatedMessages = await api.fetchMessages(selectedChat.jid);
      setMessages(updatedMessages);
    } catch (err: any) {
      console.error('[APP] Error syncing chat messages:', err);
      alert('No se encontraron más mensajes previos para este chat.');
    } finally {
      setIsSyncingHistory(false);
    }
  };

  // Sync Contacts from WhatsApp Address Book
  const handleSyncContacts = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncContacts();
      const updatedContacts = await api.fetchContacts();
      setContacts(updatedContacts);
      const updatedChats = await api.fetchChats();
      setChats(updatedChats);
      alert(`¡Sincronización completada! Se han actualizado ${res.count} contactos registrados.`);
    } catch (err: any) {
      alert(`Error al sincronizar contactos: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Start chat from phone or contacts modal
  const handleStartChatWithContact = (contact: Contact) => {
    const existing = chats.find((c) => c.jid === contact.jid);
    if (existing) {
      handleSelectChat(existing);
    } else {
      const newChat: Chat = {
        jid: contact.jid,
        name: contact.number,
        number: contact.number,
        is_group: contact.jid.includes('@g.us'),
        unread_count: 0,
        profile_pic_url: contact.profile_pic_url
      };
      setChats((prev) => [newChat, ...prev]);
      handleSelectChat(newChat);
    }
  };

  const handleStartChatWithNumber = async (numberOrJid: string, initialMessage?: string) => {
    const jid = numberOrJid.includes('@') ? numberOrJid : `${numberOrJid}@s.whatsapp.net`;
    const number = jid.split('@')[0];

    const newChat: Chat = {
      jid,
      name: number,
      number,
      is_group: false,
      unread_count: 0
    };

    setChats((prev) => {
      if (prev.some((c) => c.jid === jid)) return prev;
      return [newChat, ...prev];
    });

    handleSelectChat(newChat);

    if (initialMessage) {
      await api.sendTextMessage(jid, initialMessage);
    }
  };

  // Quick Notes handlers
  const handleCreateNote = async (title: string, content: string, category?: string) => {
    const note = await api.createQuickNote(title, content, category);
    setQuickNotes((prev) => [...prev, note]);
  };

  const handleDeleteNote = async (id: number) => {
    await api.deleteQuickNote(id);
    setQuickNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleInsertNote = (content: string) => {
    handleSendMessage(content);
  };

  // Message Actions (Edit, Delete, Pin)
  const handleUpdateMessage = async (messageId: string, newText: string) => {
    if (!selectedChat) return;
    try {
      const updated = await api.updateMessage(selectedChat.jid, messageId, newText);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err: any) {
      console.error('[APP] Error editing message:', err);
      alert('Error al editar mensaje: ' + err.message);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) return;
    try {
      await api.deleteMessage(selectedChat.jid, messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, body: '🚫 Este mensaje fue eliminado' }
            : m
        )
      );
    } catch (err: any) {
      console.error('[APP] Error deleting message:', err);
      alert('Error al eliminar mensaje: ' + err.message);
    }
  };

  const handleTogglePin = async (messageId: string, pinned?: boolean) => {
    if (!selectedChat) return;
    try {
      const updated = await api.togglePinMessage(selectedChat.jid, messageId, pinned);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err: any) {
      console.error('[APP] Error pinning message:', err);
    }
  };

  const totalUnreadCount = chats.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111b21] text-[#e9edef]">
      {/* 1. Leftmost Navigation Rail */}
      <NavigationRail
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        onOpenQuickNotes={() => setIsQuickNotesOpen(true)}
        onSyncContacts={handleSyncContacts}
        onOpenThemeModal={() => setIsThemeOpen(true)}
        isSyncing={isSyncing}
        totalUnreadCount={totalUnreadCount}
        connectionState={connectionState}
      />

      {/* 2. Secondary Column: Either Chats List or Contacts Directory */}
      {activeNavTab === 'chats' ? (
        <Sidebar
          chats={chats}
          selectedChatJid={selectedChat?.jid || null}
          onSelectChat={handleSelectChat}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenQuickNotes={() => setIsQuickNotesOpen(true)}
          onSyncContacts={handleSyncContacts}
          isSyncing={isSyncing}
          connectionState={connectionState}
        />
      ) : (
        <ContactsPanel
          contacts={contacts}
          onSelectContact={(c) => {
            handleStartChatWithContact(c);
            setActiveNavTab('chats');
          }}
        />
      )}

      {/* 3. Main Chat Area */}
      <ChatArea
        chat={selectedChat}
        messages={messages}
        onSendMessage={handleSendMessage}
        onSendMedia={handleSendMedia}
        onOpenQuickNotes={() => setIsQuickNotesOpen(true)}
        onOpenMedia={(url, type) => setMediaModalData({ url, type })}
        onSyncChatHistory={handleSyncChatHistory}
        isSyncingHistory={isSyncingHistory}
        onUpdateMessage={handleUpdateMessage}
        onDeleteMessage={handleDeleteMessage}
        onTogglePin={handleTogglePin}
      />

      {/* Modals & Drawers */}
      <ContactsModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        contacts={contacts}
        onSelectContact={handleStartChatWithContact}
        onSyncContacts={handleSyncContacts}
        isSyncing={isSyncing}
      />

      <QuickNotesDrawer
        isOpen={isQuickNotesOpen}
        onClose={() => setIsQuickNotesOpen(false)}
        notes={quickNotes}
        onInsertNote={handleInsertNote}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
      />

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onStartChat={handleStartChatWithNumber}
        onOpenContacts={() => setIsContactsOpen(true)}
      />

      <MediaModal
        url={mediaModalData?.url || null}
        type={mediaModalData?.type || 'image'}
        onClose={() => setMediaModalData(null)}
      />

      <ThemeModal
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
      />
    </div>
  );
};
