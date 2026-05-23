import React, { useState } from "react";
import { Sparkles, Plus, Info, Trash2, Code, FileText, Settings, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface CreateAgentDialogProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  onSubmit: (data: {
    id: string;
    description: string;
    system_instruction: string;
    tools: string[];
    files?: { target: string; content: string }[];
  }) => Promise<void>;
}

interface CustomSkill {
  name: string;
  description: string;
  content: string;
}

interface WorkspaceFile {
  path: string;
  content: string;
}

export const CreateAgentDialog: React.FC<CreateAgentDialogProps> = ({
  dialogOpen,
  setDialogOpen,
  onSubmit
}) => {
  const [newAgentId, setNewAgentId] = useState("");
  const [newAgentDesc, setNewAgentDesc] = useState("");
  const [newAgentInstructions, setNewAgentInstructions] = useState("");
  const [enableCodeExecution, setEnableCodeExecution] = useState(true);
  const [enableGoogleSearch, setEnableGoogleSearch] = useState(true);
  const [enableUrlContext, setEnableUrlContext] = useState(true);
  const [agentsMdContent, setAgentsMdContent] = useState("");
  const [loading, setLoading] = useState(false);

  // File-based customization state (skills and workspace files)
  const [newAgentSkills, setNewAgentSkills] = useState<CustomSkill[]>([]);
  const [newAgentWorkspaceFiles, setNewAgentWorkspaceFiles] = useState<WorkspaceFile[]>([]);

  // Skill Editor temporary inputs
  const [skillNameInput, setSkillNameInput] = useState("");
  const [skillDescInput, setSkillDescInput] = useState("");
  const [skillContentInput, setSkillContentInput] = useState("");
  const [editingSkillIndex, setEditingSkillIndex] = useState<number | null>(null);

  // Workspace File Editor temporary inputs
  const [filePathInput, setFilePathInput] = useState("");
  const [fileContentInput, setFileContentInput] = useState("");
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);

  const applyPreset = (type: "analyst" | "researcher" | "slides") => {
    if (type === "analyst") {
      setNewAgentId("data-analyst-agent");
      setNewAgentDesc("Specialist in numerical computations, formatting reports and drawing charts.");
      setNewAgentInstructions("You are an expert Data Analyst. Always use matplotlib/seaborn to generate charts from data, perform rigorous math, and output neat tables.");
      setEnableCodeExecution(true);
      setEnableGoogleSearch(false);
      setEnableUrlContext(false);
      setAgentsMdContent("Always save all generated charts as PNG or HTML in /workspace/output/ and link to them in your final report.");
      setNewAgentSkills([
        {
          name: "data-plotter",
          description: "Generates data plots and charts",
          content: "---\nname: data-plotter\ndescription: Generates data plots and charts\n---\n# Data Plotter\n\nWhen asked to plot data:\n1. Write a python script using matplotlib or seaborn\n2. Save the output plot to /workspace/output/chart.png\n3. Display the chart to the user"
        }
      ]);
      setNewAgentWorkspaceFiles([
        {
          path: "templates/report_style.css",
          content: "body {\n  font-family: sans-serif;\n  color: #333;\n  margin: 2rem;\n}\ntable {\n  border-collapse: collapse;\n  width: 100%;\n}\nth, td {\n  border: 1px solid #ddd;\n  padding: 8px;\n}\nth {\n  background-color: #f2f2f2;\n}"
        }
      ]);
    } else if (type === "researcher") {
      setNewAgentId("web-researcher");
      setNewAgentDesc("Gathers deep info via search grounding and synthesizes reports.");
      setNewAgentInstructions("You are an advanced Research Assistant. Gather high-quality citations using Google Search, analyze conflicting facts, and summarize them.");
      setEnableCodeExecution(false);
      setEnableGoogleSearch(true);
      setEnableUrlContext(true);
      setAgentsMdContent("Include list of links, reference names, and dates retrieved at the end of the summary.");
      setNewAgentSkills([]);
      setNewAgentWorkspaceFiles([
        {
          path: "config/search_sources.json",
          content: "{\n  \"preferred_domains\": [\n    \"arxiv.org\",\n    \"wikipedia.org\",\n    \"nature.com\"\n  ],\n  \"max_results_per_query\": 5\n}"
        }
      ]);
    } else if (type === "slides") {
      setNewAgentId("slide-maker-agent");
      setNewAgentDesc("Creates HTML presentation slides using reveal.js.");
      setNewAgentInstructions("You are a presentation assistant. Create structured, beautiful slide decks from text inputs.");
      setEnableCodeExecution(true);
      setEnableGoogleSearch(false);
      setEnableUrlContext(false);
      setAgentsMdContent("Ensure all presentations are saved to /workspace/output/slides.html and use reveal.js with custom styling.");
      setNewAgentSkills([
        {
          name: "slide-maker",
          description: "Create HTML slide decks",
          content: "---\nname: slide-maker\ndescription: Create HTML slide decks\n---\n# Slide Maker\n\nWhen asked to create a presentation:\n1. Analyze the input data\n2. Create an HTML slide deck with reveal.js\n3. Save to /workspace/output/slides.html"
        }
      ]);
      setNewAgentWorkspaceFiles([
        {
          path: "templates/slide_theme.css",
          content: ".reveal {\n  font-family: 'Inter', sans-serif;\n  color: #f8fafc;\n  background: #0f172a;\n}\n.reveal h1, .reveal h2, .reveal h3 {\n  color: #38bdf8;\n  font-weight: 800;\n}"
        }
      ]);
    }
  };

  // Skills CRUD helpers
  const handleAddOrUpdateSkill = () => {
    if (!skillNameInput.trim()) return;

    const formattedSkill = {
      name: skillNameInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ""),
      description: skillDescInput.trim(),
      content: skillContentInput.trim() || `---\nname: ${skillNameInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "")}\ndescription: ${skillDescInput.trim()}\n---\n# ${skillNameInput.trim()}\n\nWhen asked to...\n1. ...`
    };

    if (editingSkillIndex !== null) {
      setNewAgentSkills(prev => prev.map((s, idx) => idx === editingSkillIndex ? formattedSkill : s));
      setEditingSkillIndex(null);
    } else {
      setNewAgentSkills(prev => [...prev, formattedSkill]);
    }

    setSkillNameInput("");
    setSkillDescInput("");
    setSkillContentInput("");
  };

  const handleEditSkill = (index: number) => {
    const skill = newAgentSkills[index];
    setSkillNameInput(skill.name);
    setSkillDescInput(skill.description);
    setSkillContentInput(skill.content);
    setEditingSkillIndex(index);
  };

  const handleDeleteSkill = (index: number) => {
    setNewAgentSkills(prev => prev.filter((_, idx) => idx !== index));
    if (editingSkillIndex === index) {
      setEditingSkillIndex(null);
      setSkillNameInput("");
      setSkillDescInput("");
      setSkillContentInput("");
    }
  };

  // Workspace Files CRUD helpers
  const handleAddOrUpdateFile = () => {
    if (!filePathInput.trim()) return;

    let cleanPath = filePathInput.trim();
    if (cleanPath.startsWith("/")) cleanPath = cleanPath.slice(1);
    if (cleanPath.startsWith("workspace/")) cleanPath = cleanPath.slice("workspace/".length);

    const formattedFile = {
      path: cleanPath,
      content: fileContentInput
    };

    if (editingFileIndex !== null) {
      setNewAgentWorkspaceFiles(prev => prev.map((f, idx) => idx === editingFileIndex ? formattedFile : f));
      setEditingFileIndex(null);
    } else {
      setNewAgentWorkspaceFiles(prev => [...prev, formattedFile]);
    }

    setFilePathInput("");
    setFileContentInput("");
  };

  const handleEditFile = (index: number) => {
    const file = newAgentWorkspaceFiles[index];
    setFilePathInput(file.path);
    setFileContentInput(file.content);
    setEditingFileIndex(index);
  };

  const handleDeleteFile = (index: number) => {
    setNewAgentWorkspaceFiles(prev => prev.filter((_, idx) => idx !== index));
    if (editingFileIndex === index) {
      setEditingFileIndex(null);
      setFilePathInput("");
      setFileContentInput("");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentId.trim() || !newAgentInstructions.trim()) return;

    setLoading(true);
    const tools: string[] = [];
    if (enableCodeExecution) tools.push("code_execution");
    if (enableGoogleSearch) tools.push("google_search");
    if (enableUrlContext) tools.push("url_context");

    const files = [];
    if (agentsMdContent.trim()) {
      files.push({
        target: ".agents/AGENTS.md",
        content: agentsMdContent
      });
    }

    newAgentSkills.forEach(skill => {
      files.push({
        target: `.agents/skills/${skill.name}/SKILL.md`,
        content: skill.content
      });
    });

    newAgentWorkspaceFiles.forEach(file => {
      let cleanPath = file.path.trim();
      if (cleanPath.startsWith("/")) cleanPath = cleanPath.slice(1);
      if (!cleanPath.startsWith("workspace/")) {
        cleanPath = "workspace/" + cleanPath;
      }
      files.push({
        target: cleanPath,
        content: file.content
      });
    });

    try {
      await onSubmit({
        id: newAgentId,
        description: newAgentDesc,
        system_instruction: newAgentInstructions,
        tools: tools,
        files: files.length > 0 ? files : undefined
      });
      // Clear inputs
      setNewAgentId("");
      setNewAgentDesc("");
      setNewAgentInstructions("");
      setAgentsMdContent("");
      setNewAgentSkills([]);
      setNewAgentWorkspaceFiles([]);
      setSkillNameInput("");
      setSkillDescInput("");
      setSkillContentInput("");
      setEditingSkillIndex(null);
      setFilePathInput("");
      setFileContentInput("");
      setEditingFileIndex(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger render={
        <Button className="w-full bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white gap-2 font-medium shadow-md shadow-purple-500/10 rounded-lg">
          <Plus className="w-4 h-4" /> Register New Agent
        </Button>
      } />
      
      <DialogContent className="bg-[#0f131a] border-[#1e293b] text-[#e2e8f0] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" /> Create Custom Managed Agent
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Configure a custom agent sandbox with specialized instructions, skills, and initial workspace files.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4 my-2">
          {/* Presets shortcut */}
          <div className="bg-[#090c10] p-3 rounded-lg border border-[#1e293b] flex flex-col gap-1.5">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Fast Presets</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="text-[11px] h-7 border-[#1e293b] hover:bg-[#1a202c]" onClick={() => applyPreset("analyst")}>
                📊 Data Analyst
              </Button>
              <Button type="button" size="sm" variant="outline" className="text-[11px] h-7 border-[#1e293b] hover:bg-[#1a202c]" onClick={() => applyPreset("researcher")}>
                🌐 Deep Researcher
              </Button>
              <Button type="button" size="sm" variant="outline" className="text-[11px] h-7 border-purple-500/30 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10" onClick={() => applyPreset("slides")}>
                ✨ Presentation Maker
              </Button>
            </div>
          </div>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-[#090b10] p-1 border border-[#1e293b] rounded-lg mb-2">
              <TabsTrigger value="details" className="text-xs data-[state=active]:bg-[#1e293b] data-[state=active]:text-white">Details</TabsTrigger>
              <TabsTrigger value="agents-md" className="text-xs data-[state=active]:bg-[#1e293b] data-[state=active]:text-white">AGENTS.md</TabsTrigger>
              <TabsTrigger value="skills" className="text-xs data-[state=active]:bg-[#1e293b] data-[state=active]:text-white">Skills ({newAgentSkills.length})</TabsTrigger>
              <TabsTrigger value="workspace" className="text-xs data-[state=active]:bg-[#1e293b] data-[state=active]:text-white">Workspace ({newAgentWorkspaceFiles.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Agent ID (slug)</label>
                  <Input 
                    placeholder="e.g. data-analyst" 
                    value={newAgentId} 
                    onChange={e => setNewAgentId(e.target.value)} 
                    className="bg-[#090b10] border-[#1e293b] text-white text-xs h-9 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Description</label>
                  <Input 
                    placeholder="e.g. Analytical assistant" 
                    value={newAgentDesc} 
                    onChange={e => setNewAgentDesc(e.target.value)} 
                    className="bg-[#090b10] border-[#1e293b] text-white text-xs h-9 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">System Instructions (Prompt)</label>
                <Textarea 
                  placeholder="Describe how the agent behaves..." 
                  value={newAgentInstructions} 
                  onChange={e => setNewAgentInstructions(e.target.value)} 
                  className="bg-[#090b10] border-[#1e293b] text-white text-xs min-h-[90px] rounded-lg"
                  required
                />
              </div>

              {/* Tools checklist */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Capabilities / Tools</label>
                <div className="grid grid-cols-3 gap-2 bg-[#090c10] p-2.5 rounded-lg border border-[#1e293b]">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input type="checkbox" checked={enableCodeExecution} onChange={e => setEnableCodeExecution(e.target.checked)} className="rounded bg-[#0c0f16] border-[#1e293b] text-blue-500 focus:ring-0" />
                    <span>Code Exec</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input type="checkbox" checked={enableGoogleSearch} onChange={e => setEnableGoogleSearch(e.target.checked)} className="rounded bg-[#0c0f16] border-[#1e293b] text-blue-500 focus:ring-0" />
                    <span>Google Search</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input type="checkbox" checked={enableUrlContext} onChange={e => setEnableUrlContext(e.target.checked)} className="rounded bg-[#0c0f16] border-[#1e293b] text-blue-500 focus:ring-0" />
                    <span>URL Context</span>
                  </label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agents-md" className="space-y-4 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <span>AGENTS.md File Overlay</span>
                  <span className="text-[9px] text-zinc-550 font-medium">(Optional instructions loaded at startup)</span>
                </label>
                <Textarea 
                  placeholder="Always use matplotlib for charts..." 
                  value={agentsMdContent} 
                  onChange={e => setAgentsMdContent(e.target.value)} 
                  className="bg-[#090b10] border-[#1e293b] text-white text-xs font-mono min-h-[160px] rounded-lg"
                />
              </div>
            </TabsContent>

            <TabsContent value="skills" className="space-y-3 pt-1">
              {/* Existing Skills list */}
              <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                {newAgentSkills.map((skill, index) => (
                  <div key={index} className="flex items-center justify-between bg-[#090c10] border border-[#1e293b] rounded-lg p-2 text-xs">
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="font-mono text-purple-400 font-bold block truncate">{skill.name}</span>
                      <span className="text-[10px] text-zinc-400 truncate block">{skill.description || "No description"}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-blue-400 hover:text-blue-300" onClick={() => handleEditSkill(index)}>
                        Edit
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => handleDeleteSkill(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {newAgentSkills.length === 0 && (
                  <div className="text-center p-4 bg-[#090c10]/40 rounded-lg border border-dashed border-[#1e293b]">
                    <span className="text-[10px] text-zinc-500 font-medium">No custom skills defined. The sandbox will have default tools only.</span>
                  </div>
                )}
              </div>

              {/* Skills Form */}
              <div className="bg-[#090c10]/60 p-3 rounded-lg border border-[#1e293b]/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    {editingSkillIndex !== null ? "Edit Skill" : "Add Custom Skill"}
                  </span>
                  {editingSkillIndex !== null && (
                    <Button type="button" variant="link" className="text-[10px] text-zinc-550 h-4 p-0" onClick={() => { setEditingSkillIndex(null); setSkillNameInput(""); setSkillDescInput(""); setSkillContentInput(""); }}>
                      Cancel Edit
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input 
                      placeholder="Skill name (e.g. slide-maker)" 
                      value={skillNameInput} 
                      onChange={e => setSkillNameInput(e.target.value)} 
                      className="bg-[#050608] border-[#1e293b] text-white text-[11px] h-8 rounded-md"
                    />
                  </div>
                  <div>
                    <Input 
                      placeholder="Skill description (short)" 
                      value={skillDescInput} 
                      onChange={e => setSkillDescInput(e.target.value)} 
                      className="bg-[#050608] border-[#1e293b] text-white text-[11px] h-8 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <Textarea 
                    placeholder="# Skill Instructions&#10;Describe step-by-step how the agent behaves when performing this skill..." 
                    value={skillContentInput} 
                    onChange={e => setSkillContentInput(e.target.value)} 
                    className="bg-[#050608] border-[#1e293b] text-white text-[11px] font-mono min-h-[70px] rounded-md"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" className="bg-[#1e293b] hover:bg-[#2e3e56] text-white h-7 text-xs rounded-md" onClick={handleAddOrUpdateSkill} disabled={!skillNameInput.trim()}>
                    {editingSkillIndex !== null ? "Update Skill" : "Add Skill"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="workspace" className="space-y-3 pt-1">
              {/* Existing Workspace Files list */}
              <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                {newAgentWorkspaceFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-[#090c10] border border-[#1e293b] rounded-lg p-2 text-xs">
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="font-mono text-emerald-400 font-bold block truncate">workspace/{file.path}</span>
                      <span className="text-[10px] text-zinc-500 block truncate">{file.content.length} chars</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-blue-400 hover:text-blue-300" onClick={() => handleEditFile(index)}>
                        Edit
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => handleDeleteFile(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {newAgentWorkspaceFiles.length === 0 && (
                  <div className="text-center p-4 bg-[#090c10]/40 rounded-lg border border-dashed border-[#1e293b]">
                    <span className="text-[10px] text-zinc-500 font-medium">No initial workspace files defined. The environment sandbox will start empty.</span>
                  </div>
                )}
              </div>

              {/* Workspace Files Form */}
              <div className="bg-[#090c10]/60 p-3 rounded-lg border border-[#1e293b]/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    {editingFileIndex !== null ? "Edit File" : "Add Workspace File"}
                  </span>
                  {editingFileIndex !== null && (
                    <Button type="button" variant="link" className="text-[10px] text-zinc-550 h-4 p-0" onClick={() => { setEditingFileIndex(null); setFilePathInput(""); setFileContentInput(""); }}>
                      Cancel Edit
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-zinc-500 font-mono bg-[#050608] px-2 py-1.5 rounded-l-md border border-r-0 border-[#1e293b] select-none">
                    workspace/
                  </span>
                  <Input 
                    placeholder="path/to/file.json" 
                    value={filePathInput} 
                    onChange={e => setFilePathInput(e.target.value)} 
                    className="bg-[#050608] border-[#1e293b] text-white text-[11px] h-8 rounded-none rounded-r-md flex-1"
                  />
                </div>
                <div>
                  <Textarea 
                    placeholder="File content..." 
                    value={fileContentInput} 
                    onChange={e => setFileContentInput(e.target.value)} 
                    className="bg-[#050608] border-[#1e293b] text-white text-[11px] font-mono min-h-[70px] rounded-md"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" className="bg-[#1e293b] hover:bg-[#2e3e56] text-white h-7 text-xs rounded-md" onClick={handleAddOrUpdateFile} disabled={!filePathInput.trim()}>
                    {editingFileIndex !== null ? "Update File" : "Save File"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 border-t border-[#1e293b] pt-3">
            <Button type="button" variant="outline" className="border-[#1e293b] hover:bg-[#1a202c]" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
              {loading ? "Creating..." : "Register Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
