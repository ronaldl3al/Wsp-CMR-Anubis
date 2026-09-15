import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Returns a WhatsApp-style date header label for a given message timestamp (in seconds or ms).
 * E.g.: "HOY", "AYER", "HACE 3 DÍAS", "12 DE SEPTIEMBRE DE 2026"
 */
export function getWhatsAppDateLabel(timestamp: number): string {
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  const now = new Date();

  if (isToday(date)) {
    return 'HOY';
  }

  if (isYesterday(date)) {
    return 'AYER';
  }

  const daysAgo = differenceInCalendarDays(now, date);

  if (daysAgo >= 2 && daysAgo <= 6) {
    const dayName = format(date, 'EEEE', { locale: es }).toUpperCase();
    return `${dayName} (HACE ${daysAgo} DÍAS)`;
  }

  return format(date, "d 'DE' MMMM 'DE' yyyy", { locale: es }).toUpperCase();
}

/**
 * Checks if two timestamps fall on the same calendar day.
 */
export function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1 < 10000000000 ? ts1 * 1000 : ts1);
  const d2 = new Date(ts2 < 10000000000 ? ts2 * 1000 : ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
