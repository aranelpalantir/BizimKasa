/**
 * Tarih ve zaman biçimlendirme yardımcı fonksiyonları.
 * Son değişiklik zamanı (Last Modified) takibi ve cihazlar arası karşılaştırma için kullanılır.
 */

export function formatLastModified(isoString?: string): string {
  if (!isoString) return 'Henüz işlem yok';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Bilinmiyor';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  // Gelecek tarih durumunda (cihazlar arası saat farkı veya saat ayarı)
  if (diffMs < -60000) {
    return formatFullDateTime(isoString);
  }

  // 1 dakika içinde
  if (diffSecs < 60 && diffSecs >= -60) {
    return 'Az önce';
  }

  // 1 saat içinde
  if (diffMins < 60) {
    return `${diffMins} dk önce`;
  }

  const isToday = 
    now.getDate() === date.getDate() &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear();

  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Bugün ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = 
    yesterday.getDate() === date.getDate() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getFullYear() === date.getFullYear();

  if (isYesterday) {
    return `Dün ${timeStr}`;
  }

  if (now.getFullYear() === date.getFullYear()) {
    const day = date.getDate();
    const month = date.toLocaleDateString('tr-TR', { month: 'short' });
    return `${day} ${month} ${timeStr}`;
  }

  const day = date.getDate();
  const month = date.toLocaleDateString('tr-TR', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year} ${timeStr}`;
}

export function formatMobileLastModified(isoString?: string): string {
  if (!isoString) return 'İşlem yok';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Bilinmiyor';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60 && diffSecs >= -60) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dk önce`;

  const isToday = 
    now.getDate() === date.getDate() &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear();

  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Bugün ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = 
    yesterday.getDate() === date.getDate() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getFullYear() === date.getFullYear();

  if (isYesterday) return `Dün ${timeStr}`;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month} ${timeStr}`;
}

export function formatFullDateTime(isoString?: string): string {
  if (!isoString) return 'Kayıt bulunmuyor';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Bilinmiyor';

  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * İki ISO zaman damgasını karşılaştırır (dateA vs dateB).
 * dateA dateB'den daha yeniyse 'newer', daha eskiyse 'older',
 * 2 saniyeden az fark varsa 'equal' döner.
 */
export function compareTimestamps(dateA?: string, dateB?: string): 'newer' | 'older' | 'equal' | 'unknown' {
  if (!dateA || !dateB) return 'unknown';
  const timeA = new Date(dateA).getTime();
  const timeB = new Date(dateB).getTime();
  if (isNaN(timeA) || isNaN(timeB)) return 'unknown';

  const diff = timeA - timeB;
  if (Math.abs(diff) < 2000) return 'equal';
  if (diff > 0) return 'newer';
  return 'older';
}
