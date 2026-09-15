import React from 'react';
import { X, Download } from 'lucide-react';

interface MediaModalProps {
  url: string | null;
  type: 'image' | 'video';
  onClose: () => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({ url, type, onClose }) => {
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-4 text-white">
        <a
          href={url}
          download="whatsapp_media"
          className="p-2 rounded-full hover:bg-white/10 transition"
          title="Descargar archivo"
        >
          <Download size={22} />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition"
          title="Cerrar"
        >
          <X size={24} />
        </button>
      </div>

      <div className="max-w-4xl max-h-[85vh] flex items-center justify-center">
        {type === 'image' ? (
          <img src={url} alt="Media" className="max-w-full max-h-[85vh] object-contain rounded" />
        ) : (
          <video src={url} controls autoPlay className="max-w-full max-h-[85vh] rounded" />
        )}
      </div>
    </div>
  );
};
