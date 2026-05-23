"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Send, 
  Search, 
  Code, 
  FileText, 
  Compass, 
  Sparkles, 
  Info,
  Trash2,
  Globe,
  Database,
  Sliders,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

// DDD Feature imports
import { MessageBubble } from "@/features/chat/MessageBubble";
import { TracePanel } from "@/features/trace/TracePanel";
import { CreateAgentDialog } from "@/features/agent-registry/CreateAgentDialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Agent {
  id: string;
  description: string;
  system_instruction: string;
  base_agent: string;
}

interface Message {
  role: "user" | "model" | "system";
  content: string;
  timestamp: string;
}

export default function Home() {
  // Agent states
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("antigravity-preview-05-2026");
  
  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [needsValidation, setNeedsValidation] = useState(true);
  
  // LangGraph Trace States
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [routingInstruction, setRoutingInstruction] = useState<string>("");
  const [validationStatus, setValidationStatus] = useState<string>("");
  // Create Agent Dialog Form state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Inline Agent Customization State
  const [showInlineCustomization, setShowInlineCustomization] = useState(false);
  const [inlineAgentsMd, setInlineAgentsMd] = useState("");
  const [inlineSkillName, setInlineSkillName] = useState("");
  const [inlineSkillContent, setInlineSkillContent] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const fetchAgents = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agents`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error("Failed to load agents", err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    // Clear previous trace states
    setTraceLogs([`[Client] Sending request to FastAPI backend (needs_validation = ${needsValidation})...`]);
    setToolsUsed([]);
    setRoutingInstruction("");
    setValidationStatus("");

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          agent_id: selectedAgentId === "antigravity-preview-05-2026" ? null : selectedAgentId,
          needs_validation: needsValidation,
          chat_history: messages.map(m => ({ role: m.role, content: m.content })),
          custom_agents_md: inlineAgentsMd.trim() || null,
          custom_skills: inlineSkillName.trim() && inlineSkillContent.trim()
            ? [{ name: inlineSkillName.trim(), content: inlineSkillContent.trim() }]
            : null
        })
      });

      if (!response.ok) {
        throw new Error("Backend response error");
      }

      const data = await response.json();
      
      // Update chat messages
      const modelMessage: Message = {
        role: "model",
        content: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, modelMessage]);
      
      // Update trace panel
      setTraceLogs(data.logs || []);
      setToolsUsed(data.tools_used || []);
      setRoutingInstruction(data.system_instruction || "");
      setValidationStatus(data.validation_status || "passed");
    } catch (err) {
      console.error(err);
      setTraceLogs(prev => [...prev, `[Client Error] Failed to reach orchestrator backend. Please check if uvicorn server is running.`]);
      setMessages(prev => [...prev, {
        role: "model",
        content: "I encountered a connection error. Please make sure the FastAPI backend is running on `http://localhost:8000`.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterAgent = async (agentData: {
    id: string;
    description: string;
    system_instruction: string;
    tools: string[];
    files?: { target: string; content: string }[];
  }) => {
    try {
      const response = await fetch(`${API_BASE}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentData)
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchAgents();
        setSelectedAgentId(agentData.id);
      } else {
        const errorData = await response.json();
        alert(`Failed to create agent: ${errorData.detail}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error calling backend API.");
    }
  };

  const handleDeleteAgent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete custom agent '${id}'?`)) return;

    try {
      const response = await fetch(`${API_BASE}/api/agents/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        fetchAgents();
        if (selectedAgentId === id) {
          setSelectedAgentId("antigravity-preview-05-2026");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentAgent = selectedAgentId === "antigravity-preview-05-2026" 
    ? { id: "antigravity-preview-05-2026", description: "Default Antigravity Agent. Features code execution, search, and full sandbox environment." }
    : agents.find(a => a.id === selectedAgentId) || { id: selectedAgentId, description: "Custom Registered Managed Agent" };

  return (
    <div className="flex h-screen w-screen bg-[#08090d] text-[#e2e8f0] font-sans overflow-hidden">
      {/* LEFT SIDEBAR - AGENTS MANAGER */}
      <aside className="w-80 border-r border-[#1a202c] bg-[#0c0f16] flex flex-col h-full shrink-0">
        <div className="p-6 border-b border-[#1a202c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#3b82f6] to-[#a855f7] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">ANTIGRAVITY</h1>
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Managed Agents Platform</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/5">
            v1.0 (Preview)
          </Badge>
        </div>

        {/* Action Button */}
        <div className="p-4">
          <CreateAgentDialog 
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            onSubmit={handleRegisterAgent}
          />
        </div>

        {/* Available Agents */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">Available Agent Instances</span>
          </div>

          <ScrollArea className="flex-1 px-3">
            <div className="space-y-1.5 pb-4">
              {/* Base Agent */}
              <div 
                onClick={() => setSelectedAgentId("antigravity-preview-05-2026")}
                className={`p-3.5 rounded-xl cursor-pointer transition-all flex flex-col gap-1 border ${
                  selectedAgentId === "antigravity-preview-05-2026"
                    ? "bg-[#182235] border-blue-500/50 shadow-md shadow-blue-500/5"
                    : "bg-[#0f131a] border-transparent hover:border-[#1a202c] hover:bg-[#131922]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${selectedAgentId === "antigravity-preview-05-2026" ? "text-blue-400" : "text-zinc-500"}`} />
                    <span className="font-semibold text-xs text-white">antigravity-preview</span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-none font-bold">
                    SYSTEM
                  </Badge>
                </div>
                <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2 mt-1">
                  Default base agent configuration with code execution and search.
                </p>
              </div>

              {/* Custom registered agents */}
              {agents.map(agent => (
                <div 
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all flex flex-col gap-1 border group relative ${
                    selectedAgentId === agent.id
                      ? "bg-[#1d1b2b] border-purple-500/50 shadow-md shadow-purple-500/5"
                      : "bg-[#0f131a] border-transparent hover:border-[#1a202c] hover:bg-[#131922]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className={`w-4 h-4 ${selectedAgentId === agent.id ? "text-purple-400" : "text-zinc-500"}`} />
                      <span className="font-semibold text-xs text-white">{agent.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[8px] px-1 border-purple-500/30 text-purple-400 bg-purple-500/5 uppercase font-bold">
                        MANAGED
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-4 h-4 text-zinc-500 hover:text-red-400 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteAgent(agent.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2 mt-1">
                    {agent.description || "Custom sandbox instructions agent."}
                  </p>
                </div>
              ))}

              {agents.length === 0 && (
                <div className="text-center p-6 bg-[#0f131a]/50 rounded-xl border border-dashed border-[#1a202c] mt-4">
                  <Bot className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                  <p className="text-[10px] text-zinc-500">No custom agents registered yet.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer info/controls */}
        <div className="p-4 border-t border-[#1a202c] bg-[#090b10] flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Verify Outputs</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">{needsValidation ? "ON" : "OFF"}</span>
              <Switch checked={needsValidation} onCheckedChange={setNeedsValidation} className="scale-75 origin-right" />
            </div>
          </div>
          <div className="bg-[#0f131a] p-2.5 rounded-lg border border-[#1a202c]">
            <p className="text-[9px] text-zinc-500 leading-normal">
              When verification is <b className="text-zinc-300">ON</b>, a LangGraph validator node will double check the agent's work and prompt it to correct errors up to 3 times automatically.
            </p>
          </div>
        </div>
      </aside>

      {/* CENTER COMPONENT - CHAT ROOM */}
      <section className="flex-1 flex flex-col bg-[#08090d] relative h-full">
        {/* Header bar */}
        <header className="h-[73px] border-b border-[#1a202c] bg-[#0c0f16]/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                Active Agent: <code className="text-blue-400 text-xs">{currentAgent.id}</code>
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
              {currentAgent.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {selectedAgentId === "antigravity-preview-05-2026" ? (
                <>
                  <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 border-zinc-800 bg-[#0e1117] text-zinc-400">
                    <Code className="w-3 h-3 text-emerald-400" /> code_exec
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 border-zinc-800 bg-[#0e1117] text-zinc-400">
                    <Globe className="w-3 h-3 text-blue-400" /> search
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 border-zinc-800 bg-[#0e1117] text-zinc-400">
                    <FileText className="w-3 h-3 text-indigo-400" /> url_context
                  </Badge>
                </>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 border-purple-500/20 bg-purple-500/5 text-purple-400">
                  <Database className="w-3 h-3" /> remote_sandbox
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInlineCustomization(!showInlineCustomization)}
              className={`text-[10px] h-7 gap-1 px-2.5 rounded-md transition-all ${
                showInlineCustomization 
                  ? "border-blue-500/50 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20" 
                  : "border-zinc-800 bg-[#0e1117] text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Sliders className="w-3 h-3" />
              Inline Config
              {(inlineAgentsMd.trim() || (inlineSkillName.trim() && inlineSkillContent.trim())) && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5" />
              )}
            </Button>
          </div>
        </header>

        {/* Collapsible Inline Customization Panel */}
        {showInlineCustomization && (
          <div className="border-b border-[#1a202c] bg-[#0c0f16]/60 p-4 transition-all animate-in slide-in-from-top duration-200">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-blue-450" />
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white">Inline Agent Customization</h4>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setInlineAgentsMd("");
                    setInlineSkillName("");
                    setInlineSkillContent("");
                  }}
                  className="text-[9px] h-5 px-1.5 text-zinc-500 hover:text-red-400 hover:bg-transparent"
                >
                  Clear Config
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AGENTS.md Overlay */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider">
                      AGENTS.md System Guide
                    </label>
                    <Badge variant="outline" className="text-[8px] border-zinc-805 text-zinc-500 py-0 px-1 bg-zinc-900/50">
                      Mounted as .agents/AGENTS.md
                    </Badge>
                  </div>
                  <Textarea
                    value={inlineAgentsMd}
                    onChange={(e) => setInlineAgentsMd(e.target.value)}
                    placeholder="Enter instructions to guide the agent (e.g. Always use pandas. Format all responses in clean markdown.)"
                    className="bg-[#07090d] border-zinc-850 text-xs text-white placeholder:text-zinc-650 min-h-[90px] focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>

                {/* Custom Inline Skill */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider">
                      Custom Skill overlay (SKILL.md)
                    </label>
                    {inlineSkillName.trim() && (
                      <Badge variant="outline" className="text-[8px] border-purple-500/25 text-purple-400 bg-purple-500/5 py-0 px-1">
                        Mounted as skills/{inlineSkillName.trim()}/SKILL.md
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      value={inlineSkillName}
                      onChange={(e) => setInlineSkillName(e.target.value)}
                      placeholder="Skill Name (e.g., slide-maker)"
                      className="bg-[#07090d] border-[#1e293b] text-xs text-white placeholder:text-zinc-650 h-8"
                    />
                    <Textarea
                      value={inlineSkillContent}
                      onChange={(e) => setInlineSkillContent(e.target.value)}
                      placeholder="Skill Instructions (e.g., # Slide Maker\nCreate slides from revenue data.)"
                      className="bg-[#07090d] border-zinc-850 text-xs text-white placeholder:text-zinc-650 min-h-[50px] focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversation flow */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500/10 to-purple-500/10 border border-blue-500/20 flex items-center justify-center animate-pulse">
                <Bot className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Welcome to the Agent Foundations Sandbox</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Submit a prompt to run. The system will compile the LangGraph workflow, check capabilities, spin up the remote container, run the agent, validate the results, and stream back.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full pt-2">
                <Card 
                  onClick={() => setInput("Write a python script that downloads a CSV of random stock prices and plots the moving average with matplotlib.")} 
                  className="bg-[#0f131a] hover:bg-[#131822] border-[#1e293b] p-3 text-left cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <p className="text-[11px] font-bold text-white flex items-center gap-1.5 mb-1">
                    <Code className="w-3 h-3 text-emerald-400" /> Data Plotting
                  </p>
                  <p className="text-[10px] text-zinc-500 leading-normal line-clamp-2">Plot a stock chart and download png</p>
                </Card>
                <Card 
                  onClick={() => setInput("Search the web for the latest developments in AI agents frameworks in May 2026, and compile a comparative summary.")} 
                  className="bg-[#0f131a] hover:bg-[#131822] border-[#1e293b] p-3 text-left cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <p className="text-[11px] font-bold text-white flex items-center gap-1.5 mb-1">
                    <Globe className="w-3 h-3 text-blue-400" /> Web Grounding
                  </p>
                  <p className="text-[10px] text-zinc-500 leading-normal line-clamp-2">Research news with Google Search</p>
                </Card>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message, i) => (
                <MessageBubble key={i} message={message} />
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-zinc-300" />
                  </div>
                  <div className="flex flex-col gap-2 max-w-[85%]">
                    <div className="bg-[#0f131a] border border-[#1e293b] p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-blue-400 animate-spin shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-white">Agent execution in progress...</span>
                        <span className="text-[10px] text-zinc-500">FastAPI backend is executing the LangGraph pipeline</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* Input box bottom bar */}
        <div className="p-6 border-t border-[#1a202c] bg-[#0c0f16]/60 backdrop-blur-md">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex gap-2">
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Ask the agent... (e.g. "analyze the data" or "search for...")`}
              className="bg-[#090c10] border-[#1e293b] text-white text-xs h-11 px-4 pr-12 focus:ring-1 focus:ring-blue-500 rounded-xl flex-1 shadow-inner placeholder:text-zinc-650"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-11 w-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-md shadow-blue-500/10"
              disabled={isLoading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <div className="max-w-3xl mx-auto flex items-center gap-4 mt-2 px-1 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1 font-semibold"><Info className="w-3.5 h-3.5 text-zinc-600" /> Notes:</span>
            <span>Targeting model: <code className="text-zinc-500">antigravity-preview-05-2026</code></span>
            <span>•</span>
            <span>Each run starts from a clean environment fork.</span>
          </div>
        </div>
      </section>

      {/* RIGHT SIDEBAR - LANGGRAPH TRACE & LOGS */}
      <TracePanel 
        traceLogs={traceLogs}
        toolsUsed={toolsUsed}
        routingInstruction={routingInstruction}
        validationStatus={validationStatus}
        needsValidation={needsValidation}
      />
    </div>
  );
}
