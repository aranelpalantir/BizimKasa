export interface ThemeColorOption {
  hex: string;
  name: string;
}

export const ACCOUNT_THEME_COLORS: ThemeColorOption[] = [
  { hex: '#3b82f6', name: 'Mavi' },
  { hex: '#0284c7', name: 'Gök Mavisi' },
  { hex: '#06b6d4', name: 'Camgöbeği' },
  { hex: '#14b8a6', name: 'Deniz Yeşili' },
  { hex: '#10b981', name: 'Zümrüt Yeşili' },
  { hex: '#22c55e', name: 'Yeşil' },
  { hex: '#84cc16', name: 'Fıstık Yeşili' },
  { hex: '#eab308', name: 'Altın Sarısı' },
  { hex: '#f59e0b', name: 'Kehribar' },
  { hex: '#f97316', name: 'Turuncu' },
  { hex: '#ef4444', name: 'Kırmızı' },
  { hex: '#f43f5e', name: 'Gül Pembesi' },
  { hex: '#ec4899', name: 'Pembe' },
  { hex: '#d946ef', name: 'Fuşya' },
  { hex: '#a855f7', name: 'Mor' },
  { hex: '#8b5cf6', name: 'Menekşe' },
  { hex: '#6366f1', name: 'İndigo' },
  { hex: '#64748b', name: 'Kurşun Grisi' },
];

/**
 * Returns a human-friendly name for a color if recognized, or its hex code.
 */
export function getThemeColorName(hex: string): string {
  const normalized = hex.toLowerCase().trim();
  const found = ACCOUNT_THEME_COLORS.find(c => c.hex.toLowerCase() === normalized);
  return found ? found.name : hex.toUpperCase();
}

/**
 * Checks if a hex color is light to determine legible contrasting text.
 */
export function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150;
  }
  return false;
}
