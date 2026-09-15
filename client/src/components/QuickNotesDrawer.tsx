import React, { useState } from 'react';
import { X, Plus, Trash2, Send, BookOpen } from 'lucide-react';
import { QuickNote } from '../types';

interface QuickNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notes: QuickNote[];
  onInsertNote: (content: string) => void;
  onCreateNote: (title: string, content: string, category?: string) => Promise<void>;
  onDeleteNote: (id: number) => Promise<void>;
}

export const QuickNotesDrawer: React.FC<QuickNotesDrawerProps> = ({
  isOpen,
  onClose,
  notes,
  onInsertNote,
  onCreateNote,
  onDeleteNote
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    await onCreateNote(newTitle, newContent, newCategory);
    setNewTitle('');
    setNewContent('');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
      <div className="w-full max-w-md bg-[#111b21] h-full shadow-2xl flex flex-col border-l border-[#202c33] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between border-b border-[#202c33]">
          <h2 className="text-[16px] font-medium text-[#e9edef] flex items-center gap-2">
            <BookOpen size={19} className="text-[#00a884]" /> Respuestas Rápidas
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#8696a0] hover:text-white rounded-full hover:bg-white/5 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2.5 px-4 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
            >
              <Plus size={18} /> Nueva Respuesta Rápida
            </button>
          ) : (
            <form onSubmit={handleSave} className="bg-[#202c33] p-4 rounded-xl border border-[#2a3942] space-y-3">
              <h3 className="text-sm font-medium text-white">Crear plantilla</h3>
              <input
                type="text"
                placeholder="Título (ej: Horario, Métodos de Pago)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[#111b21] text-sm text-white px-3 py-2 rounded-lg border border-[#2a3942] outline-none focus:border-[#00a884]"
                required
              />
              <textarea
                placeholder="Mensaje predeterminado..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                className="w-full bg-[#111b21] text-sm text-white px-3 py-2 rounded-lg border border-[#2a3942] outline-none focus:border-[#00a884] resize-none"
                required
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-[#8696a0] hover:text-white rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-medium"
                >
                  Guardar
                </button>
              </div>
            </form>
          )}

          {/* Notes List */}
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-[#202c33] p-3.5 rounded-xl border border-[#202c33] hover:border-[#00a884]/40 transition group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-sm font-semibold text-[#e9edef]">{note.title}</h4>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1 text-[#8696a0] hover:text-rose-400 rounded transition"
                      title="Eliminar plantilla"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="text-[13px] text-[#8696a0] whitespace-pre-wrap leading-relaxed mb-3">
                  {note.content}
                </p>
                <button
                  onClick={() => {
                    onInsertNote(note.content);
                    onClose();
                  }}
                  className="w-full py-1.5 px-3 bg-[#2a3942] hover:bg-[#00a884] text-white text-xs rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <Send size={13} /> Usar esta respuesta
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
