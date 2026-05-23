import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User } from "lucide-react";

interface Message {
  role: "user" | "model" | "system";
  content: string;
  timestamp: string;
}

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-zinc-300" />
        </div>
      )}
      
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className={`p-4 rounded-2xl shadow-sm text-xs leading-relaxed ${
          isUser
            ? "bg-[#2563eb] text-white rounded-tr-none"
            : "bg-[#0f131a] border border-[#1e293b] text-zinc-200 rounded-tl-none"
        }`}>
          <div className="prose prose-invert prose-xs max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <span className={`text-[9px] text-zinc-500 px-1 ${isUser ? "text-right" : "text-left"}`}>
          {message.timestamp}
        </span>
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </div>
  );
};
