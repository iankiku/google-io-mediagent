"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type ChatMarkdownProps = {
  content: string;
  className?: string;
};

/**
 * Lightweight markdown renderer for plain-string chat responses.
 *
 * Renders GFM (tables, task lists, autolinks) and forces long tokens / URLs
 * to wrap so chat bubbles never overflow horizontally.
 */
export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        "chat-md min-w-0 max-w-full text-[14px] leading-relaxed break-words [overflow-wrap:anywhere]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ className: c, ...props }) => (
            <h1
              className={cn(
                "mt-3 mb-2 text-base font-semibold first:mt-0",
                c,
              )}
              {...props}
            />
          ),
          h2: ({ className: c, ...props }) => (
            <h2
              className={cn(
                "mt-3 mb-1.5 text-sm font-semibold first:mt-0",
                c,
              )}
              {...props}
            />
          ),
          h3: ({ className: c, ...props }) => (
            <h3
              className={cn(
                "mt-2.5 mb-1 text-sm font-semibold first:mt-0",
                c,
              )}
              {...props}
            />
          ),
          p: ({ className: c, ...props }) => (
            <p
              className={cn(
                "my-2 first:mt-0 last:mb-0 whitespace-pre-wrap break-words",
                c,
              )}
              {...props}
            />
          ),
          ul: ({ className: c, ...props }) => (
            <ul
              className={cn(
                "my-2 ml-5 list-disc marker:text-muted-foreground space-y-1",
                c,
              )}
              {...props}
            />
          ),
          ol: ({ className: c, ...props }) => (
            <ol
              className={cn(
                "my-2 ml-5 list-decimal marker:text-muted-foreground space-y-1",
                c,
              )}
              {...props}
            />
          ),
          li: ({ className: c, ...props }) => (
            <li
              className={cn("leading-relaxed break-words", c)}
              {...props}
            />
          ),
          a: ({ className: c, ...props }) => (
            <a
              className={cn(
                "text-primary underline underline-offset-2 hover:text-primary/80 break-all",
                c,
              )}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          strong: ({ className: c, ...props }) => (
            <strong className={cn("font-semibold", c)} {...props} />
          ),
          em: ({ className: c, ...props }) => (
            <em className={cn("italic", c)} {...props} />
          ),
          blockquote: ({ className: c, ...props }) => (
            <blockquote
              className={cn(
                "my-2 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground italic",
                c,
              )}
              {...props}
            />
          ),
          code: ({ className: c, children, ...props }) => {
            const isBlock = String(c ?? "").includes("language-");
            if (isBlock) {
              return (
                <code
                  className={cn(
                    "block w-full overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12.5px]",
                    c,
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={cn(
                  "rounded-md border border-border/50 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] break-words",
                  c,
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ className: c, ...props }) => (
            <pre
              className={cn(
                "my-2 max-w-full overflow-x-auto rounded-lg border border-border/50 bg-muted/40 p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words",
                c,
              )}
              {...props}
            />
          ),
          table: ({ className: c, ...props }) => (
            <div className="my-2 w-full overflow-x-auto">
              <table
                className={cn(
                  "w-full border-collapse text-left text-[13px]",
                  c,
                )}
                {...props}
              />
            </div>
          ),
          th: ({ className: c, ...props }) => (
            <th
              className={cn(
                "border-b border-border/60 bg-muted/50 px-2 py-1 font-medium",
                c,
              )}
              {...props}
            />
          ),
          td: ({ className: c, ...props }) => (
            <td
              className={cn(
                "border-b border-border/40 px-2 py-1 align-top break-words",
                c,
              )}
              {...props}
            />
          ),
          hr: ({ className: c, ...props }) => (
            <hr
              className={cn("my-3 border-muted-foreground/20", c)}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
