import React from 'react';
import { Pin, X } from 'lucide-react';
import { Message } from '../types';

interface PinnedMessageBannerProps {
  message: Message;
  onScrollToMessage: (id: string) => void;
  onUnpin: (message: Message) => void;
}

export const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  message,
  onScrollToMessage,
  onUnpin
}) => {
  const previewText = message.body || (message.type !== 'chat' ? `[${message.type}]` : 'Mensaje fijado');

  return (
    <div className="bg-[#182229]/95 border-b border-[#2a3942] px-4 py-2 flex items-center justify-between shadow-sm z-10 backdrop-blur-sm select-none">
      <div
        onClick={() => onScrollToMessage(message.id)}
        className="flex items-center gap-2.5 flex-1 cursor-pointer overflow-hidden group"
      >
        <div className="p-1 rounded bg-[#00a884]/15 text-[#00a884] shrink-0">
          <Pin size={14} className="rotate-45" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold text-[#00a884] uppercase tracking-wider">
            Mensaje Fijado
          </span>
          <p className="text-xs text-[#e9edef] truncate group-hover:text-white transition">
            {previewText}
          </p>
        </div>
      </div>

      <button
        onClick={() => onUnpin(message)}
        className="p-1 text-[#8696a0] hover:text-[#e9edef] rounded-md hover:bg-white/5 transition ml-2 shrink-0"
        title="Desfijar mensaje"
      >
        <X size={16} />
      </button>
    </div>
  );
};
