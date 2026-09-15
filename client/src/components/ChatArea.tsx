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
  Bold,
  Italic,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered
} from 'lucide-react';
import { Chat, Message } from '../types';
import { MessageItem } from './MessageItem';
import { MessageContextMenu } from './MessageContextMenu';
import { PinnedMessageBanner } from './PinnedMessageBanner';
import { formatPhoneNumber } from '../utils/phone';
import { getWhatsAppDateLabel, isSameDay } from '../utils/dateUtils';

interface ChatAreaProps {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onSendMedia: (file: File, caption?: string) => void;
  onOpenQuickNotes: () => void;
  onOpenMedia: (url: string, type: 'image' | 'video') => void;
  onSyncChatHistory: () => Promise<void>;
  isSyncingHistory: boolean;
  onUpdateMessage?: (messageId: string, newText: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onTogglePin?: (messageId: string, pinned?: boolean) => Promise<void>;
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
  onTogglePin
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: Message | null;
    isOpen: boolean;
  }>({ x: 0, y: 0, message: null, isOpen: false });
  const [copyToast, setCopyToast] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
    setEditingMessage(null);
  }, [chat?.jid]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText;
    setIsSending(true);

    try {
      if (editingMessage && onUpdateMessage) {
        await onUpdateMessage(editingMessage.id, textToSend);
        setEditingMessage(null);
        setInputText('');
      } else {
        setInputText('');
        await onSendMessage(textToSend);
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
    if (e.key === 'Escape' && editingMessage) {
      setEditingMessage(null);
      setInputText('');
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

  // WhatsApp Formatting Shortcuts helper
  const applyFormat = (type: 'bold' | 'italic' | 'strike' | 'mono' | 'quote' | 'bullet' | 'number') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = inputText.substring(start, end);

    let before = '';
    let after = '';
    let defaultPlaceholder = '';

    switch (type) {
      case 'bold':
        before = '*';
        after = '*';
        defaultPlaceholder = 'texto';
        break;
      case 'italic':
        before = '_';
        after = '_';
        defaultPlaceholder = 'texto';
        break;
      case 'strike':
        before = '~';
        after = '~';
        defaultPlaceholder = 'texto';
        break;
      case 'mono':
        before = '```';
        after = '```';
        defaultPlaceholder = 'código';
        break;
      case 'quote':
        before = '> ';
        after = '';
        defaultPlaceholder = 'cita';
        break;
      case 'bullet':
        before = '* ';
        after = '';
        defaultPlaceholder = 'elemento';
        break;
      case 'number':
        before = '1. ';
        after = '';
        defaultPlaceholder = 'elemento';
        break;
    }

    const replacement = selected ? `${before}${selected}${after}` : `${before}${defaultPlaceholder}${after}`;
    const newText = inputText.substring(0, start) + replacement + inputText.substring(end);
    setInputText(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = selected ? start + replacement.length : start + before.length + defaultPlaceholder.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // Context Menu Actions
  const handleCopyMessage = (msg: Message) => {
    if (msg.body) {
      navigator.clipboard.writeText(msg.body);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessage(msg);
    setInputText(msg.body || '');
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
  const pinnedMessage = messages.find((m) => m.is_pinned);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
      {/* Toast Notification */}
      {copyToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#00a884] text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2">
          ✓ Copiado al portapapeles
        </div>
      )}

      {/* Chat Header */}
      <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between z-10 border-b border-[#202c33]">
        <div className="flex items-center gap-3 min-w-0">
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
            <h2 className="text-[16px] font-medium text-[#e9edef] truncate leading-tight">
              {displayTitle}
            </h2>
            <p className="text-[12px] text-[#8696a0] truncate">
              {chat.is_group ? 'Grupo de WhatsApp' : 'WhatsApp'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 text-[#aebac1]">
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
            <span className="hidden lg:inline text-[11.5px]">Recuperar Historial</span>
          </button>

          <button
            onClick={onOpenQuickNotes}
            className="p-2 rounded-full hover:bg-white/10 transition"
            title="Plantillas rápidas de atención"
          >
            <BookOpen size={19} />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10 transition" title="Buscar en el chat">
            <Search size={19} />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10 transition" title="Opciones">
            <MoreVertical size={19} />
          </button>
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
      <div className="flex-1 overflow-y-auto px-4 md:px-12 py-4 whatsapp-chat-bg">
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

            return (
              <React.Fragment key={message.id}>
                {showDateHeader && dateLabel && (
                  <div className="flex justify-center my-3 sticky top-2 z-10 pointer-events-none select-none">
                    <span className="bg-[#182229]/90 backdrop-blur-sm text-[#8696a0] text-[11.5px] font-semibold px-3 py-1 rounded-lg shadow-sm border border-white/5 uppercase tracking-wide">
                      {dateLabel}
                    </span>
                  </div>
                )}
                <MessageItem
                  message={message}
                  onOpenMedia={onOpenMedia}
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

      {/* Formatting Shortcuts Toolbar */}
      <div className="bg-[#202c33] border-t border-[#2a3942]/60 px-4 py-1 flex items-center gap-1 text-[#8696a0] text-xs z-10 select-none overflow-x-auto">
        <span className="text-[11px] font-semibold text-[#8696a0]/70 uppercase tracking-wider mr-1 hidden sm:inline">
          Formato:
        </span>
        <button
          type="button"
          onClick={() => applyFormat('bold')}
          className="p-1.5 hover:bg-[#2a3942] hover:text-[#e9edef] rounded font-bold transition flex items-center gap-0.5"
          title="Negrita (*texto*)"
        >
          <Bold size={14} />
          <span className="text-[11px]">B</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('italic')}
          className="p-1.5 hover:bg-[#2a3942] hover:text-[#e9edef] rounded italic transition flex items-center gap-0.5"
          title="Cursiva (_texto_)"
        >
          <Italic size={14} />
          <span className="text-[11px]">I</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('strike')}
          className="p-1.5 hover:bg-[#2a3942] hover:text-[#e9edef] rounded line-through transition flex items-center gap-0.5"
          title="Tachado (~texto~)"
        >
          <Strikethrough size={14} />
          <span className="text-[11px]">S</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('mono')}
          className="p-1.5 hover:bg-[#2a3942] hover:text-[#e9edef] rounded font-mono transition flex items-center gap-0.5"
          title="Monoespaciado (```texto```)"
        >
          <Code size={14} />
          <span className="text-[11px]">&lt;&gt;</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('quote')}
          className="p-1.5 hover:bg-[#2a3942] hover:text-[#e9edef] rounded transition flex items-center gap-0.5"
          title="Cita (> texto)"
        >
          <Quote size={14} />
          <span className="text-[11px]">&gt;</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('bullet')}
          className="p-1.5 hover:bg-[#2a3942] hover:text-[#e9edef] rounded transition flex items-center gap-0.5"
          title="Lista con viñetas (* texto)"
        >
          <List size={14} />
          <span className="text-[11px]">•</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('number')}
          className="p-1.5 hover:bg-[#2a3942] hover:text-[#e9edef] rounded transition flex items-center gap-0.5"
          title="Lista numerada (1. texto)"
        >
          <ListOrdered size={14} />
          <span className="text-[11px]">1.</span>
        </button>
      </div>

      {/* Message Input Footer */}
      <div className="min-h-[62px] bg-[#202c33] px-4 py-2 flex items-end gap-2 shrink-0 z-10">
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
          className="p-2.5 text-[#8696a0] hover:text-[#e9edef] rounded-full hover:bg-white/5 transition shrink-0"
          title="Adjuntar archivo o imagen"
        >
          <Paperclip size={22} />
        </button>

        {/* Quick Notes helper button */}
        <button
          type="button"
          onClick={onOpenQuickNotes}
          className="p-2.5 text-[#8696a0] hover:text-[#00a884] rounded-full hover:bg-white/5 transition shrink-0"
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
            placeholder={editingMessage ? 'Modifica tu mensaje...' : 'Escribe un mensaje aquí...'}
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
        onCopy={handleCopyMessage}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onPin={handleTogglePinMessage}
      />
    </div>
  );
};
