"use client";

import React, { useState, useMemo } from "react";
import { Activity, TrendingUp, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LabMetric {
  metric: string;
  value: string;
  status: string;
}

interface ParsedSummary {
  lab_metrics?: LabMetric[];
}

interface MedicalRecord {
  record_id: string;
  extracted_summary?: string;
  created_at: string;
}

interface MetricTrendsProps {
  records: MedicalRecord[];
}

interface DataPoint {
  date: string;
  rawDate: Date;
  value: number;
  displayValue: string;
}

export function MetricTrends({ records }: MetricTrendsProps) {
  const [selectedMetric, setSelectedMetric] = useState<string>("HbA1c");

  // Parse records to compile historical metric arrays
  const historicalData = useMemo(() => {
    const dataMap: Record<string, DataPoint[]> = {};

    // Sort records oldest to newest for chronological plotting
    const sortedRecords = [...records].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedRecords.forEach(record => {
      if (!record.extracted_summary) return;
      try {
        const parsed = JSON.parse(record.extracted_summary) as ParsedSummary;
        const metrics = parsed.lab_metrics || [];
        
        metrics.forEach(m => {
          // Normalize key name (e.g., "HbA1c Level" -> "HbA1c", "Blood Pressure" -> "BP")
          let name = m.metric.trim();
          if (name.toLowerCase().includes("hba1c")) name = "HbA1c";
          if (name.toLowerCase().includes("glucose") || name.toLowerCase().includes("sugar")) name = "Glucose";
          if (name.toLowerCase().includes("cholesterol")) name = "Cholesterol";
          if (name.toLowerCase().includes("pressure") || name.toLowerCase() === "bp") name = "Blood Pressure";

          // Extract numeric value
          // e.g. "5.7%" -> 5.7, "140 mg/dl" -> 140, "120/80" -> 120 (sys)
          let valStr = m.value.trim();
          let numericVal = NaN;
          
          if (name === "Blood Pressure") {
            // BP handles systolic primarily
            const bpParts = valStr.split("/");
            numericVal = parseFloat(bpParts[0]);
          } else {
            // strip everything except digits and decimal dots
            const cleaned = valStr.replace(/[^\d.]/g, "");
            numericVal = parseFloat(cleaned);
          }

          if (isNaN(numericVal)) return;

          const point: DataPoint = {
            date: new Date(record.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            rawDate: new Date(record.created_at),
            value: numericVal,
            displayValue: m.value
          };

          if (!dataMap[name]) dataMap[name] = [];
          dataMap[name].push(point);
        });
      } catch (e) {
        // Skip malformed summaries
      }
    });

    return dataMap;
  }, [records]);

  // Available metrics
  const availableMetrics = Object.keys(historicalData);

  // Set initial selected metric if not preset or not available
  React.useEffect(() => {
    if (availableMetrics.length > 0 && !availableMetrics.includes(selectedMetric)) {
      setSelectedMetric(availableMetrics[0]);
    }
  }, [availableMetrics, selectedMetric]);

  const activePoints = historicalData[selectedMetric] || [];

  // SVG Chart Computations
  const chartWidth = 500;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartAreaWidth = chartWidth - paddingLeft - paddingRight;
  const chartAreaHeight = chartHeight - paddingTop - paddingBottom;

  const yMin = useMemo(() => {
    if (activePoints.length === 0) return 0;
    const values = activePoints.map(p => p.value);
    const min = Math.min(...values);
    return Math.max(0, min - (min * 0.1));
  }, [activePoints]);

  const yMax = useMemo(() => {
    if (activePoints.length === 0) return 10;
    const values = activePoints.map(p => p.value);
    const max = Math.max(...values);
    return max + (max * 0.1);
  }, [activePoints]);

  const pointsCoordinates = useMemo(() => {
    if (activePoints.length === 0) return [];
    
    return activePoints.map((point, index) => {
      // X coordinate spaced evenly
      const x = paddingLeft + (activePoints.length > 1 
        ? (index / (activePoints.length - 1)) * chartAreaWidth 
        : chartAreaWidth / 2);
      
      // Y coordinate mapped linearly
      const yRange = yMax - yMin;
      const yValNormalized = (point.value - yMin) / (yRange || 1);
      const y = chartHeight - paddingBottom - (yValNormalized * chartAreaHeight);

      return { x, y, ...point };
    });
  }, [activePoints, yMin, yMax, chartAreaWidth, chartAreaHeight]);

  // Target ranges for reference lines
  const getReferenceRange = (metricName: string) => {
    switch (metricName.toLowerCase()) {
      case "hba1c":
        return { name: "Normal Range (< 5.7%)", maxVal: 5.7, minVal: 0 };
      case "glucose":
        return { name: "Fasting Target (70-100 mg/dL)", maxVal: 100, minVal: 70 };
      case "blood pressure":
        return { name: "Normal Systolic (< 120 mmHg)", maxVal: 120, minVal: 90 };
      case "cholesterol":
        return { name: "Desirable Range (< 200 mg/dL)", maxVal: 200, minVal: 0 };
      default:
        return null;
    }
  };

  const refRange = getReferenceRange(selectedMetric);
  const refLineY = useMemo(() => {
    if (!refRange || activePoints.length === 0) return null;
    const yRange = yMax - yMin;
    const maxValNormalized = (refRange.maxVal - yMin) / (yRange || 1);
    const y = chartHeight - paddingBottom - (maxValNormalized * chartAreaHeight);
    return y >= paddingTop && y <= chartHeight - paddingBottom ? y : null;
  }, [refRange, yMin, yMax, chartAreaHeight]);

  // Generate SVG path string
  const linePath = useMemo(() => {
    if (pointsCoordinates.length === 0) return "";
    return pointsCoordinates.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, "");
  }, [pointsCoordinates]);

  // Generate Area Path for filling underneath the line
  const areaPath = useMemo(() => {
    if (pointsCoordinates.length === 0) return "";
    const basePath = linePath;
    const startX = pointsCoordinates[0].x;
    const endX = pointsCoordinates[pointsCoordinates.length - 1].x;
    const groundY = chartHeight - paddingBottom;
    return `${basePath} L ${endX} ${groundY} L ${startX} ${groundY} Z`;
  }, [pointsCoordinates, linePath]);

  return (
    <Card className="bg-[#0c0f16]/60 backdrop-blur-md border-[#1e293b] p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Lab Parameters Trends</h3>
            <span className="text-[9px] text-zinc-550 flex items-center gap-1 font-semibold uppercase tracking-wider mt-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-400" /> Grounded Patient Metrics Tracker
            </span>
          </div>
        </div>

        {availableMetrics.length > 1 && (
          <Tabs value={selectedMetric} onValueChange={setSelectedMetric} className="w-auto">
            <TabsList className="bg-[#08090d] border border-[#1e293b]/50 h-8 p-0.5 rounded-lg">
              {availableMetrics.map(m => (
                <TabsTrigger key={m} value={m} className="text-[10px] px-3 py-1 rounded-md text-zinc-400 data-[state=active]:bg-[#101524] data-[state=active]:text-white">
                  {m}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {activePoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <HelpCircle className="w-8 h-8 text-zinc-700 mb-2" />
          <p className="text-[10px] text-zinc-550 max-w-xs leading-normal">
            No health metrics extracted from reports yet. Processed blood results or metrics will plot here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Diagnostic Chart */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible select-none"
            >
              {/* Y Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = paddingTop + (chartAreaHeight * ratio);
                const gridVal = yMax - (yRange() * ratio);
                return (
                  <g key={i} className="opacity-40">
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingLeft - 10}
                      y={y + 4}
                      fill="#71717a"
                      fontSize={9}
                      textAnchor="end"
                      fontWeight="600"
                    >
                      {gridVal.toFixed(selectedMetric === "HbA1c" ? 1 : 0)}
                    </text>
                  </g>
                );
              })}

              {/* Reference range guidance line */}
              {refLineY !== null && refRange && (
                <g className="opacity-70">
                  <line
                    x1={paddingLeft}
                    y1={refLineY}
                    x2={chartWidth - paddingRight}
                    y2={refLineY}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                  />
                  <text
                    x={chartWidth - paddingRight}
                    y={refLineY - 5}
                    fill="#f59e0b"
                    fontSize={8}
                    textAnchor="end"
                    fontWeight="700"
                    className="uppercase tracking-wider"
                  >
                    {refRange.name}
                  </text>
                </g>
              )}

              {/* Filled Area Gradient */}
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Fill Path */}
              {areaPath && (
                <path d={areaPath} fill="url(#areaGradient)" className="animate-in fade-in duration-500" />
              )}

              {/* Line Path */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-in fade-in duration-300"
                />
              )}

              {/* Data Points */}
              {pointsCoordinates.map((pt, idx) => (
                <g key={idx} className="group cursor-pointer">
                  {/* Glowing hover circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={8}
                    fill="#10b981"
                    fillOpacity={0}
                    className="hover:fill-opacity-20 transition-all duration-200"
                  />
                  {/* Core point circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill="#08090d"
                    stroke="#10b981"
                    strokeWidth={2.5}
                  />
                  {/* Hover Tooltip Value */}
                  <text
                    x={pt.x}
                    y={pt.y - 12}
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="middle"
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 duration-200"
                  >
                    {pt.displayValue}
                  </text>
                  {/* X Axis Date Label */}
                  <text
                    x={pt.x}
                    y={chartHeight - 15}
                    fill="#71717a"
                    fontSize={9}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {pt.date}
                  </text>
                </g>
              ))}

              {/* Chart Axes Border */}
              <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={paddingLeft}
                y2={chartHeight - paddingBottom}
                stroke="#1e293b"
                strokeWidth={1}
              />
              <line
                x1={paddingLeft}
                y1={chartHeight - paddingBottom}
                x2={chartWidth - paddingRight}
                y2={chartHeight - paddingBottom}
                stroke="#1e293b"
                strokeWidth={1}
              />
            </svg>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-zinc-550 border-t border-[#1e293b]/40 pt-3">
            <span>Historical readings: <b>{activePoints.length}</b></span>
            <span>Current Status: <b className="text-emerald-400 capitalize">{activePoints[activePoints.length - 1]?.displayValue}</b></span>
          </div>
        </div>
      )}
    </Card>
  );

  function yRange() {
    return yMax - yMin;
  }
}
