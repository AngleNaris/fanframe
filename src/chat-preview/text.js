export function decodeText(bytes) {
  const bomLE = bytes[0] === 0xff && bytes[1] === 0xfe;
  const bomBE = bytes[0] === 0xfe && bytes[1] === 0xff;
  const text = new TextDecoder(bomLE ? 'utf-16le' : bomBE ? 'utf-16be' : 'utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw new TypeError('Not text');
  return text;
}

export function parseTable(text, delimiter, { maxRows = 200, maxCols = 64 } = {}) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false, cols = 0, truncated = false;
  function finishField() {
    if (cols < maxCols) row.push(field);
    else truncated = true;
    cols++;
    field = '';
    closed = false;
  }
  function finishRow() {
    finishField();
    rows.push(row);
    row = [];
    cols = 0;
  }
  for (let i = 0; i < text.length; i++) {
    if (rows.length === maxRows) return { rows, truncated: true };
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === delimiter) {
      finishField();
    } else if (ch === '\r' || ch === '\n') {
      finishRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else if (closed || (ch === '"' && field !== '')) {
      throw new TypeError('Malformed field');
    } else if (ch === '"') {
      quoted = true;
    } else {
      field += ch;
    }
  }
  if (quoted) throw new TypeError('Unclosed quoted field');
  if (field || closed || cols) finishRow();
  return { rows, truncated };
}
