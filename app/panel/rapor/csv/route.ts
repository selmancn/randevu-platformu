import { getCatalog } from '../../../../lib/database';
import { sessionToken } from '../../../actions';
import { reportRange } from '../../../../lib/report-range';

function cell(text: string) {
  const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function GET(request: Request) {
  const token = await sessionToken();
  const catalog = await getCatalog();
  if (!await catalog.owner(token)) return new Response(null, { status: 401 });
  let range;
  try {
    range = reportRange(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Response(error.message, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const report = await catalog.finance(token, range, true);
  const lines = ['"Tarih";"Tür";"Açıklama";"Tutar (kuruş)"'];
  for (const entry of report.rows) {
    lines.push([new Date(entry.recorded_at).toISOString(), entry.kind, entry.label, String(entry.amount)].map(cell).join(';'));
  }
  return new Response('\uFEFF' + lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="randevu-rapor.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}
