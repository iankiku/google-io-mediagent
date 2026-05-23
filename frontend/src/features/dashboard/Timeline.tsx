"use client";

import React, { useState } from "react";
import { FileText, FileSpreadsheet, Eye, EyeOff, Calendar, AlertTriangle, Pill, ClipboardList, ShieldAlert, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LabMetric {
  metric: string;
  value: string;
  status: string;
}

interface ParsedSummary {
  summary: string;
  key_findings: string[];
  medications: string[];
  diagnoses: string[];
  allergies: string[];
  lab_metrics?: LabMetric[];
}

interface MedicalRecord {
  record_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  status: string;
  extracted_summary?: string; // Stringified JSON
  created_at: string;
}

interface TimelineProps {
  records: MedicalRecord[];
  isLoading: boolean;
}

export function Timeline({ records, isLoading }: TimelineProps) {
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedRecord(expandedRecord === id ? null : id);
  };

  const parseExtractedData = (summaryStr?: string): ParsedSummary | null => {
    if (!summaryStr) return null;
    try {
      return JSON.parse(summaryStr) as ParsedSummary;
    } catch (e) {
      // In case it's a raw string
      return {
        summary: summaryStr,
        key_findings: [],
        medications: [],
        diagnoses: [],
        allergies: [],
      };
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes("pdf")) return <FileText className="w-4 h-4 text-rose-400" />;
    if (mime.includes("sheet") || mime.includes("csv")) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent border-blue-500 animate-spin" />
        <span className="text-xs text-zinc-500 font-medium">Fetching clinical timeline...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-16 bg-[#0c0f16]/30 rounded-2xl border border-[#1e293b] border-dashed">
        <ClipboardList className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
        <h4 className="text-xs font-bold text-white mb-1">Timeline Empty</h4>
        <p className="text-[10px] text-zinc-550 max-w-xs mx-auto leading-normal">
          No medical records uploaded yet. Send a file via the Telegram bot or drag one into the upload zone above.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-[#1e293b] ml-4 pl-6 space-y-6">
      {records.map((record) => {
        const parsed = parseExtractedData(record.extracted_summary);
        const isExpanded = expandedRecord === record.record_id;
        const uploadDate = new Date(record.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        return (
          <div key={record.record_id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-[#08090d] border-2 border-blue-500 group-hover:scale-125 transition-transform duration-350 shadow-[0_0_8px_rgba(59,130,246,0.5)] z-10" />

            <Card className="bg-[#0c0f16]/60 backdrop-blur-md border-[#1e293b] p-4 hover:border-zinc-800 transition-all duration-300">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#101524] border border-[#1e293b]">
                    {getFileIcon(record.file_type)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{record.file_name}</h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {uploadDate}</span>
                      <span>•</span>
                      <span className="text-blue-400">{record.file_type.split("/")[1] || record.file_type}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-zinc-500 hover:text-white"
                  onClick={() => toggleExpand(record.record_id)}
                >
                  {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>

              {/* Collapsed view summary */}
              {!isExpanded && parsed && (
                <p className="text-[10px] text-zinc-400 leading-normal mt-3 line-clamp-2">
                  {parsed.summary}
                </p>
              )}

              {/* Expanded details */}
              {isExpanded && parsed && (
                <div className="mt-4 pt-4 border-t border-[#1e293b] space-y-4 animate-in fade-in duration-200">
                  {/* Summary */}
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Clinical Summary</span>
                    <p className="text-xs text-zinc-300 leading-relaxed bg-[#07090d]/50 p-2.5 rounded-lg border border-[#1e293b]/30">
                      {parsed.summary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Key Findings */}
                    {parsed.key_findings && parsed.key_findings.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-blue-400" /> Key Findings</span>
                        <ul className="text-xs space-y-1 pl-1">
                          {parsed.key_findings.map((f, i) => (
                            <li key={i} className="text-zinc-300 flex items-start gap-2">
                              <span className="text-blue-500 select-none">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Medications */}
                    {parsed.medications && parsed.medications.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-amber-400" /> Medications</span>
                        <ul className="text-xs space-y-1 pl-1">
                          {parsed.medications.map((m, i) => (
                            <li key={i} className="text-zinc-300 flex items-start gap-2">
                              <span className="text-amber-500 select-none">•</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Diagnoses */}
                    {parsed.diagnoses && parsed.diagnoses.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-purple-400" /> Diagnoses</span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {parsed.diagnoses.map((d, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-purple-500/20 bg-purple-500/5 text-purple-400">
                              {d}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Allergies */}
                    {parsed.allergies && parsed.allergies.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Allergies</span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {parsed.allergies.map((a, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-rose-500/20 bg-rose-500/5 text-rose-400">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lab Metrics Table */}
                  {parsed.lab_metrics && parsed.lab_metrics.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Lab Panel Metrics</span>
                      <div className="overflow-hidden rounded-lg border border-[#1e293b] bg-[#07090d]/30">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#0c0f16] border-b border-[#1e293b] text-[10px] text-zinc-500 font-bold uppercase">
                              <th className="p-2">Test Metric</th>
                              <th className="p-2">Observed Value</th>
                              <th className="p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsed.lab_metrics.map((item, idx) => {
                              const isAbnormal = item.status?.toLowerCase() !== "normal" && item.status?.toLowerCase() !== "";
                              return (
                                <tr key={idx} className="border-b border-[#1e293b]/40 last:border-0 hover:bg-[#101524]/20 transition-colors">
                                  <td className="p-2 text-white font-medium">{item.metric}</td>
                                  <td className="p-2 text-zinc-300">{item.value}</td>
                                  <td className="p-2">
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      isAbnormal
                                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                    }`}>
                                      {item.status || "Normal"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
