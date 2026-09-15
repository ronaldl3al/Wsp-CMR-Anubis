import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Smile, MoreVertical, Search, BookOpen, Users, Phone } from 'lucide-react';
import { Chat, Message } from '../types';
import { MessageItem } from './MessageItem';

interface ChatAreaProps {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onSendMedia: (file: File, caption?: string) => void;
  onOpenQuickNotes: () => void;
  onOpenMedia: (url: string, type: 'image' | 'video') => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  messages,
  onSendMessage,
  onSendMedia,
  onOpenQuickNotes,
  onOpenMedia
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [chat?.jid]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText;
    setInputText('');
    setIsSending(true);

    try {
      await onSendMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      onSendMedia(file);
      // Reset input
      e.target.value = '';
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
      {/* Chat Header */}
      <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between z-10 border-b border-[#202c33]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2a3942] flex items-center justify-center text-white shrink-0">
            {chat.profile_pic_url ? (
              <img src={chat.profile_pic_url} alt={chat.name} className="w-full h-full object-cover" />
            ) : chat.is_group ? (
              <Users size={20} className="text-[#8696a0]" />
            ) : (
              <span className="font-semibold uppercase text-base">
                {(chat.name || chat.number || 'U').charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium text-[#e9edef] truncate leading-tight">
              {chat.name || chat.number}
            </h2>
            <p className="text-[12px] text-[#8696a0] truncate">
              {chat.is_group ? 'Grupo de WhatsApp' : `+${chat.number}`}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3 text-[#aebac1]">
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

      {/* Messages Thread with WhatsApp Doodle Pattern */}
      <div className="flex-1 overflow-y-auto px-4 md:px-12 py-4 whatsapp-chat-bg">
        {messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1.5 rounded-md shadow">
              No hay mensajes anteriores en este chat. ¡Escribe el primero!
            </span>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} onOpenMedia={onOpenMedia} />
          ))
        )}
        <div ref={messagesEndRef} />
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
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje aquí..."
            rows={1}
            className="w-full bg-transparent text-[#e9edef] text-[14.5px] placeholder-[#8696a0] outline-none resize-none max-h-28 overflow-y-auto"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          className={`p-2.5 rounded-full transition shrink-0 ${
            inputText.trim() && !isSending
              ? 'bg-[#00a884] text-white hover:bg-[#008f6f]'
              : 'text-[#8696a0] opacity-50 cursor-not-allowed'
          }`}
          title="Enviar mensaje"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};
