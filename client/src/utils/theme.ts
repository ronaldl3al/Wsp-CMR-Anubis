export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  chatBg: string;
  navBg: string;
  sidebarBg: string;
  bubbleMe: string;
  accent: string;
}

export const THEME_PRESETS: ThemeConfig[] = [
  {
    id: 'whatsapp-dark',
    name: 'WhatsApp Dark',
    description: 'Estilo original oscuro de WhatsApp Web',
    chatBg: '#0b141a',
    navBg: '#202c33',
    sidebarBg: '#111b21',
    bubbleMe: '#005c4b',
    accent: '#00a884'
  },
  {
    id: 'anubis-gold',
    name: 'Anubis Gold (#10232A)',
    description: 'Diseño exclusivo Anubis en azul petróleo y destellos dorados',
    chatBg: '#10232A',
    navBg: '#142d36',
    sidebarBg: '#0c1b20',
    bubbleMe: '#1c3d47',
    accent: '#cda250'
  },
  {
    id: 'midnight-cyber',
    name: 'Midnight Cyber',
    description: 'Azul profundo nocturno con acentos cian eléctricos',
    chatBg: '#0d1117',
    navBg: '#161b22',
    sidebarBg: '#090d13',
    bubbleMe: '#1f6feb',
    accent: '#58a6ff'
  },
  {
    id: 'onyx-black',
    name: 'Onyx Pure Black',
    description: 'Negro absoluto para ahorro de energía en pantallas OLED',
    chatBg: '#000000',
    navBg: '#121212',
    sidebarBg: '#080808',
    bubbleMe: '#1c2430',
    accent: '#22c55e'
  },
  {
    id: 'whatsapp-light',
    name: 'WhatsApp Light',
    description: 'Tema claro clásico con fondo marfil y detalles verdes',
    chatBg: '#efeae2',
    navBg: '#f0f2f5',
    sidebarBg: '#ffffff',
    bubbleMe: '#d9fdd3',
    accent: '#00a884'
  }
];

const THEME_STORAGE_KEY = 'wsp_custom_theme';

export function getSavedTheme(): ThemeConfig {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.chatBg) {
        return parsed;
      }
    }
  } catch {}
  return THEME_PRESETS[0];
}

export function applyTheme(theme: ThemeConfig) {
  try {
    const root = document.documentElement;
    root.style.setProperty('--color-bg-chat', theme.chatBg);
    root.style.setProperty('--color-bg-nav', theme.navBg);
    root.style.setProperty('--color-bg-sidebar', theme.sidebarBg);
    root.style.setProperty('--color-bubble-me', theme.bubbleMe);
    root.style.setProperty('--color-accent', theme.accent);

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (e) {
    console.error('Failed to apply theme:', e);
  }
}
