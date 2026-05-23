import React from "react";
import { Terminal, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TracePanelProps {
  traceLogs: string[];
  toolsUsed: string[];
  routingInstruction: string;
  validationStatus: string;
  needsValidation: boolean;
}

export const TracePanel: React.FC<TracePanelProps> = ({
  traceLogs,
  toolsUsed,
  routingInstruction,
  validationStatus,
  needsValidation
}) => {
  return (
    <aside className="w-80 border-l border-[#1a202c] bg-[#0c0f16] flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-[#1a202c] flex items-center gap-2">
        <Terminal className="w-4 h-4 text-emerald-400" />
        <div>
          <h2 className="font-bold text-xs text-white uppercase tracking-wider">LangGraph Trace</h2>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Execution Pipeline Logs</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Node status / flow visualization */}
            <div className="bg-[#090c10] p-3 rounded-lg border border-[#1e293b] space-y-2">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Graph Nodes</span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${traceLogs.length > 0 ? "bg-emerald-400" : "bg-zinc-800"}`} />
                  <span className={`${traceLogs.length > 0 ? "text-emerald-400 font-semibold" : "text-zinc-600"}`}>router_node</span>
                </div>
                <div className="h-2 w-0.5 bg-zinc-800 ml-1" />
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${traceLogs.some(l => l.includes("Executor")) ? "bg-purple-400" : "bg-zinc-800"}`} />
                  <span className={`${traceLogs.some(l => l.includes("Executor")) ? "text-purple-400 font-semibold" : "text-zinc-600"}`}>execution_node</span>
                </div>
                {needsValidation && (
                  <>
                    <div className="h-2 w-0.5 bg-zinc-800 ml-1" />
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${traceLogs.some(l => l.includes("Validator")) ? "bg-amber-400" : "bg-zinc-800"}`} />
                      <span className={`${traceLogs.some(l => l.includes("Validator")) ? "text-amber-400 font-semibold" : "text-zinc-600"}`}>validator_node</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Dynamic Router Instruction */}
            {routingInstruction && (
              <div className="bg-[#090c10] p-3 rounded-lg border border-[#1e293b] space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Routed System Instruction</span>
                <p className="text-[10px] text-zinc-400 leading-normal font-mono bg-black/30 p-2 rounded max-h-24 overflow-y-auto">
                  {routingInstruction}
                </p>
              </div>
            )}

            {/* Tools list */}
            {toolsUsed.length > 0 && (
              <div className="bg-[#090c10] p-3 rounded-lg border border-[#1e293b] space-y-1.5">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Enabled Toolset</span>
                <div className="flex flex-wrap gap-1">
                  {toolsUsed.map(t => (
                    <Badge key={t} className="text-[9px] font-bold bg-[#131924] border-[#1e293b] text-blue-400">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Validation panel */}
            {validationStatus && (
              <div className="bg-[#090c10] p-3 rounded-lg border border-[#1e293b] flex items-center justify-between">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Validation Output</span>
                <div className="flex items-center gap-1 text-xs">
                  {validationStatus === "passed" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-bold uppercase">Passed</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-bold uppercase">Failed</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Raw Trace stream */}
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block px-1">Raw Trace Stream</span>
              <div className="space-y-1">
                {traceLogs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`text-[9px] font-mono leading-relaxed p-2 rounded border ${
                      log.includes("Router")
                        ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-300"
                        : log.includes("Executor")
                        ? "bg-purple-950/20 border-purple-900/30 text-purple-300"
                        : log.includes("Validator")
                        ? "bg-amber-950/20 border-amber-900/30 text-amber-300"
                        : "bg-zinc-950/30 border-zinc-800/40 text-zinc-500"
                    }`}
                  >
                    {log}
                  </div>
                ))}

                {traceLogs.length === 0 && (
                  <div className="text-center p-6 text-zinc-600 font-mono text-[9px]">
                    // No active traces. Start a chat.
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
};
