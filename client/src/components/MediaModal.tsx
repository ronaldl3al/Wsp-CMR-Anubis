import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface MediaModalProps {
  url: string | null;
  type: 'image' | 'video';
  onClose: () => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({ url, type, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (url) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm cursor-pointer select-none animate-in fade-in duration-150"
    >
      {/* Top action buttons */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 right-4 flex items-center gap-4 text-white z-10"
      >
        <a
          href={url}
          download={`whatsapp_${type}_${Date.now()}`}
          className="p-2 rounded-full hover:bg-white/10 transition"
          title="Descargar archivo"
        >
          <Download size={22} />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition"
          title="Cerrar (Esc o clic afuera)"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main media container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-4xl max-h-[85vh] flex items-center justify-center cursor-default"
      >
        {type === 'image' ? (
          <img
            src={url}
            alt="Media"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};
