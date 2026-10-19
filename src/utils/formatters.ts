export function formatNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1) + 'B';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1) + 'K';
  return sign + abs.toString();
}

export function formatCurrency(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  const formatted = formatNumber(num);
  if (formatted.startsWith('-')) {
    return '-$' + formatted.slice(1);
  }
  return '$' + formatted;
}

export function formatFullCurrency(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '$0.00';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
