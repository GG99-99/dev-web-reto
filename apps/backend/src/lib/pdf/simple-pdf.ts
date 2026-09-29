/**
 * Minimal single-page PDF (Helvetica, WinAnsi) with no extra dependency.
 * Text is stored as PDF literal strings so the file starts with `%PDF-`.
 * An optional QR is drawn as filled rectangles so a phone can scan it.
 */
import { qrModules } from '@/lib/documents/authenticity';

export interface SimplePdfOptions {
  /** When set, a scannable QR for this exact text is drawn at the bottom of the page. */
  qrText?: string;
}

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

function qrDrawing(text: string): { commands: string[]; top: number } {
  const modules = qrModules(text);
  const count = modules.length;
  const moduleSize = Math.min(3.4, 156 / count);
  const edge = count * moduleSize;
  const quiet = moduleSize * 4;
  const left = 48 + quiet;
  const bottom = 36 + quiet;
  const commands = ['q', '1 1 1 rg', `${(left - quiet).toFixed(2)} ${(bottom - quiet).toFixed(2)} ${(edge + quiet * 2).toFixed(2)} ${(edge + quiet * 2).toFixed(2)} re f`, '0 0 0 rg'];
  for (let row = 0; row < count; row += 1) {
    let col = 0;
    while (col < count) {
      if (!modules[row][col]) {
        col += 1;
        continue;
      }
      let end = col;
      while (end < count && modules[row][end]) end += 1;
      const x = left + col * moduleSize;
      const y = bottom + (count - 1 - row) * moduleSize;
      const width = (end - col) * moduleSize;
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${moduleSize.toFixed(2)} re f`);
      col = end;
    }
  }
  commands.push('Q');
  return { commands, top: bottom + edge + quiet + 18 };
}

export function buildSimplePdf(lines: string[], options?: SimplePdfOptions): Buffer {
  const wrapped = lines.flatMap((line) => wrapLine(line));
  const qr = options?.qrText ? qrDrawing(options.qrText) : null;
  const startY = 760;
  const leading = 14;
  const limit = qr ? Math.max(8, Math.floor((startY - qr.top) / leading)) : wrapped.length;
  const visible = wrapped.slice(0, limit);
  const content = ['BT', '/F1 11 Tf', `48 ${startY} Td`, `${leading} TL`];
  visible.forEach((line, index) => {
    const shown = `(${pdfEscape(line)})`;
    content.push(index === 0 ? `${shown} Tj` : `${shown} '`);
  });
  content.push('ET');
  if (qr) content.push(...qr.commands);
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
