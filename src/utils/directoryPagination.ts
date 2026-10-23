export function directoryPage<T>(sections: readonly { country: string; importers: readonly T[] }[], requested: number, pageSize = 100) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError('Invalid directory page size');
  const totalRows = sections.reduce((sum, section) => sum + section.importers.length, 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 1));
  const startIndex = (page - 1) * pageSize;
  const result: Array<{ country: string; importers: T[]; totalImporters: number }> = [];
  let skipped = 0;
  let remaining = pageSize;
  for (const section of sections) {
    if (!remaining) break;
    const offset = Math.max(0, startIndex - skipped);
    skipped += section.importers.length;
    if (offset >= section.importers.length) continue;
    const rows = section.importers.slice(offset, offset + remaining);
    if (rows.length) result.push({ country: section.country, importers: rows, totalImporters: section.importers.length });
    remaining -= rows.length;
  }
  return { page, totalPages, totalRows, start: totalRows ? startIndex + 1 : 0, end: Math.min(totalRows, startIndex + pageSize), sections: result };
}
