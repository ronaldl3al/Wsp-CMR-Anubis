import React from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, Clock, FileText, Download } from 'lucide-react';
import { Message } from '../types';
import { AudioPlayer } from './AudioPlayer';

interface MessageItemProps {
  message: Message;
  onOpenMedia: (url: string, type: 'image' | 'video') => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onOpenMedia }) => {
  const isMe = message.from_me;

  // Format timestamp (seconds to ms)
  const timeString = message.timestamp
    ? format(new Date(message.timestamp * 1000), 'HH:mm')
    : '';

  const renderStatus = () => {
    if (!isMe) return null;
    switch (message.status) {
      case 'pending':
        return <Clock size={14} className="text-[#8696a0]" />;
      case 'sent':
        return <Check size={14} className="text-[#8696a0]" />;
      case 'delivered':
        return <CheckCheck size={14} className="text-[#8696a0]" />;
      case 'read':
        return <CheckCheck size={14} className="text-[#53bdeb]" />;
      default:
        return <Check size={14} className="text-[#8696a0]" />;
    }
  };

  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="space-y-1">
            {message.media_url && (
              <img
                src={message.media_url}
                alt="Imagen"
                onClick={() => onOpenMedia(message.media_url!, 'image')}
                className="max-h-72 w-full object-cover rounded cursor-pointer hover:opacity-95 transition"
                loading="lazy"
              />
            )}
            {message.body && message.body !== '[image]' && (
              <p className="text-[14.2px] text-[#e9edef] whitespace-pre-wrap break-words px-1 pt-1">
                {message.body}
              </p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-1">
            {message.media_url && (
              <div
                onClick={() => onOpenMedia(message.media_url!, 'video')}
                className="relative cursor-pointer max-h-72 rounded overflow-hidden"
              >
                <video src={message.media_url} className="w-full max-h-72 object-cover rounded" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="bg-[#00a884] text-white p-3 rounded-full">▶</span>
                </div>
              </div>
            )}
            {message.body && message.body !== '[video]' && (
              <p className="text-[14.2px] text-[#e9edef] whitespace-pre-wrap break-words px-1 pt-1">
                {message.body}
              </p>
            )}
          </div>
        );

      case 'audio':
        return message.media_url ? (
          <AudioPlayer src={message.media_url} fromMe={isMe} />
        ) : (
          <p className="italic text-[#8696a0] text-[13px]">[Nota de voz]</p>
        );

      case 'document':
        return (
          <div className="flex items-center gap-3 p-2 bg-black/10 rounded min-w-[220px]">
            <FileText size={32} className="text-[#00a884] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#e9edef] truncate">
                {message.media_filename || 'Documento'}
              </p>
              <p className="text-[11px] text-[#8696a0] uppercase">{message.media_mimetype?.split('/')[1] || 'Archivo'}</p>
            </div>
            {message.media_url && (
              <a
                href={message.media_url}
                download={message.media_filename || 'documento'}
                className="p-1.5 rounded-full hover:bg-white/10 transition text-[#8696a0] hover:text-white"
              >
                <Download size={18} />
              </a>
            )}
          </div>
        );

      default:
        return (
          <p className="text-[14.2px] leading-[19px] text-[#e9edef] whitespace-pre-wrap break-words">
            {message.body}
          </p>
        );
    }
  };

  return (
    <div className={`flex w-full my-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[75%] md:max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm text-sm ${
          isMe
            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
        }`}
      >
        {/* Sender name for group chats */}
        {!isMe && message.sender_name && (
          <p className="text-[12px] font-semibold text-[#53bdeb] mb-0.5">
            {message.sender_name}
          </p>
        )}

        {/* Bubble content */}
        <div>{renderContent()}</div>

        {/* Timestamp and Ack Checks */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-[#8696a0] float-right ml-2 -mb-0.5">
          <span>{timeString}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
};
