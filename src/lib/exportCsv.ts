export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

/** Escapes a cell per RFC 4180 — only quotes when the value actually needs it. */
function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map(c => escapeCsvCell(c.header)).join(',')]
  for (const row of rows) {
    lines.push(columns.map(c => escapeCsvCell(String(c.value(row) ?? ''))).join(','))
  }
  return lines.join('\r\n')
}

/** Client-side download — the table is already loaded, so there's no round trip to build the file. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportRowsAsCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  downloadCsv(filename, toCsv(rows, columns))
}
