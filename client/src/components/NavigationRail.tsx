import React from 'react';
import { MessageSquare, Users, BookOpen, RefreshCw, Palette } from 'lucide-react';

export type NavTab = 'chats' | 'contacts';

interface NavigationRailProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickNotes: () => void;
  onSyncContacts: () => void;
  onOpenThemeModal?: () => void;
  isSyncing: boolean;
  totalUnreadCount: number;
  connectionState: 'open' | 'connecting' | 'close';
  className?: string;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickNotes,
  onSyncContacts,
  onOpenThemeModal,
  isSyncing,
  totalUnreadCount,
  connectionState,
  className
}) => {
  return (
    <div className={`w-[60px] h-full bg-[#202c33] flex flex-col items-center justify-between py-3 border-r border-[#2a3942]/60 shrink-0 select-none z-20 ${className || ''}`}>
      {/* Top Section */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* App Logo */}
        <div
          className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-base shadow mb-2 cursor-pointer"
          title="ANUBIS STORE WhatsApp"
        >
          A
        </div>

        {/* Chats Tab Button */}
        <button
          onClick={() => onSelectTab('chats')}
          className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition ${
            activeTab === 'chats'
              ? 'bg-[#374248] text-[#00a884]'
              : 'text-[#8696a0] hover:bg-[#374248]/50 hover:text-[#e9edef]'
          }`}
          title="Conversaciones"
        >
          <MessageSquare size={22} />
          {totalUnreadCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.2 bg-[#00a884] text-white text-[10px] font-bold rounded-full min-w-[16px] text-center">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </button>

        {/* Contacts Tab Button */}
        <button
          onClick={() => onSelectTab('contacts')}
          className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition ${
            activeTab === 'contacts'
              ? 'bg-[#374248] text-[#00a884]'
              : 'text-[#8696a0] hover:bg-[#374248]/50 hover:text-[#e9edef]'
          }`}
          title="Contactos (Registrados / No Registrados)"
        >
          <Users size={22} />
        </button>

        {/* Quick Notes Button */}
        <button
          onClick={onOpenQuickNotes}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-[#8696a0] hover:bg-[#374248]/50 hover:text-[#e9edef] transition"
          title="Respuestas Rápidas"
        >
          <BookOpen size={21} />
        </button>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Theme Palette Button */}
        <button
          onClick={onOpenThemeModal}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#00a884] hover:bg-[#374248]/50 transition"
          title="Personalización de colores y apariencia"
        >
          <Palette size={20} />
        </button>

        {/* Sync Contacts Button */}
        <button
          onClick={onSyncContacts}
          disabled={isSyncing}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#00a884] hover:bg-[#374248]/50 transition ${
            isSyncing ? 'animate-spin text-[#00a884]' : ''
          }`}
          title="Sincronizar contactos de WhatsApp"
        >
          <RefreshCw size={19} />
        </button>

        {/* Connection Status Indicator */}
        <div
          className="relative group p-1 cursor-pointer"
          title={`WhatsApp: ${connectionState === 'open' ? 'Conectado' : 'Desconectado'}`}
        >
          <span
            className={`block w-3 h-3 rounded-full ${
              connectionState === 'open'
                ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                : connectionState === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500 ring-2 ring-rose-500/20'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
