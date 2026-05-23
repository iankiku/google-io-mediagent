"use client";

import { useMemo, useState } from "react";
import type { MetricDetail, MetricSeriesPoint, MetricTone } from "./metric-detail";

const TONE_STROKE: Record<MetricTone, string> = {
  lilac: "var(--zoe-lilac)",
  mint: "var(--zoe-mint)",
  coral: "var(--zoe-coral)",
  amber: "var(--zoe-amber)",
};

const TONE_FILL: Record<MetricTone, string> = {
  lilac: "color-mix(in oklab, var(--zoe-lilac) 70%, white)",
  mint: "color-mix(in oklab, var(--zoe-mint) 70%, white)",
  coral: "color-mix(in oklab, var(--zoe-coral) 70%, white)",
  amber: "color-mix(in oklab, var(--zoe-amber) 70%, white)",
};

const W = 520;
const H = 220;
const PAD_L = 32;
const PAD_R = 16;
const PAD_T = 36;
const PAD_B = 30;

export function MetricBarChart({ detail }: { detail: MetricDetail }) {
  const [hover, setHover] = useState<number | null>(null);
  const { series, tone, valueFormatter } = detail;
  const fmt = valueFormatter ?? ((n: number) => String(n));

  const { min, range } = useMemo(() => {
    const vals = series.map((p) => p.value);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const span = rawMax - rawMin || Math.abs(rawMax) || 1;
    const headroom = span * 0.25;
    const lo = rawMin - headroom * 0.4;
    const hi = rawMax + headroom;
    return { min: lo, range: hi - lo };
  }, [series]);

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const step = innerW / series.length;
  const barW = step * 0.42;

  const trend = useMemo(() => {
    // simple least-squares fit for dashed trend line
    const n = series.length;
    const xs = series.map((_, i) => i);
    const ys = series.map((p) => p.value);
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxy = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sxx = xs.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sxx - sx * sx || 1;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    return xs.map((x) => intercept + slope * x);
  }, [series]);

  const y = (v: number) => PAD_T + innerH - ((v - min) / range) * innerH;
  const x = (i: number) => PAD_L + step * i + step / 2;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full h-auto"
        role="img"
        aria-label={`${detail.name} over the last ${series.length} days`}
      >
        {/* Subtle baseline grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={PAD_T + innerH * t}
            y2={PAD_T + innerH * t}
            stroke="currentColor"
            strokeOpacity={0.06}
            strokeWidth={1}
          />
        ))}

        {/* Bars */}
        {series.map((p: MetricSeriesPoint, i) => {
          const isHover = hover === i;
          const top = y(p.value);
          const bottom = PAD_T + innerH;
          const cx = x(i);
          return (
            <g
              key={p.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              style={{ cursor: "pointer" }}
            >
              {/* hit target */}
              <rect
                x={cx - step / 2}
                y={PAD_T}
                width={step}
                height={innerH + PAD_B}
                fill="transparent"
              />
              {/* delta annotation */}
              <text
                x={cx}
                y={top - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill={
                  p.delta === 0
                    ? "color-mix(in oklab, currentColor 45%, transparent)"
                    : p.delta > 0
                    ? TONE_STROKE[tone]
                    : "var(--zoe-coral)"
                }
              >
                {p.delta === 0
                  ? "—"
                  : (p.delta > 0 ? "+" : "") + fmt(p.delta)}
              </text>
              {/* bar */}
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={bottom - top}
                rx={4}
                fill={TONE_FILL[tone]}
                opacity={isHover ? 1 : 0.85}
              />
              {/* x-axis label */}
              <text
                x={cx}
                y={H - 10}
                textAnchor="middle"
                fontSize={10}
                fontWeight={500}
                fill="color-mix(in oklab, currentColor 50%, transparent)"
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Dashed trend line on top */}
        <polyline
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinecap="round"
          points={trend.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        />
        {/* Trend endpoint dots */}
        <circle cx={x(0)} cy={y(trend[0])} r={2.5} fill={TONE_STROKE[tone]} />
        <circle
          cx={x(series.length - 1)}
          cy={y(trend[trend.length - 1])}
          r={2.5}
          fill={TONE_STROKE[tone]}
        />
      </svg>

      {/* Hover tooltip */}
      {hover !== null && (
        <Tooltip
          point={series[hover]}
          unit={detail.unit}
          fmt={fmt}
          xPct={((PAD_L + step * hover + step / 2) / W) * 100}
        />
      )}

      {/* Legend strip */}
      <div className="mt-3 flex items-center gap-4 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-[2px]"
            style={{ background: TONE_FILL[tone] }}
          />
          Daily
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-px"
            style={{
              background: TONE_STROKE[tone],
              boxShadow: `0 -1px 0 ${TONE_STROKE[tone]}, 0 1px 0 ${TONE_STROKE[tone]}`,
            }}
          />
          Trend
        </span>
      </div>
    </div>
  );
}

function Tooltip({
  point,
  unit,
  fmt,
  xPct,
}: {
  point: MetricSeriesPoint;
  unit: string;
  fmt: (n: number) => string;
  xPct: number;
}) {
  return (
    <div
      className="pointer-events-none absolute -top-1 -translate-x-1/2 -translate-y-full rounded-lg bg-foreground text-background px-2.5 py-1.5 text-[11px] leading-tight shadow-[0_4px_16px_-4px_rgba(20,20,40,0.35)]"
      style={{ left: `${xPct}%` }}
    >
      <div className="font-semibold">{point.label}</div>
      <div className="opacity-80">
        {fmt(point.value)} {unit}
        {point.delta !== 0 && (
          <span
            className="ml-1.5 font-semibold"
            style={{
              color:
                point.delta > 0
                  ? "color-mix(in oklab, var(--zoe-mint) 80%, white)"
                  : "color-mix(in oklab, var(--zoe-coral) 80%, white)",
            }}
          >
            {point.delta > 0 ? "+" : ""}
            {fmt(point.delta)}
          </span>
        )}
      </div>
    </div>
  );
}
