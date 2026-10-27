// Splits one CSV line. Handles "quoted, cells" because spreadsheet apps quote text that contains commas.
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  return [...cells, cell];
}
