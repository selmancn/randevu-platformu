export type ReportRange = { from: string; to: string };
type Params = { baslangic?: unknown; bitis?: unknown; donem?: unknown };
const dayMs = 86_400_000;
const dateString = (date: number) => new Date(date).toISOString().slice(0, 10);

export function reportRange(params: Params, now = new Date()): ReportRange {
  const today = dateString(+now + 3 * 3600_000);
  if (params.baslangic !== undefined || params.bitis !== undefined) {
    const from = params.baslangic;
    const to = params.bitis;
    function valid(value: unknown): value is string {
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) && dateString(Date.parse(value)) === value;
    }
    if (!valid(from) || !valid(to) || from > to || to > today || Date.parse(to) - Date.parse(from) >= 366 * dayMs) {
      throw new RangeError('Bugüne kadar uzanan, en fazla 366 günlük geçerli bir tarih aralığı seç.');
    }
    return { from, to };
  }
  if (params.donem === 'gun') return { from: today, to: today };
  if (params.donem === '7' || params.donem === '30') {
    return { from: dateString(Date.parse(today) - (Number(params.donem) - 1) * dayMs), to: today };
  }
  return { from: today.slice(0, 8) + '01', to: today };
}

export function reportDays({ from, to }: ReportRange) {
  return Array.from({ length: (Date.parse(to) - Date.parse(from)) / dayMs + 1 },
    (_, index) => dateString(Date.parse(from) + index * dayMs));
}
