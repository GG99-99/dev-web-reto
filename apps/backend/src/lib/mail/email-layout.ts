/**
 * Shared HTML layout for operational mail. Inline styles only, so the
 * message still looks intact in Gmail and Outlook.
 */

export type DetailTone = 'default' | 'high' | 'medium' | 'low';

export interface EmailDetail {
  label: string;
  value: string;
  tone?: DetailTone;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function priorityLabel(priority?: string | null): string {
  if (priority === 'ALTA') return 'High';
  if (priority === 'BAJA') return 'Low';
  if (priority === 'MEDIA') return 'Medium';
  return priority?.trim() || 'Medium';
}

export function priorityTone(priority?: string | null): DetailTone {
  if (priority === 'ALTA') return 'high';
  if (priority === 'BAJA') return 'low';
  return 'medium';
}

function toneStyle(tone?: DetailTone): string | null {
  if (tone === 'high') return 'background:#fee2e2;color:#b91c1c;';
  if (tone === 'medium') return 'background:#fef3c7;color:#b45309;';
  if (tone === 'low') return 'background:#dcfce7;color:#15803d;';
  return null;
}

export function renderOperationalEmail(options: {
  heading: string;
  paragraphs: string[];
  details?: EmailDetail[];
  /** Optional branded button. Only http(s) links are rendered. */
  action?: { label: string; href: string };
  footnote?: string;
}): string {
  const paragraphs = options.paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">${escapeHtml(paragraph)}</p>`,
    )
    .join('');

  const rows = (options.details ?? [])
    .filter((row) => row.value.trim())
    .map((row) => {
      const pill = toneStyle(row.tone);
      const value = pill
        ? `<span style="display:inline-block;${pill}padding:3px 10px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;">${escapeHtml(row.value)}</span>`
        : `<span style="color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(row.value)}</span>`;
      return `<tr>
        <td style="padding:9px 14px 9px 0;width:140px;color:#64748b;font-size:13px;font-weight:700;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:9px 0;vertical-align:top;">${value}</td>
      </tr>`;
    })
    .join('');

  const details = rows
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:10px;">
        <tr><td style="padding:6px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>
      </table>`
    : '';

  const actionHref = options.action?.href.trim() ?? '';
  const actionLabel = options.action?.label.trim() ?? '';
  const action =
    actionLabel && /^https?:\/\//i.test(actionHref)
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;">
          <tr>
            <td style="border-radius:8px;background:#00236f;">
              <a href="${escapeHtml(actionHref)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;border-radius:8px;">${escapeHtml(actionLabel)}</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#64748b;">If the button does not open, copy this link into your browser:<br><a href="${escapeHtml(actionHref)}" style="color:#167eba;word-break:break-all;">${escapeHtml(actionHref)}</a></p>`
      : '';

  const footnote = options.footnote?.trim()
    ? `<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">${escapeHtml(options.footnote.trim())}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:#eef3f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #d5e0ee;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#00236f;padding:22px 28px;">
            <div style="color:#ffffff;font-size:18px;font-weight:800;">RADAR Sanitary</div>
            <div style="color:#b9d4f5;font-size:12px;margin-top:4px;">Sanitary surveillance and risk-based evaluation</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 22px;">
            <h1 style="margin:0 0 16px;color:#00236f;font-size:20px;line-height:1.35;font-weight:800;">${escapeHtml(options.heading)}</h1>
            ${paragraphs}
            ${details}
            ${action}
            ${footnote}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;text-align:center;">
            Dominican Republic · Ministry of Public Health and Social Assistance (MISPAS)
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
