"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Send, X, Languages, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Turn {
  raw_transcript: string;
  cleaned: string;
  extracted: Record<string, unknown>;
  role: string;
  turn_index: number;
}

export default function InterpreterPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isRecording, setIsRecording] = useState<string | null>(null); // "patient" | "doctor" | null
  const [isProcessing, setIsProcessing] = useState(false);
  const [patientText, setPatientText] = useState("");
  const [doctorText, setDoctorText] = useState("");
  const [sessionActive, setSessionActive] = useState(true);
  const [endingSession, setEndingSession] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns]);

  const startRecording = useCallback(async (role: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await submitTurn(role, audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(role);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(null);
    }
  }, []);

  const submitTurn = async (role: string, audioBlob?: Blob, text?: string) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("role", role);
      if (audioBlob) {
        formData.append("audio", audioBlob, "recording.webm");
      }
      if (text) {
        formData.append("text", text);
      }

      const res = await fetch(`${API_BASE}/api/interpreter/turn`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const turn: Turn = await res.json();
      setTurns((prev) => [...prev, turn]);
    } catch (err) {
      console.error("Failed to process turn:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async (role: string) => {
    const text = role === "patient" ? patientText : doctorText;
    if (!text.trim()) return;
    if (role === "patient") setPatientText("");
    else setDoctorText("");
    await submitTurn(role, undefined, text);
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    try {
      const formData = new FormData();
      formData.append("user_id", "demo-patient-uuid-001");
      formData.append("turns", JSON.stringify(turns));

      const res = await fetch(`${API_BASE}/api/interpreter/end`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setSessionActive(false);
      }
    } catch (err) {
      console.error("Failed to end session:", err);
    } finally {
      setEndingSession(false);
    }
  };

  const extractedChips = (extracted: Record<string, unknown>) => {
    const chips: { label: string; value: string }[] = [];
    for (const [key, val] of Object.entries(extracted)) {
      if (val && typeof val === "string") {
        chips.push({ label: key, value: val });
      } else if (Array.isArray(val) && val.length > 0) {
        chips.push({ label: key, value: val.join(", ") });
      }
    }
    return chips;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#08090d] text-[#e2e8f0] font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-[#1a202c] bg-[#0c0f16]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              ZOIE LIVE INTERPRETER
            </h1>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
              Indian English &harr; Clinical English
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                sessionActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
              }`}
            />
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              {sessionActive ? "Session Active" : "Session Ended"}
            </span>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent border-cyan-400 animate-spin" />
              <span className="text-[10px] text-cyan-400 font-medium">Processing...</span>
            </div>
          )}
        </div>
      </header>

      {/* Push-to-Talk Controls */}
      {sessionActive && (
        <div className="px-6 py-6 border-b border-[#1a202c] bg-[#0a0c12]">
          <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Patient Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onMouseDown={() => startRecording("patient")}
                onMouseUp={stopRecording}
                onTouchStart={() => startRecording("patient")}
                onTouchEnd={stopRecording}
                disabled={isProcessing || !sessionActive || isRecording === "doctor"}
                className={`w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 select-none ${
                  isRecording === "patient"
                    ? "bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-500/30 scale-[1.02]"
                    : "bg-[#0f1a16] border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/10"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isRecording === "patient"
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-emerald-500/20"
                  }`}
                >
                  {isRecording === "patient" ? (
                    <Mic className="w-6 h-6 text-white" />
                  ) : (
                    <User className="w-6 h-6 text-emerald-400" />
                  )}
                </div>
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                  {isRecording === "patient" ? "Recording..." : "Patient"}
                </span>
                <span className="text-[9px] text-zinc-500">Hold to speak</span>
              </button>

              {/* Patient text fallback */}
              <div className="flex gap-2 w-full">
                <Input
                  value={patientText}
                  onChange={(e) => setPatientText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTextSubmit("patient");
                  }}
                  placeholder="Type patient words..."
                  className="bg-[#0a0c12] border-emerald-500/20 text-xs h-9 px-3 rounded-lg text-white placeholder:text-zinc-600 focus:border-emerald-400"
                  disabled={isProcessing}
                />
                <Button
                  size="icon"
                  onClick={() => handleTextSubmit("patient")}
                  disabled={!patientText.trim() || isProcessing}
                  className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Doctor Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onMouseDown={() => startRecording("doctor")}
                onMouseUp={stopRecording}
                onTouchStart={() => startRecording("doctor")}
                onTouchEnd={stopRecording}
                disabled={isProcessing || !sessionActive || isRecording === "patient"}
                className={`w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 select-none ${
                  isRecording === "doctor"
                    ? "bg-blue-500/20 border-blue-400 shadow-lg shadow-blue-500/30 scale-[1.02]"
                    : "bg-[#0f1320] border-blue-500/30 hover:border-blue-400/60 hover:bg-blue-500/10"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isRecording === "doctor"
                      ? "bg-blue-500 animate-pulse"
                      : "bg-blue-500/20"
                  }`}
                >
                  {isRecording === "doctor" ? (
                    <Mic className="w-6 h-6 text-white" />
                  ) : (
                    <Stethoscope className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                  {isRecording === "doctor" ? "Recording..." : "Doctor"}
                </span>
                <span className="text-[9px] text-zinc-500">Hold to speak</span>
              </button>

              {/* Doctor text fallback */}
              <div className="flex gap-2 w-full">
                <Input
                  value={doctorText}
                  onChange={(e) => setDoctorText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTextSubmit("doctor");
                  }}
                  placeholder="Type doctor words..."
                  className="bg-[#0a0c12] border-blue-500/20 text-xs h-9 px-3 rounded-lg text-white placeholder:text-zinc-600 focus:border-blue-400"
                  disabled={isProcessing}
                />
                <Button
                  size="icon"
                  onClick={() => handleTextSubmit("doctor")}
                  disabled={!doctorText.trim() || isProcessing}
                  className="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-6 py-4 space-y-4 max-w-4xl mx-auto">
            {turns.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1e293b] flex items-center justify-center mb-4">
                  <Languages className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">
                  No turns yet. Hold a button to speak, or type below.
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  Patient speech is normalized to clinical English. Doctor speech is simplified for the patient.
                </p>
              </div>
            )}

            {turns.map((turn) => {
              const isPatient = turn.role === "patient";
              const chips = extractedChips(turn.extracted);

              return (
                <div
                  key={turn.turn_index}
                  className={`flex ${isPatient ? "justify-start" : "justify-end"}`}
                >
                  <Card
                    className={`max-w-[80%] p-4 border rounded-2xl space-y-3 ${
                      isPatient
                        ? "bg-[#0f1a16] border-emerald-500/20 rounded-tl-none"
                        : "bg-[#0f1320] border-blue-500/20 rounded-tr-none"
                    }`}
                  >
                    {/* Speaker badge */}
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-[9px] font-bold uppercase tracking-wider ${
                          isPatient
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }`}
                        variant="outline"
                      >
                        {isPatient ? (
                          <User className="w-3 h-3 mr-1" />
                        ) : (
                          <Stethoscope className="w-3 h-3 mr-1" />
                        )}
                        {turn.role}
                      </Badge>
                      <span className="text-[9px] text-zinc-600">Turn {turn.turn_index}</span>
                    </div>

                    {/* Raw transcript */}
                    <div>
                      <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                        Raw
                      </span>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                        {turn.raw_transcript}
                      </p>
                    </div>

                    {/* Cleaned text */}
                    <div>
                      <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                        {isPatient ? "Clinical" : "Simplified"}
                      </span>
                      <p className="text-sm text-white mt-0.5 leading-relaxed font-medium">
                        {turn.cleaned}
                      </p>
                    </div>

                    {/* Extracted chips */}
                    {chips.length > 0 && (
                      <div>
                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                          Extracted
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {chips.map((chip, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className={`text-[9px] font-medium ${
                                isPatient
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                              }`}
                            >
                              {chip.label}: {chip.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      {/* End Visit Footer */}
      {sessionActive && turns.length > 0 && (
        <div className="px-6 py-4 border-t border-[#1a202c] bg-[#0a0c12] flex items-center justify-between">
          <p className="text-[10px] text-zinc-500">
            {turns.length} turn{turns.length !== 1 ? "s" : ""} recorded
          </p>
          <Button
            onClick={handleEndSession}
            disabled={endingSession}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-6 h-10 rounded-xl shadow-lg shadow-rose-600/10"
          >
            {endingSession ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <X className="w-4 h-4 mr-2" />
                End Visit
              </>
            )}
          </Button>
        </div>
      )}

      {/* Session ended state */}
      {!sessionActive && (
        <div className="px-6 py-6 border-t border-[#1a202c] bg-[#0a0c12] flex flex-col items-center gap-3">
          <p className="text-sm text-emerald-400 font-bold">Visit transcript saved successfully.</p>
          <Button
            onClick={() => {
              setTurns([]);
              setSessionActive(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 h-10 rounded-xl"
          >
            Start New Session
          </Button>
        </div>
      )}
    </div>
  );
}
