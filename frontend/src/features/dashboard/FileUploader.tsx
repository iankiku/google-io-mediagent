"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  userId: string;
  onUploadSuccess: () => void;
  apiBase: string;
}

export function FileUploader({ userId, onUploadSuccess, apiBase }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadingFileName, setUploadingFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;
    setUploadingFileName(file.name);
    setStatus("uploading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("file", file);

    try {
      const response = await fetch(`${apiBase}/api/ingest/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to process medical document");
      }

      setStatus("success");
      onUploadSuccess();
      setTimeout(() => {
        setStatus("idle");
        setUploadingFileName("");
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred during parsing.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={status === "idle" ? triggerFileInput : undefined}
        className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
          dragActive
            ? "border-blue-500 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
            : status === "uploading"
            ? "border-amber-500/50 bg-amber-500/5"
            : status === "success"
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-[#1e293b] bg-[#0c0f16]/40 hover:border-zinc-800 hover:bg-[#0c0f16]/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.txt"
          onChange={handleChange}
          disabled={status !== "idle"}
        />

        {status === "idle" && (
          <>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500/10 to-purple-500/10 flex items-center justify-center border border-[#1e293b] mb-4">
              <Upload className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-xs font-bold text-white mb-1">Upload Medical Document</h3>
            <p className="text-[10px] text-zinc-500 max-w-xs leading-normal">
              Drag & drop lab reports, prescriptions, physician notes, or doctor letters (PDF, JPG, PNG, TXT)
            </p>
          </>
        )}

        {status === "uploading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-white">Analyzing Medical File</span>
              <span className="text-[10px] text-zinc-500 italic max-w-xs truncate">
                MedGemma OCR & Clinical Entity Extraction on "{uploadingFileName}"
              </span>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="text-xs font-bold text-white">Ingestion Complete</h4>
            <p className="text-[10px] text-zinc-500 max-w-xs">
              Successfully indexed '{uploadingFileName}' into private health profile.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white mb-1">Ingestion Failed</h4>
              <p className="text-[9px] text-red-400 max-w-md bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg leading-normal">
                {errorMessage}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={triggerFileInput} className="text-[10px] h-7 mt-1 border-zinc-800">
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
