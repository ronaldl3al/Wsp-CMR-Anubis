import React, { useEffect, useRef } from 'react';
import { Copy, Edit3, Trash2, Pin, PinOff } from 'lucide-react';
import { Message } from '../types';

interface MessageContextMenuProps {
  x: number;
  y: number;
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onCopy: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onDelete: (msg: Message) => void;
  onPin: (msg: Message) => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  x,
  y,
  message,
  isOpen,
  onClose,
  onCopy,
  onEdit,
  onDelete,
  onPin
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  // Adjust positioning to avoid overflowing viewport
  const menuWidth = 200;
  const menuHeight = 180;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const posX = x + menuWidth > screenW ? screenW - menuWidth - 12 : x;
  const posY = y + menuHeight > screenH ? screenH - menuHeight - 12 : y;

  const canEdit = message.from_me && message.type === 'chat' && !message.is_deleted;
  const canDelete = !message.is_deleted;

  return (
    <div
      ref={menuRef}
      style={{ top: `${posY}px`, left: `${posX}px` }}
      className="fixed z-50 bg-[#233138] border border-[#2a3942] rounded-xl shadow-2xl py-1.5 w-[200px] text-[14px] text-[#e9edef] animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Copiar */}
      <button
        onClick={() => {
          onCopy(message);
          onClose();
        }}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#182229] transition text-left"
      >
        <Copy size={16} className="text-[#8696a0]" />
        <span>Copiar</span>
      </button>

      {/* Editar (Only sent text messages) */}
      {canEdit && (
        <button
          onClick={() => {
            onEdit(message);
            onClose();
          }}
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#182229] transition text-left"
        >
          <Edit3 size={16} className="text-[#8696a0]" />
          <span>Editar</span>
        </button>
      )}

      {/* Fijar / Desfijar */}
      <button
        onClick={() => {
          onPin(message);
          onClose();
        }}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#182229] transition text-left"
      >
        {message.is_pinned ? (
          <>
            <PinOff size={16} className="text-[#53bdeb]" />
            <span>Desfijar</span>
          </>
        ) : (
          <>
            <Pin size={16} className="text-[#8696a0]" />
            <span>Fijar</span>
          </>
        )}
      </button>

      {/* Separator if delete is available */}
      {canDelete && <div className="my-1 border-t border-[#2a3942]" />}

      {/* Eliminar para todos */}
      {canDelete && (
        <button
          onClick={() => {
            onDelete(message);
            onClose();
          }}
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-500/15 text-red-400 hover:text-red-300 transition text-left"
        >
          <Trash2 size={16} />
          <span>Eliminar para todos</span>
        </button>
      )}
    </div>
  );
};
