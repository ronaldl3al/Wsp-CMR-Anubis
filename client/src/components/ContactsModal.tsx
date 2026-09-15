import React, { useState } from 'react';
import { X, Search, RefreshCw, MessageSquare, Phone, UserCheck } from 'lucide-react';
import { Contact, Chat } from '../types';

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onSyncContacts: () => void;
  isSyncing: boolean;
}

export const ContactsModal: React.FC<ContactsModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onSelectContact,
  onSyncContacts,
  isSyncing
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.push_name && c.push_name.toLowerCase().includes(q)) ||
      c.number.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#222e35] w-full max-w-lg rounded-xl shadow-2xl border border-[#2a3942] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#202c33] flex items-center justify-between border-b border-[#2a3942]">
          <div>
            <h2 className="text-lg font-semibold text-[#e9edef] flex items-center gap-2">
              <UserCheck size={20} className="text-[#00a884]" /> Agenda de Contactos
            </h2>
            <p className="text-xs text-[#8696a0]">
              {contacts.length} contactos guardados en PostgreSQL
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSyncContacts}
              disabled={isSyncing}
              className={`p-2 text-[#8696a0] hover:text-[#00a884] rounded-full hover:bg-white/5 transition ${
                isSyncing ? 'animate-spin text-[#00a884]' : ''
              }`}
              title="Volver a sincronizar contactos de WhatsApp"
            >
              <RefreshCw size={19} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#8696a0] hover:text-white rounded-full hover:bg-white/5 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-[#111b21] border-b border-[#2a3942]">
          <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-2">
            <Search size={17} className="text-[#8696a0] mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre o número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-[#e9edef] placeholder-[#8696a0] outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2a3942]/40">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-[#8696a0] text-sm">
              <p>No se encontraron contactos</p>
              <button
                onClick={onSyncContacts}
                className="mt-3 text-xs bg-[#00a884] text-white px-3 py-1.5 rounded-lg hover:bg-[#008f6f] transition"
              >
                Sincronizar ahora desde WhatsApp
              </button>
            </div>
          ) : (
            filtered.map((c) => {
              const displayName = c.name || c.push_name || c.number;

              return (
                <div
                  key={c.jid}
                  onClick={() => {
                    onSelectContact(c);
                    onClose();
                  }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[#2a3942]/60 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#111b21] overflow-hidden flex items-center justify-center text-white shrink-0 font-medium">
                      {c.profile_pic_url ? (
                        <img src={c.profile_pic_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-medium text-[#e9edef] truncate">
                        {displayName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#8696a0]">
                        <span>+{c.number}</span>
                        {c.push_name && c.name && c.push_name !== c.name && (
                          <span className="italic text-[11px] truncate">({c.push_name})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    className="p-2 text-[#00a884] hover:bg-[#00a884]/10 rounded-full transition shrink-0"
                    title="Iniciar conversación"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
