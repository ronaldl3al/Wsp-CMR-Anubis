import React, { useState } from 'react';
import { X, Send, Phone, User } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (numberOrJid: string, initialMessage?: string) => void;
  onOpenContacts: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onStartChat,
  onOpenContacts
}) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return;

    onStartChat(`${cleanPhone}@s.whatsapp.net`, message.trim() ? message.trim() : undefined);
    setPhone('');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#222e35] w-full max-w-md rounded-xl shadow-2xl border border-[#2a3942] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Phone size={20} className="text-[#00a884]" /> Iniciar Nuevo Chat
          </h2>
          <button onClick={onClose} className="p-1 text-[#8696a0] hover:text-white rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8696a0] mb-1.5">
              Número de teléfono (con código de país, ej: 584141234567)
            </label>
            <input
              type="tel"
              placeholder="58414..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#111b21] text-sm text-white px-3.5 py-2.5 rounded-lg border border-[#2a3942] outline-none focus:border-[#00a884]"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8696a0] mb-1.5">
              Mensaje inicial (opcional)
            </label>
            <textarea
              placeholder="Hola, te contacto desde ANUBIS STORE..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full bg-[#111b21] text-sm text-white px-3.5 py-2.5 rounded-lg border border-[#2a3942] outline-none focus:border-[#00a884] resize-none"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2"
            >
              <Send size={16} /> Abrir conversación
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenContacts();
              }}
              className="w-full py-2 text-xs text-[#00a884] hover:underline flex items-center justify-center gap-1"
            >
              <User size={14} /> Seleccionar de la agenda guardada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
