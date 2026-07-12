export function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let row: string[] = []
  let inQuotes = false
  let currentValue = ''

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim())
      currentValue = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      row.push(currentValue.trim())
      if (row.some((value) => value !== '')) lines.push(row)
      row = []
      currentValue = ''
    } else {
      currentValue += char
    }
  }

  if (currentValue || row.length > 0) {
    row.push(currentValue.trim())
    if (row.some((value) => value !== '')) lines.push(row)
  }
  return lines
}

export function serializeCsvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}
