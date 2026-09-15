import React, { useState } from 'react';
import { Search, Phone, MessageSquare, UserCheck, UserX } from 'lucide-react';
import { Contact } from '../types';
import { formatPhoneNumber, isLidAccount } from '../utils/phone';

interface ContactsPanelProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
}

export const ContactsPanel: React.FC<ContactsPanelProps> = ({ contacts, onSelectContact }) => {
  const [filter, setFilter] = useState<'saved' | 'unsaved'>('saved');
  const [search, setSearch] = useState('');

  // Filter out internal LID accounts and apply tabs & search
  const filteredContacts = contacts.filter((c) => {
    // Hide LID accounts
    if (isLidAccount(c.jid)) return false;

    // Filter by tab
    if (filter === 'saved' && !c.is_saved) return false;
    if (filter === 'unsaved' && c.is_saved) return false;

    // Search by clean phone digits
    if (search.trim()) {
      const q = search.replace(/\D/g, '');
      const num = c.number.replace(/\D/g, '');
      return num.includes(q);
    }
    return true;
  });

  const savedCount = contacts.filter((c) => c.is_saved && !isLidAccount(c.jid)).length;
  const unsavedCount = contacts.filter((c) => !c.is_saved && !isLidAccount(c.jid)).length;

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] h-full flex flex-col bg-[#111b21] border-r border-[#202c33] shrink-0 select-none">
      {/* Header */}
      <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between shrink-0 border-b border-[#202c33]">
        <h2 className="text-[17px] font-medium text-[#e9edef] flex items-center gap-2">
          <Phone size={19} className="text-[#00a884]" /> Directorio Telefónico
        </h2>
        <span className="text-xs text-[#8696a0]">
          {filteredContacts.length} números
        </span>
      </div>

      {/* Search Input */}
      <div className="p-2.5 bg-[#111b21] border-b border-[#202c33]/40">
        <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-1.5">
          <Search size={16} className="text-[#8696a0] mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por número telefónico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-[#e9edef] text-[13.5px] placeholder-[#8696a0] outline-none"
          />
        </div>
      </div>

      {/* Sub-tabs: Registrados vs No Registrados */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111b21] border-b border-[#202c33]/40">
        <button
          onClick={() => setFilter('saved')}
          className={`flex-1 py-1.5 px-3 text-[13px] rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
            filter === 'saved'
              ? 'bg-[#00a884] text-white'
              : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]'
          }`}
        >
          <UserCheck size={15} /> Registrados ({savedCount})
        </button>

        <button
          onClick={() => setFilter('unsaved')}
          className={`flex-1 py-1.5 px-3 text-[13px] rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
            filter === 'unsaved'
              ? 'bg-[#00a884] text-white'
              : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]'
          }`}
        >
          <UserX size={15} /> No Registrados ({unsavedCount})
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
        {filteredContacts.length === 0 ? (
          <div className="py-16 text-center text-[#8696a0] text-sm px-4">
            <p>No se encontraron números en esta categoría</p>
          </div>
        ) : (
          filteredContacts.map((c) => {
            const formatted = formatPhoneNumber(c.number || c.jid);

            return (
              <div
                key={c.jid}
                onClick={() => onSelectContact(c)}
                className="flex items-center justify-between px-4 py-3 hover:bg-[#202c33]/70 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-[#2a3942] overflow-hidden flex items-center justify-center text-[#8696a0] shrink-0 font-medium text-sm">
                    {c.profile_pic_url ? (
                      <img
                        src={c.profile_pic_url}
                        alt="Foto"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Phone size={18} className="text-[#8696a0]" />
                    )}
                  </div>

                  {/* ONLY PHONE NUMBER */}
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-[#e9edef] tracking-wide truncate">
                      {formatted}
                    </p>
                    <span className="text-[11px] text-[#8696a0]">
                      {c.is_saved ? 'Contacto en agenda' : 'Número no registrado'}
                    </span>
                  </div>
                </div>

                <button
                  className="p-2 text-[#8696a0] group-hover:text-[#00a884] hover:bg-white/5 rounded-full transition shrink-0"
                  title="Abrir chat"
                >
                  <MessageSquare size={18} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
