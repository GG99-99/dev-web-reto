/**
 * Minimal single-page PDF (Helvetica, WinAnsi) with no extra dependency.
 * Text is stored as PDF literal strings so the file starts with `%PDF-`.
 */

function pdfEscape(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      out += ch;
      continue;
    }
    if (code >= 160 && code <= 255) {
      out += `\\${code.toString(8).padStart(3, '0')}`;
      continue;
    }
    out += '?';
  }
  return out;
}

function wrapLine(value: string, width = 90): string[] {
  const text = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const wrapped: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      wrapped.push('');
      continue;
    }
    let rest = paragraph;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(' ', width);
      if (cut < 24) cut = width;
      wrapped.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    wrapped.push(rest);
  }
  return wrapped;
}

export function buildSimplePdf(lines: string[]): Buffer {
  const wrapped = lines.flatMap((line) => wrapLine(line));
  const content = ['BT', '/F1 11 Tf', '48 760 Td', '14 TL'];
  wrapped.forEach((line, index) => {
    const shown = `(${pdfEscape(line)})`;
    content.push(index === 0 ? `${shown} Tj` : `${shown} '`);
  });
  content.push('ET');
  const stream = Buffer.from(content.join('\n'), 'latin1');

  const objects = [
    Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'latin1'),
    Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 'latin1'),
    Buffer.from(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
      'latin1',
    ),
    Buffer.concat([
      Buffer.from(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
      stream,
      Buffer.from('\nendstream\nendobj\n', 'latin1'),
    ]),
    Buffer.from('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n', 'latin1'),
  ];

  const header = Buffer.from('%PDF-1.4\n', 'latin1');
  const chunks: Buffer[] = [header];
  const offsets: number[] = [];
  let cursor = header.length;
  for (const object of objects) {
    offsets.push(cursor);
    chunks.push(object);
    cursor += object.length;
  }

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}
