import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Search,
  BookOpen,
  Users,
  Phone,
  RefreshCw,
  History,
  X,
  Check,
  Copy,
  Reply,
  ArrowLeft,
  Pin,
  Trash2
} from 'lucide-react';
import { Chat, Message } from '../types';
import { MessageItem } from './MessageItem';
import { MessageContextMenu } from './MessageContextMenu';
import { PinnedMessageBanner } from './PinnedMessageBanner';
import { formatPhoneNumber } from '../utils/phone';
import { getWhatsAppDateLabel, isSameDay } from '../utils/dateUtils';

export interface ReplyInfo {
  id: string;
  body?: string;
  sender?: string;
}

interface ChatAreaProps {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (text: string, replyInfo?: ReplyInfo) => void;
  onSendMedia: (file: File, caption?: string) => void;
  onOpenQuickNotes: () => void;
  onOpenMedia: (url: string, type: 'image' | 'video') => void;
  onSyncChatHistory: () => Promise<void>;
  isSyncingHistory: boolean;
  onUpdateMessage?: (messageId: string, newText: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onTogglePin?: (messageId: string, pinned?: boolean) => Promise<void>;
  onBack?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  messages,
  onSendMessage,
  onSendMedia,
  onOpenQuickNotes,
  onOpenMedia,
  onSyncChatHistory,
  isSyncingHistory,
  onUpdateMessage,
  onDeleteMessage,
  onTogglePin,
  onBack
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: Message | null;
    isOpen: boolean;
  }>({ x: 0, y: 0, message: null, isOpen: false });
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);

  // Close options menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMenuOpen]);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
    setEditingMessage(null);
    setReplyingTo(null);
    setIsMenuOpen(false);
  }, [chat?.jid]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 2000);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText;
    const replyData: ReplyInfo | undefined = replyingTo
      ? {
          id: replyingTo.id,
          body: replyingTo.body || (replyingTo.type !== 'chat' ? `[${replyingTo.type}]` : ''),
          sender: replyingTo.from_me ? 'Tú' : (replyingTo.sender_name || formatPhoneNumber(replyingTo.chat_jid))
        }
      : undefined;

    setIsSending(true);

    try {
      if (editingMessage && onUpdateMessage) {
        await onUpdateMessage(editingMessage.id, textToSend);
        setEditingMessage(null);
        setInputText('');
      } else {
        setInputText('');
        setReplyingTo(null);
        await onSendMessage(textToSend, replyData);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (editingMessage) {
        setEditingMessage(null);
        setInputText('');
      } else if (replyingTo) {
        setReplyingTo(null);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      onSendMedia(file);
      e.target.value = '';
    }
  };

  // Context Menu Actions
  const handleCopyMessage = (msg: Message) => {
    if (msg.body) {
      navigator.clipboard.writeText(msg.body);
      showToast('✓ Mensaje copiado al portapapeles');
    }
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    setInputText(msg.body || '');
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleReplyMessage = (msg: Message) => {
    setReplyingTo(msg);
    setEditingMessage(null);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleDeleteMessage = async (msg: Message) => {
    if (window.confirm('¿Deseas eliminar este mensaje para todos?')) {
      await onDeleteMessage?.(msg.id);
    }
  };

  const handleTogglePinMessage = async (msg: Message) => {
    await onTogglePin?.(msg.id, !msg.is_pinned);
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#00a884]', 'ring-offset-2', 'ring-offset-[#0b141a]');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#00a884]', 'ring-offset-2', 'ring-offset-[#0b141a]');
      }, 2000);
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#222e35] text-[#8696a0] border-b-4 border-[#00a884] select-none">
        <div className="max-w-md text-center p-6 space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#2a3942] flex items-center justify-center text-[#00a884]">
            <Phone size={36} />
          </div>
          <h2 className="text-2xl font-light text-[#e9edef]">WhatsApp Web para ANUBIS STORE</h2>
          <p className="text-sm leading-relaxed text-[#8696a0]">
            Envía y recibe mensajes en tiempo real sincronizados con tu cuenta oficial de WhatsApp.
            Todos los chats, audios, fotos y documentos quedan guardados en tu base de datos persistente.
          </p>
        </div>
      </div>
    );
  }

  const displayTitle = chat.is_group ? chat.name : formatPhoneNumber(chat.number || chat.jid);
  const rawNumber = chat.number || chat.jid.split('@')[0];
  const pinnedMessage = messages.find((m) => m.is_pinned);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative w-full overflow-hidden">
      {/* Toast Notification */}
      {copyToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#00a884] text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2">
          {copyToast}
        </div>
      )}

      {/* Chat Header */}
      <div className="h-[60px] bg-[#202c33] px-3 sm:px-4 flex items-center justify-between z-20 border-b border-[#202c33] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 text-[#8696a0] hover:text-[#e9edef] rounded-full hover:bg-white/5 transition -ml-1"
              title="Volver a los chats"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2a3942] flex items-center justify-center text-white shrink-0">
            {chat.profile_pic_url ? (
              <img src={chat.profile_pic_url} alt={displayTitle} className="w-full h-full object-cover" />
            ) : chat.is_group ? (
              <Users size={20} className="text-[#8696a0]" />
            ) : (
              <Phone size={18} className="text-[#8696a0]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[15px] sm:text-[16px] font-medium text-[#e9edef] truncate leading-tight">
                {displayTitle}
              </h2>
              {/* Copy Phone Number Quick Button */}
              {!chat.is_group && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rawNumber);
                    showToast('✓ Teléfono copiado: ' + rawNumber);
                  }}
                  className="p-1 text-[#8696a0] hover:text-[#00a884] rounded hover:bg-white/5 transition shrink-0"
                  title="Copiar número de teléfono"
                >
                  <Copy size={13} />
                </button>
              )}
            </div>
            <p className="text-[11px] sm:text-[12px] text-[#8696a0] truncate">
              {chat.is_group ? 'Grupo de WhatsApp' : 'WhatsApp'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 sm:gap-2 text-[#aebac1]">
          {/* Sync History for this chat */}
          <button
            onClick={onSyncChatHistory}
            disabled={isSyncingHistory}
            className={`p-2 rounded-full hover:bg-white/10 transition flex items-center gap-1 text-xs ${
              isSyncingHistory ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-[#00a884]'
            }`}
            title="Recuperar historial previo de este chat desde WhatsApp"
          >
            <RefreshCw size={18} className={isSyncingHistory ? 'animate-spin' : ''} />
            <span className="hidden xl:inline text-[11.5px]">Recuperar Historial</span>
          </button>

          <button
            onClick={onOpenQuickNotes}
            className="p-2 rounded-full hover:bg-white/10 transition"
            title="Plantillas rápidas de atención"
          >
            <BookOpen size={19} />
          </button>

          {/* 3-Dots Options Menu Button */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-full hover:bg-white/10 transition ${
                isMenuOpen ? 'text-[#00a884] bg-white/10' : ''
              }`}
              title="Opciones del chat"
            >
              <MoreVertical size={19} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-11 z-50 bg-[#233138] border border-[#2a3942] rounded-xl shadow-2xl py-1.5 w-56 text-[13.5px] text-[#e9edef] animate-in fade-in zoom-in-95 duration-100 select-none">
                {!chat.is_group && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rawNumber);
                      showToast('✓ Teléfono copiado: ' + rawNumber);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#182229] transition text-left"
                  >
                    <Copy size={16} className="text-[#8696a0]" />
                    <span>Copiar número</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onSyncChatHistory();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#182229] transition text-left"
                >
                  <History size={16} className="text-[#8696a0]" />
                  <span>Recuperar historial</span>
                </button>

                <button
                  onClick={() => {
                    onOpenQuickNotes();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#182229] transition text-left"
                >
                  <BookOpen size={16} className="text-[#8696a0]" />
                  <span>Respuestas rápidas</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pinned Message Sticky Banner */}
      {pinnedMessage && (
        <PinnedMessageBanner
          message={pinnedMessage}
          onScrollToMessage={scrollToMessage}
          onUnpin={handleTogglePinMessage}
        />
      )}

      {/* Messages Thread with WhatsApp Doodle Pattern and Sticky Date Badges */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-6 md:px-12 py-4 whatsapp-chat-bg">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full gap-3">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1.5 rounded-md shadow">
              No hay mensajes recientes guardados para este número.
            </span>
            <button
              onClick={onSyncChatHistory}
              disabled={isSyncingHistory}
              className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs px-4 py-2 rounded-lg shadow font-medium transition flex items-center gap-1.5"
            >
              <History size={15} />
              {isSyncingHistory ? 'Recuperando mensajes...' : 'Recuperar historial de este chat'}
            </button>
          </div>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showDateHeader = !prevMessage || !isSameDay(prevMessage.timestamp, message.timestamp);
            const dateLabel = showDateHeader ? getWhatsAppDateLabel(message.timestamp) : null;
            const quotedMessage = message.quoted_id
              ? messages.find((m) => m.id === message.quoted_id) || null
              : null;

            return (
              <React.Fragment key={message.id}>
                {showDateHeader && dateLabel && (
                  <div className="flex justify-center my-3 select-none">
                    <span className="bg-[#182229]/90 backdrop-blur-sm text-[#8696a0] text-[11.5px] font-semibold px-3 py-1 rounded-lg shadow-sm border border-white/5 uppercase tracking-wide">
                      {dateLabel}
                    </span>
                  </div>
                )}
                <MessageItem
                  message={message}
                  quotedMessage={quotedMessage}
                  onOpenMedia={onOpenMedia}
                  onScrollToMessage={scrollToMessage}
                  onReply={handleReplyMessage}
                  onContextMenu={(e, msg) => {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      message: msg,
                      isOpen: true
                    });
                  }}
                />
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying Banner */}
      {replyingTo && (
        <div className="bg-[#182229] border-t border-[#2a3942] px-4 py-2 flex items-center justify-between z-10 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 overflow-hidden flex-1 border-l-4 border-[#00a884] pl-2.5">
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-semibold text-[#00a884] flex items-center gap-1">
                <Reply size={13} />
                Respondiendo a {replyingTo.from_me ? 'ti mismo' : (replyingTo.sender_name || formatPhoneNumber(replyingTo.chat_jid))}
              </span>
              <span className="text-xs text-[#8696a0] truncate italic">
                {replyingTo.body || (replyingTo.type !== 'chat' ? `[${replyingTo.type}]` : '')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-[#8696a0] hover:text-[#e9edef] rounded-md hover:bg-white/5 transition shrink-0 ml-2"
            title="Cancelar respuesta"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Edit Mode Banner */}
      {editingMessage && (
        <div className="bg-[#182229] border-t border-[#2a3942] px-4 py-2 flex items-center justify-between z-10 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-xs font-semibold text-[#00a884]">Editando mensaje:</span>
            <span className="text-xs text-[#8696a0] truncate max-w-md italic">
              {editingMessage.body}
            </span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText('');
            }}
            className="p-1 text-[#8696a0] hover:text-[#e9edef] rounded-md hover:bg-white/5 transition"
            title="Cancelar edición"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Message Input Footer */}
      <div className="min-h-[62px] bg-[#202c33] px-3 sm:px-4 py-2 flex items-end gap-2 shrink-0 z-10">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-[#8696a0] hover:text-[#e9edef] rounded-full hover:bg-white/5 transition shrink-0"
          title="Adjuntar archivo o imagen"
        >
          <Paperclip size={22} />
        </button>

        {/* Quick Notes helper button */}
        <button
          type="button"
          onClick={onOpenQuickNotes}
          className="p-2 text-[#8696a0] hover:text-[#00a884] rounded-full hover:bg-white/5 transition shrink-0"
          title="Insertar respuesta rápida"
        >
          <BookOpen size={21} />
        </button>

        {/* Textarea */}
        <div className="flex-1 bg-[#2a3942] rounded-lg px-3 py-2 flex items-center min-h-[42px] max-h-32">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              editingMessage
                ? 'Modifica tu mensaje...'
                : replyingTo
                ? 'Escribe tu respuesta...'
                : 'Escribe un mensaje aquí...'
            }
            rows={1}
            className="w-full bg-transparent text-[#e9edef] text-[14.5px] placeholder-[#8696a0] outline-none resize-none max-h-28 overflow-y-auto"
          />
        </div>

        {/* Send / Update Button */}
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          className={`p-2.5 rounded-full transition shrink-0 ${
            inputText.trim() && !isSending
              ? 'bg-[#00a884] text-white hover:bg-[#008f6f]'
              : 'text-[#8696a0] opacity-50 cursor-not-allowed'
          }`}
          title={editingMessage ? 'Guardar cambios' : 'Enviar mensaje'}
        >
          {editingMessage ? <Check size={20} /> : <Send size={20} />}
        </button>
      </div>

      {/* Right-click Context Menu */}
      <MessageContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        message={contextMenu.message}
        isOpen={contextMenu.isOpen}
        onClose={() => setContextMenu({ x: 0, y: 0, message: null, isOpen: false })}
        onReply={handleReplyMessage}
        onCopy={handleCopyMessage}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onPin={handleTogglePinMessage}
      />
    </div>
  );
};
