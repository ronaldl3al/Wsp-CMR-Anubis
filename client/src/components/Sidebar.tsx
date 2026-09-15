import React, { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, MessageSquarePlus, RefreshCw, BookOpen, Check, CheckCheck, Users } from 'lucide-react';
import { Chat } from '../types';

interface SidebarProps {
  chats: Chat[];
  selectedChatJid: string | null;
  onSelectChat: (chat: Chat) => void;
  onOpenNewChat: () => void;
  onOpenQuickNotes: () => void;
  onSyncContacts: () => void;
  isSyncing: boolean;
  connectionState: 'open' | 'connecting' | 'close';
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  selectedChatJid,
  onSelectChat,
  onOpenNewChat,
  onOpenQuickNotes,
  onSyncContacts,
  isSyncing,
  connectionState
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');

  const formatChatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ayer';
    return format(date, 'dd/MM/yy');
  };

  const filteredChats = chats.filter((chat) => {
    // Tab filter
    if (filter === 'unread' && chat.unread_count === 0) return false;
    if (filter === 'groups' && !chat.is_group) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = chat.name?.toLowerCase().includes(q);
      const matchNumber = chat.number?.includes(q);
      const matchMessage = chat.last_message_text?.toLowerCase().includes(q);
      return matchName || matchNumber || matchMessage;
    }
    return true;
  });

  return (
    <div className="w-full md:w-[400px] lg:w-[450px] h-full flex flex-col bg-[#111b21] border-r border-[#202c33] shrink-0">
      {/* Top Header */}
      <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-lg shadow">
            A
          </div>
          <div>
            <h1 className="text-[15px] font-medium text-[#e9edef] leading-tight">ANUBIS STORE</h1>
            <div className="flex items-center gap-1.5 text-[12px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionState === 'open'
                    ? 'bg-emerald-500'
                    : connectionState === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-[#8696a0]">
                {connectionState === 'open'
                  ? 'Conectado'
                  : connectionState === 'connecting'
                  ? 'Conectando...'
                  : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 text-[#aebac1]">
          <button
            onClick={onSyncContacts}
            disabled={isSyncing}
            className={`p-2 rounded-full hover:bg-white/10 transition ${isSyncing ? 'animate-spin text-[#00a884]' : ''}`}
            title="Sincronizar contactos registrados de WhatsApp"
          >
            <RefreshCw size={19} />
          </button>
          <button
            onClick={onOpenQuickNotes}
            className="p-2 rounded-full hover:bg-white/10 transition"
            title="Respuestas Rápidas"
          >
            <BookOpen size={19} />
          </button>
          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-full hover:bg-white/10 transition"
            title="Nuevo chat / Agenda"
          >
            <MessageSquarePlus size={20} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 bg-[#111b21] border-b border-[#202c33]/50">
        <div className="relative flex items-center bg-[#202c33] rounded-lg px-3 py-1.5">
          <Search size={17} className="text-[#8696a0] mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Buscar o empezar un nuevo chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-[#e9edef] text-[14px] placeholder-[#8696a0] outline-none"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111b21] border-b border-[#202c33]/40">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-[13px] rounded-full transition ${
            filter === 'all'
              ? 'bg-[#00a884] text-white font-medium'
              : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1 text-[13px] rounded-full transition ${
            filter === 'unread'
              ? 'bg-[#00a884] text-white font-medium'
              : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
          }`}
        >
          No leídos
        </button>
        <button
          onClick={() => setFilter('groups')}
          className={`px-3 py-1 text-[13px] rounded-full transition ${
            filter === 'groups'
              ? 'bg-[#00a884] text-white font-medium'
              : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
          }`}
        >
          Grupos
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#8696a0] text-sm px-4 text-center">
            <p>No se encontraron conversaciones</p>
            <button
              onClick={onOpenNewChat}
              className="mt-3 text-[#00a884] hover:underline flex items-center gap-1.5"
            >
              <MessageSquarePlus size={16} /> Abrir agenda de contactos
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = selectedChatJid === chat.jid;
            const hasUnread = chat.unread_count > 0;

            return (
              <div
                key={chat.jid}
                onClick={() => onSelectChat(chat)}
                className={`flex items-center px-4 py-3 cursor-pointer transition border-b border-[#202c33]/30 select-none ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]/70'
                }`}
              >
                {/* Avatar */}
                <div className="relative w-12 h-12 rounded-full shrink-0 mr-3 overflow-hidden bg-[#2a3942] flex items-center justify-center text-white">
                  {chat.profile_pic_url ? (
                    <img
                      src={chat.profile_pic_url}
                      alt={chat.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : chat.is_group ? (
                    <Users size={22} className="text-[#8696a0]" />
                  ) : (
                    <span className="font-semibold text-lg uppercase">
                      {(chat.name || chat.number || 'U').charAt(0)}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h2
                      className={`text-[15.5px] truncate font-normal ${
                        hasUnread ? 'text-white font-medium' : 'text-[#e9edef]'
                      }`}
                    >
                      {chat.name || chat.number}
                    </h2>
                    <span
                      className={`text-[12px] shrink-0 ml-2 ${
                        hasUnread ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'
                      }`}
                    >
                      {formatChatTime(chat.last_message_time)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[13.5px] text-[#8696a0] truncate">
                      {chat.last_message_from_me && (
                        <span>
                          {chat.last_message_status === 'read' ? (
                            <CheckCheck size={16} className="text-[#53bdeb] shrink-0 inline" />
                          ) : (
                            <Check size={16} className="text-[#8696a0] shrink-0 inline" />
                          )}
                        </span>
                      )}
                      <p className="truncate">
                        {chat.last_message_text || 'Toca para chatear'}
                      </p>
                    </div>

                    {hasUnread && (
                      <span className="ml-2 px-2 py-0.5 min-w-[20px] text-center bg-[#00a884] text-white text-[12px] font-bold rounded-full shrink-0">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
