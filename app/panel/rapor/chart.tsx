'use client';

import { useEffect, useRef, useState } from 'react';

const metrics = {
  sale: { label: 'Ciro', color: '#146b59' },
  payment: { label: 'Tahsilat', color: '#4265c2' },
  expense: { label: 'Gider', color: '#bf6140' },
  refund: { label: 'İade', color: '#8c549d' },
} as const;
type Metric = keyof typeof metrics;
export type ReportPoint = { day: string } & Record<Metric, number>;
const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
const shortMoney = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1, style: 'currency', currency: 'TRY' });
const date = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatDate = (day: string) => date.format(new Date(day));
const keys = Object.keys(metrics) as Metric[];
const defaults: Metric[] = ['sale', 'payment', 'expense'];

export function ReportChart({ points }: { points: ReportPoint[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<Metric[]>(defaults);
  const [index, setIndex] = useState<number | null>(null);
  const selected = index === null ? null : points[Math.min(index, points.length - 1)];
  const hasActivity = points.some((point) => keys.some((key) => point[key] !== 0));

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    function draw() {
      if (!element) return;
      const width = element.getBoundingClientRect().width;
      const height = element.getBoundingClientRect().height;
      const context = element.getContext('2d');
      if (!context || !width || !height) return;
      const scale = window.devicePixelRatio || 1;
      element.width = Math.round(width * scale);
      element.height = Math.round(height * scale);
      context.scale(scale, scale);
      const left = width < 420 ? 51 : 64;
      const right = width - 18;
      const top = 16;
      const bottom = height - 42;
      const maximum = Math.max(100, ...points.flatMap((point) => active.map((key) => point[key])));
      const power = 10 ** Math.floor(Math.log10(maximum));
      const ceiling = Math.ceil(maximum / (power / 2)) * power / 2;
      const x = (i: number) => points.length === 1 ? (left + right) / 2 : left + (right - left) * i / (points.length - 1);
      const y = (value: number) => bottom - (bottom - top) * value / ceiling;
      context.font = '12px system-ui';
      for (let i = 0; i <= 4; i++) {
        const value = ceiling * i / 4;
        context.strokeStyle = '#e6ebe8';
        context.beginPath();
        context.moveTo(left, y(value));
        context.lineTo(right, y(value));
        context.stroke();
        context.fillStyle = '#52675e';
        context.textAlign = 'right';
        context.fillText(shortMoney.format(value / 100), left - 9, y(value) + 4, left - 11);
      }
      const labels = Math.min(points.length, width < 480 ? 4 : 7);
      for (let i = 0; i < labels; i++) {
        const step = labels === 1 ? 0 : Math.round(i * (points.length - 1) / (labels - 1));
        context.textAlign = i === labels - 1 && labels > 1 ? 'right' : 'left';
        context.fillText(formatDate(points[step].day), x(step), bottom + 24, 67);
      }
      const currentIndex = selected ? points.indexOf(selected) : -1;
      if (currentIndex >= 0) {
        context.strokeStyle = '#a6b5ae';
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(x(currentIndex), top);
        context.lineTo(x(currentIndex), bottom);
        context.stroke();
        context.setLineDash([]);
      }
      for (const key of active) {
        context.strokeStyle = metrics[key].color;
        context.fillStyle = metrics[key].color;
        context.lineWidth = 2.5;
        context.beginPath();
        points.forEach((point, position) => {
          if (position === 0) context.moveTo(x(position), y(point[key]));
          else context.lineTo(x(position), y(point[key]));
        });
        context.stroke();
        if (currentIndex >= 0 || points.length === 1) {
          const position = currentIndex >= 0 ? currentIndex : 0;
          context.beginPath();
          context.arc(x(position), y(points[position][key]), 4, 0, 2 * Math.PI);
          context.fill();
        }
      }
    }
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [points, active, selected]);

  return <section className="card analytics-chart">
    <header><h2>Gelir ve gider eğilimi</h2><p>Günlük işlem tutarları</p></header>
    <div className="metric-switches" aria-label="Grafik serileri">
      {keys.map((key) => <button type="button" key={key} aria-pressed={active.includes(key)}
        onClick={() => setActive((previous) => previous.includes(key)
          ? previous.length > 1 ? previous.filter((item) => item !== key) : previous
          : [...previous, key])}>
        <span style={{ backgroundColor: metrics[key].color }} />{metrics[key].label}
      </button>)}
    </div>
    {hasActivity ? <>
      <canvas ref={canvas} role="img" aria-label="Seçilen tarih aralığındaki günlük gelir ve gider çizgi grafiği"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const left = bounds.width < 420 ? 51 : 64;
          const ratio = (event.clientX - bounds.left - left) / (bounds.width - left - 18);
          setIndex(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
        }} />
      <label className="chart-day">Grafikteki gün
        <select value={selected?.day ?? ''} onChange={(event) => setIndex(event.target.value
          ? points.findIndex((point) => point.day === event.target.value) : null)}>
          <option value="">Gün seç</option>
          {points.map((point) => <option key={point.day} value={point.day}>{formatDate(point.day)}</option>)}
        </select>
      </label>
      {selected && <div className="chart-values"><strong>{formatDate(selected.day)}</strong>{active.map((key) => (
        <span key={key}>{metrics[key].label} <b>{money.format(selected[key] / 100)}</b></span>
      ))}</div>}
    </> : <p className="chart-empty">Bu aralıkta grafik için işlem kaydı yok.</p>}
  </section>;
}
