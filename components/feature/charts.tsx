"use client";

import { useState, useRef, useCallback } from "react";

function formatChartTick(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}

function buildNiceTicks(min: number, max: number, targetTickCount = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (max <= min) return [max, min];

  const roughStep = (max - min) / Math.max(1, targetTickCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(roughStep, 1))));
  const residual = roughStep / magnitude;
  const niceStep =
    residual <= 1 ? magnitude :
    residual <= 2 ? 2 * magnitude :
    residual <= 5 ? 5 * magnitude :
    10 * magnitude;

  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];

  for (let value = niceMin; value <= niceMax + niceStep / 2; value += niceStep) {
    ticks.push(Number(value.toFixed(6)));
  }

  return ticks.reverse();
}

/* ─── Bar chart (no interaction needed) ─────────────────────── */
export function MiniBarChart({
  values,
  minValue,
  maxValue,
  title,
  showValueLabels = false,
}: {
  values: number[];
  minValue?: number;
  maxValue?: number;
  title?: string;
  showValueLabels?: boolean;
}) {
  const width = 320;
  const height = 140;
  const min = minValue ?? Math.min(0, ...values, 0);
  const max = maxValue ?? Math.max(0, ...values, 1);
  const range = Math.max(1, max - min);
  const zeroY = ((max - 0) / range) * height;
  const barSlot = width / Math.max(1, values.length);
  const barWidth = Math.max(8, barSlot * 0.65);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full rounded-2xl bg-[var(--surface)] p-2" role="img" aria-label={title ?? "Bar chart"}>
      {title ? <title>{title}</title> : null}
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      {values.map((value, idx) => {
        const x = idx * barSlot + (barSlot - barWidth) / 2;
        const valueY = ((max - value) / range) * height;
        const rectY = value >= 0 ? valueY : zeroY;
        const rectHeight = Math.max(2, Math.abs(zeroY - valueY));
        const labelY = value >= 0 ? rectY - 4 : rectY + rectHeight + 12;
        return (
          <g key={`${idx}-${value}`}>
            <rect x={x} y={rectY} width={barWidth} height={rectHeight} rx="4" fill={value >= 0 ? "var(--accent)" : "var(--danger)"} opacity={0.85} />
            {showValueLabels && Math.abs(value) > 0 ? (
              <text x={x + barWidth / 2} y={labelY} textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.65)" fontWeight="500">
                {Math.round(value)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Interactive line chart ─────────────────────────────────── */
export function MiniLineChart({
  values,
  secondValues,
  plannedValues,
  plannedLabel = "Plan",
  minValue,
  maxValue,
  xLabels,
  yTicks,
  showPointLabels = false,
  title,
  legend,
}: {
  values: number[];
  secondValues?: number[];
  /** Optional reference series (e.g. expected spend/day) drawn as a dashed line. */
  plannedValues?: number[];
  plannedLabel?: string;
  minValue?: number;
  maxValue?: number;
  xLabels?: string[];
  yTicks?: number[];
  showPointLabels?: boolean;
  title?: string;
  legend?: [string, string?];
}) {
  const W = 440;
  const H = 260;
  const ML = 40;
  const MR = 12;
  const MT = 28;
  const MB = 36;
  const CW = W - ML - MR;
  const CH = H - MT - MB;

  const allValues = [...values, ...(secondValues ?? []), ...(plannedValues ?? [])];
  const baseMin = minValue ?? Math.min(...allValues, 0);
  const baseMax = maxValue ?? Math.max(...allValues, 1);
  const baseRange = Math.max(1, baseMax - baseMin);
  const min = Math.min(baseMin, 0);
  const max = baseMax + baseRange * 0.12;
  const range = Math.max(1, max - min);
  const defaultTicks = buildNiceTicks(min, max, 5);
  const ticks = (yTicks && yTicks.length > 0 ? [...yTicks].sort((a, b) => b - a) : defaultTicks).filter((v, i, a) => a.indexOf(v) === i);

  const toY = (v: number) => MT + (1 - (v - min) / range) * CH;
  const toX = (i: number) => ML + (i / Math.max(1, values.length - 1)) * CW;

  // Build SVG polyline point strings
  const points1 = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const points2 = (secondValues ?? []).map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const pointsPlanned = (plannedValues ?? []).map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  // Area fill under primary line
  const area1 =
    values.length > 1
      ? `${points1} ${toX(values.length - 1)},${MT + CH} ${toX(0)},${MT + CH}`
      : "";

  const [hovered, setHovered] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const touchClearRef = useRef<number | null>(null);

  const resolveIndex = useCallback(
    (clientX: number): number => {
      // Measure against the SVG's own box, not the wrapper. With
      // preserveAspectRatio="none" the viewBox maps linearly onto that box, so
      // this lands on the data point directly under the pointer (the old code
      // measured the wrapper and assumed the SVG filled it, which it didn't —
      // taps landed on the wrong point).
      const el = svgRef.current ?? wrapRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const relX = ((clientX - rect.left) / rect.width) * W;
      const raw = Math.round(((relX - ML) / CW) * (values.length - 1));
      return Math.max(0, Math.min(values.length - 1, raw));
    },
    [values.length, W, ML, CW]
  );

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (touchClearRef.current) window.clearTimeout(touchClearRef.current);
    setHovered(resolveIndex(e.clientX));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (touchClearRef.current) window.clearTimeout(touchClearRef.current);
    setHovered(resolveIndex(e.clientX));
  }

  function handlePointerLeave(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") {
      // On touch: keep tooltip visible for 1.8s so users can read it after tapping
      touchClearRef.current = window.setTimeout(() => setHovered(null), 1800);
    } else {
      setHovered(null);
    }
  }

  // Tooltip position
  const tooltipIdx = hovered ?? null;
  const tooltipX = tooltipIdx !== null ? toX(tooltipIdx) : 0;
  const tooltipY = tooltipIdx !== null ? toY(values[tooltipIdx] ?? 0) : 0;
  // Keep tooltip inside SVG bounds
  const tooltipLeft = tooltipX / W; // as fraction

  return (
    <div className="space-y-1">
      <div
        ref={wrapRef}
        className="relative select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ touchAction: "pan-y" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="aspect-[440/260] h-auto w-full rounded-2xl bg-[var(--surface)]"
          role="img"
          aria-label={title ?? "Line chart"}
          style={{ display: "block" }}
        >
          {title ? <title>{title}</title> : null}

          {/* Gradient fills */}
          <defs>
            <linearGradient id="area1-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="line1-stroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="line2-stroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={ML} y1={toY(tick)} x2={ML + CW} y2={toY(tick)} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
              <text x={ML - 6} y={toY(tick) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                {formatChartTick(tick)}
              </text>
            </g>
          ))}

          {/* Area fills */}
          {area1 ? <polygon points={area1} fill="url(#area1-fill)" className="chart-area-animate" /> : null}

          {/* Plan reference line — dashed, behind the real series */}
          {plannedValues && plannedValues.length > 0 ? (
            <polyline
              points={pointsPlanned}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.75"
            />
          ) : null}

          {/* Lines */}
          <polyline
            points={points1}
            fill="none"
            stroke="url(#line1-stroke)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="chart-line-primary"
          />
          {secondValues && secondValues.length > 0 ? (
            <polyline
              points={points2}
              fill="none"
              stroke="url(#line2-stroke)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="chart-line-secondary"
            />
          ) : null}

          {/* Static dots */}
          {values.map((v, i) => (
            <g key={`d1-${i}`}>
              <circle
                cx={toX(i)}
                cy={toY(v)}
                r={hovered === i ? 5.5 : 3.5}
                fill="#2563eb"
                opacity={hovered === i ? 1 : 0.88}
                className={hovered === i ? undefined : "chart-dot-animate"}
                style={hovered === i ? undefined : { animationDelay: `${i * 90}ms` }}
              />
              {showPointLabels ? (
                <text x={toX(i)} y={toY(v) - 8} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">
                  {formatChartTick(v)}
                </text>
              ) : null}
              {xLabels?.[i] ? (
                <text x={toX(i)} y={H - 10} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                  {xLabels[i]}
                </text>
              ) : null}
            </g>
          ))}
          {secondValues?.map((v, i) => (
            <circle
              key={`d2-${i}`}
              cx={toX(i)}
              cy={toY(v)}
              r={hovered === i ? 5.5 : 3.5}
              fill="#f97316"
              opacity={hovered === i ? 1 : 0.88}
              className={hovered === i ? undefined : "chart-dot-animate"}
              style={hovered === i ? undefined : { animationDelay: `${i * 90 + 120}ms` }}
            />
          ))}

          {/* Hover crosshair */}
          {tooltipIdx !== null ? (
            <line
              x1={tooltipX} y1={MT}
              x2={tooltipX} y2={MT + CH}
              stroke="rgba(148,163,184,0.48)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          ) : null}
        </svg>

        {/* Floating tooltip */}
        {tooltipIdx !== null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[100px] rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 py-2 text-xs text-[color:var(--text-primary)] shadow-lg backdrop-blur-sm"
            style={{
              left: `clamp(4px, ${tooltipLeft * 100}%, calc(100% - 112px))`,
              top: `${(tooltipY / H) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            {xLabels?.[tooltipIdx] ? (
              <p className="font-semibold text-[color:var(--text-secondary)]">{xLabels[tooltipIdx]}</p>
            ) : null}
            <p className="mt-0.5 font-semibold text-sky-500">
              {legend?.[0] ?? "Value"}: {values[tooltipIdx]?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            {secondValues?.[tooltipIdx] !== undefined ? (
              <p className="mt-0.5 font-semibold text-orange-500">
                {legend?.[1] ?? "2nd"}: {secondValues[tooltipIdx].toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            ) : null}
            {plannedValues?.[tooltipIdx] !== undefined ? (
              <p className="mt-0.5 font-semibold text-violet-500">
                {plannedLabel}: {plannedValues[tooltipIdx].toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Legend */}
      {legend ? (
        <div className="flex flex-wrap gap-3 px-1">
          <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)]">
            <span className="inline-block h-2 w-5 rounded-full bg-sky-500" />
            {legend[0]}
          </span>
          {legend[1] ? (
            <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)]">
              <span className="inline-block h-2 w-5 rounded-full bg-orange-500" />
              {legend[1]}
            </span>
          ) : null}
          {plannedValues && plannedValues.length > 0 ? (
            <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)]">
              <span className="inline-block h-0.5 w-5 rounded-full border-t-2 border-dashed border-violet-500" />
              {plannedLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
