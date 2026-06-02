export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || typeof n !== 'number' || isNaN(n)) {
    return 'Unavailable';
  }
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const y = dateStr.slice(0, 4), mo = dateStr.slice(4, 6), d = dateStr.slice(6, 8);
  return new Date(`${y}-${mo}-${d}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatEngagement(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || typeof rate !== 'number' || isNaN(rate)) {
    return 'Engagement unavailable';
  }
  return rate.toFixed(2) + '%';
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch { return false; }
}
