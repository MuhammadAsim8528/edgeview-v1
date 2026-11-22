export function protectSpreadsheetText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
