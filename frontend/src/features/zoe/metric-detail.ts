export type MetricTone = "lilac" | "mint" | "coral" | "amber";

export type MetricId =
  | "hrv"
  | "resting-hr"
  | "sleep"
  | "basal-temp"
  | "respiratory"
  | "steps"
  | "ecg";

export interface MetricSeriesPoint {
  label: string;
  value: number;
  delta: number;
}

export interface MetricDetail {
  id: MetricId;
  name: string;
  unit: string;
  current: number;
  average: number;
  deltaPct: number;
  tone: MetricTone;
  series: MetricSeriesPoint[];
  source: string;
  updatedAgo: string;
  valueFormatter?: (n: number) => string;
}

const fmtOne = (n: number) => n.toFixed(1);
const fmtZero = (n: number) => Math.round(n).toLocaleString();
const fmtTemp = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

export const METRIC_DETAILS: Record<MetricId, MetricDetail> = {
  hrv: {
    id: "hrv",
    name: "Heart Rate Variability",
    unit: "ms",
    current: 64,
    average: 61,
    deltaPct: 5,
    tone: "mint",
    source: "Apple HealthKit",
    updatedAgo: "Synced 2 min ago",
    series: [
      { label: "Mon", value: 58, delta: 0 },
      { label: "Tue", value: 60, delta: 2 },
      { label: "Wed", value: 59, delta: -1 },
      { label: "Thu", value: 62, delta: 3 },
      { label: "Fri", value: 61, delta: -1 },
      { label: "Sat", value: 63, delta: 2 },
      { label: "Sun", value: 64, delta: 1 },
    ],
  },
  "resting-hr": {
    id: "resting-hr",
    name: "Resting Heart Rate",
    unit: "bpm",
    current: 62,
    average: 64,
    deltaPct: -3,
    tone: "coral",
    source: "Apple HealthKit",
    updatedAgo: "Synced 2 min ago",
    series: [
      { label: "Mon", value: 66, delta: 0 },
      { label: "Tue", value: 65, delta: -1 },
      { label: "Wed", value: 64, delta: -1 },
      { label: "Thu", value: 65, delta: 1 },
      { label: "Fri", value: 63, delta: -2 },
      { label: "Sat", value: 62, delta: -1 },
      { label: "Sun", value: 62, delta: 0 },
    ],
  },
  sleep: {
    id: "sleep",
    name: "Sleep Duration",
    unit: "hrs",
    current: 7.2,
    average: 6.8,
    deltaPct: 6,
    tone: "lilac",
    source: "Apple HealthKit",
    updatedAgo: "Synced this morning",
    valueFormatter: fmtOne,
    series: [
      { label: "Mon", value: 6.4, delta: 0 },
      { label: "Tue", value: 6.9, delta: 0.5 },
      { label: "Wed", value: 6.5, delta: -0.4 },
      { label: "Thu", value: 7.0, delta: 0.5 },
      { label: "Fri", value: 6.8, delta: -0.2 },
      { label: "Sat", value: 7.4, delta: 0.6 },
      { label: "Sun", value: 7.2, delta: -0.2 },
    ],
  },
  "basal-temp": {
    id: "basal-temp",
    name: "Basal Skin Temperature",
    unit: "°F",
    current: -0.2,
    average: 0,
    deltaPct: 0,
    tone: "amber",
    source: "Apple Watch",
    updatedAgo: "Overnight reading",
    valueFormatter: fmtTemp,
    series: [
      { label: "Mon", value: 0.1, delta: 0 },
      { label: "Tue", value: 0.0, delta: -0.1 },
      { label: "Wed", value: -0.1, delta: -0.1 },
      { label: "Thu", value: 0.1, delta: 0.2 },
      { label: "Fri", value: 0.0, delta: -0.1 },
      { label: "Sat", value: -0.1, delta: -0.1 },
      { label: "Sun", value: -0.2, delta: -0.1 },
    ],
  },
  respiratory: {
    id: "respiratory",
    name: "Respiratory Rate",
    unit: "bpm",
    current: 14,
    average: 14,
    deltaPct: 0,
    tone: "mint",
    source: "Apple HealthKit",
    updatedAgo: "Synced overnight",
    series: [
      { label: "Mon", value: 14, delta: 0 },
      { label: "Tue", value: 15, delta: 1 },
      { label: "Wed", value: 14, delta: -1 },
      { label: "Thu", value: 14, delta: 0 },
      { label: "Fri", value: 13, delta: -1 },
      { label: "Sat", value: 14, delta: 1 },
      { label: "Sun", value: 14, delta: 0 },
    ],
  },
  steps: {
    id: "steps",
    name: "Daily Steps",
    unit: "steps",
    current: 8432,
    average: 7910,
    deltaPct: 7,
    tone: "coral",
    source: "Apple HealthKit",
    updatedAgo: "Live",
    valueFormatter: fmtZero,
    series: [
      { label: "Mon", value: 7200, delta: 0 },
      { label: "Tue", value: 8100, delta: 900 },
      { label: "Wed", value: 6900, delta: -1200 },
      { label: "Thu", value: 8800, delta: 1900 },
      { label: "Fri", value: 7600, delta: -1200 },
      { label: "Sat", value: 9400, delta: 1800 },
      { label: "Sun", value: 8432, delta: -968 },
    ],
  },
  ecg: {
    id: "ecg",
    name: "ECG Rhythm Log",
    unit: "bpm",
    current: 68,
    average: 66,
    deltaPct: 3,
    tone: "lilac",
    source: "Apple Watch ECG",
    updatedAgo: "Last reading Sun, 8:14 AM",
    series: [
      { label: "Mon", value: 64, delta: 0 },
      { label: "Tue", value: 67, delta: 3 },
      { label: "Wed", value: 65, delta: -2 },
      { label: "Thu", value: 68, delta: 3 },
      { label: "Fri", value: 65, delta: -3 },
      { label: "Sat", value: 67, delta: 2 },
      { label: "Sun", value: 68, delta: 1 },
    ],
  },
};

export function askPrompt(detail: MetricDetail): string {
  const valueStr = detail.valueFormatter
    ? detail.valueFormatter(detail.current)
    : String(detail.current);
  return `Walk me through my ${detail.name.toLowerCase()} this week — current ${valueStr} ${detail.unit}, 7-day average ${detail.average} ${detail.unit}. What's clinically relevant for my next visit?`;
}
