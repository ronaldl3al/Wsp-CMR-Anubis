import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, Palette } from 'lucide-react';
import { THEME_PRESETS, ThemeConfig, getSavedTheme, applyTheme } from '../utils/theme';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChanged?: (theme: ThemeConfig) => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose, onThemeChanged }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(getSavedTheme);

  useEffect(() => {
    if (isOpen) {
      setCurrentTheme(getSavedTheme());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: ThemeConfig) => {
    setCurrentTheme(preset);
    applyTheme(preset);
    onThemeChanged?.(preset);
  };

  const handleCustomColorChange = (key: keyof ThemeConfig, val: string) => {
    const updated: ThemeConfig = {
      ...currentTheme,
      id: 'custom',
      name: 'Personalizado',
      description: 'Combinación personalizada por el usuario',
      [key]: val
    };
    setCurrentTheme(updated);
    applyTheme(updated);
    onThemeChanged?.(updated);
  };

  const handleResetDefault = () => {
    const defaultTheme = THEME_PRESETS[0];
    setCurrentTheme(defaultTheme);
    applyTheme(defaultTheme);
    onThemeChanged?.(defaultTheme);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#00a884]/15 text-[#00a884]">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e9edef]">Personalización de Colores</h2>
              <p className="text-xs text-[#8696a0]">Selecciona un tema o personaliza tu entorno</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8696a0] hover:text-[#e9edef] rounded-lg hover:bg-white/5 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Preset Themes */}
          <div>
            <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-3">
              Temas Predefinidos
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {THEME_PRESETS.map((preset) => {
                const isSelected = currentTheme.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'border-[#00a884] bg-[#00a884]/10 shadow-sm'
                        : 'border-[#2a3942] hover:border-[#3a4b55] bg-[#111b21]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#e9edef]">{preset.name}</span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[#00a884] bg-[#00a884]/20 px-2 py-0.5 rounded-full">
                            <Check size={12} /> Activo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8696a0]">{preset.description}</p>
                    </div>

                    {/* Color Swatches */}
                    <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-lg border border-white/5">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: preset.chatBg }}
                        title="Fondo"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: preset.bubbleMe }}
                        title="Burbuja"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: preset.accent }}
                        title="Acento"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Pickers */}
          <div className="border-t border-[#2a3942] pt-5">
            <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-3">
              Personalización Manual (HEX)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* Accent Color */}
              <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] space-y-2">
                <span className="text-xs text-[#8696a0] block font-medium">Color de Acento</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.accent}
                    onChange={(e) => handleCustomColorChange('accent', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs font-mono text-[#e9edef]">{currentTheme.accent}</span>
                </div>
              </div>

              {/* Chat Background */}
              <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] space-y-2">
                <span className="text-xs text-[#8696a0] block font-medium">Fondo del Chat</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.chatBg}
                    onChange={(e) => handleCustomColorChange('chatBg', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs font-mono text-[#e9edef]">{currentTheme.chatBg}</span>
                </div>
              </div>

              {/* My Bubble Color */}
              <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] space-y-2">
                <span className="text-xs text-[#8696a0] block font-medium">Burbujas Envíos</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.bubbleMe}
                    onChange={(e) => handleCustomColorChange('bubbleMe', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs font-mono text-[#e9edef]">{currentTheme.bubbleMe}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#111b21] border-t border-[#2a3942] flex items-center justify-between">
          <button
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 text-xs text-[#8696a0] hover:text-[#e9edef] transition"
          >
            <RotateCcw size={14} />
            Restablecer WhatsApp Oficial
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-lg shadow transition"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
