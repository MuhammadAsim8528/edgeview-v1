/** Fixed local deployment limits; input bytes do not bound padded row objects. */
export const TEXT_PARSE_LIMITS = Object.freeze({ columns: 512, rows: 100_000, cells: 2_000_000 });
export class TextParseLimitError extends Error {
  constructor() { super('Text table exceeds safe parsing limits (512 columns, 100000 rows or 2000000 materialized cells). Split the file before importing.'); this.name = 'TextParseLimitError'; }
}
export function checkTextColumnCount(count: number): void {
  if (count > TEXT_PARSE_LIMITS.columns) throw new TextParseLimitError();
}
export class TextParseBudget {
  private rows = 0;
  private cells = 0;
  addRow(width: number): void {
    checkTextColumnCount(width);
    // Reserve fixed room for parser defaults and normalized aliases. Check
    // before constructing each object; no partial table escapes on failure.
    const cost = width + 24;
    if (this.rows + 1 > TEXT_PARSE_LIMITS.rows || this.cells + cost > TEXT_PARSE_LIMITS.cells) throw new TextParseLimitError();
    this.rows++;
    this.cells += cost;
  }
}
